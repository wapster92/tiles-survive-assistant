import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { and, asc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { hashPassword } from '../auth.js';
import { elementSeed, ruleSeed } from './seed-data.js';
import {
  elements,
  eventRules,
  userElementValues,
  userPlanItems,
  users,
  userTrainingPlans
} from './schema.js';

const databasePath = resolve(process.env.SQLITE_DATABASE_PATH ?? './data/tails-survive.sqlite');

mkdirSync(dirname(databasePath), { recursive: true });

const sqlite = new Database(databasePath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite);

export function initializeDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS elements (
      key TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      unit TEXT NOT NULL,
      icon TEXT NOT NULL,
      days TEXT NOT NULL,
      tier INTEGER,
      color_name TEXT,
      color_hex TEXT
    );

    CREATE TABLE IF NOT EXISTS event_rules (
      key TEXT PRIMARY KEY NOT NULL,
      element_key TEXT NOT NULL,
      action TEXT NOT NULL,
      points INTEGER NOT NULL,
      days TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      calculator_visible INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (element_key) REFERENCES elements(key)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      game_nickname TEXT NOT NULL,
      nickname TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_element_values (
      user_id INTEGER NOT NULL,
      element_key TEXT NOT NULL,
      amount REAL NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, element_key),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (element_key) REFERENCES elements(key)
    );

    CREATE TABLE IF NOT EXISTS user_plan_items (
      user_id INTEGER NOT NULL,
      rule_key TEXT NOT NULL,
      amount REAL NOT NULL,
      planned_amount REAL NOT NULL,
      universal_amount REAL NOT NULL DEFAULT 0,
      resource_costs TEXT NOT NULL DEFAULT '[]',
      day INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, rule_key, day),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (rule_key) REFERENCES event_rules(key)
    );

    CREATE TABLE IF NOT EXISTS user_training_plans (
      user_id INTEGER PRIMARY KEY NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 0,
      soldier_level INTEGER NOT NULL,
      current_soldiers INTEGER NOT NULL,
      garrison_limit INTEGER NOT NULL,
      planned_soldiers INTEGER NOT NULL,
      batch_limit INTEGER NOT NULL,
      batch_hours INTEGER NOT NULL,
      batch_minutes INTEGER NOT NULL,
      training_speedup_minutes INTEGER NOT NULL,
      universal_training_minutes INTEGER NOT NULL DEFAULT 0,
      resource_costs TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  ensureElementMetadataColumns();
  ensureRuleMetadataColumns();
  ensureUserProfileColumns();
  ensurePlanItemsSupportMultipleDays();
  ensureUniversalAllocationColumns();
  ensureResourceCostColumns();
  removeLegacyGrowthColumns();
  sqlite.exec('DROP TABLE IF EXISTS user_speedup_allocations');
  ensureTrainingPlanMetadataColumns();
  seedElements();
  seedRules();
  removeHiddenPlanItems();
  seedDefaultUser();
}

export function getDictionary() {
  const allElements = db
    .select()
    .from(elements)
    .orderBy(asc(elements.category), asc(elements.name), asc(elements.tier))
    .all();
  const allRules = db.select().from(eventRules).orderBy(asc(eventRules.sortOrder)).all();

  return {
    elements: allElements,
    rules: allRules
  };
}

export function getRulesByDay(day) {
  const targetDay = Number(day);

  if (!Number.isInteger(targetDay) || targetDay < 1 || targetDay > 7) {
    return [];
  }

  return db
    .select()
    .from(eventRules)
    .orderBy(asc(eventRules.sortOrder))
    .all()
    .filter((rule) => rule.days.includes(targetDay));
}

export function getRulesByElement(elementKey) {
  return db
    .select()
    .from(eventRules)
    .where(eq(eventRules.elementKey, elementKey))
    .orderBy(asc(eventRules.sortOrder))
    .all();
}

export function getRuleByKey(ruleKey) {
  return db.select().from(eventRules).where(eq(eventRules.key, ruleKey)).get() ?? null;
}

export function createUser({ username, gameNickname, passwordHash }) {
  const createdAt = new Date().toISOString();

  const result = db
    .insert(users)
    .values({ username, gameNickname, legacyNickname: username, passwordHash, createdAt })
    .run();

  return getPublicUserById(Number(result.lastInsertRowid));
}

export function getUserByUsername(username) {
  return db.select().from(users).where(eq(users.username, username)).get() ?? null;
}

export function getUserById(id) {
  return db.select().from(users).where(eq(users.id, id)).get() ?? null;
}

export function getPublicUserById(id) {
  const user = getUserById(id);
  return user ? toPublicUser(user) : null;
}

export function getUserElementValues(userId) {
  return db
    .select()
    .from(userElementValues)
    .where(eq(userElementValues.userId, userId))
    .orderBy(asc(userElementValues.elementKey))
    .all();
}

export function upsertUserElementValues(userId, values) {
  const updatedAt = new Date().toISOString();

  db.transaction((tx) => {
    for (const value of values) {
      tx.insert(userElementValues)
        .values({
          userId,
          elementKey: value.elementKey,
          amount: value.amount,
          updatedAt
        })
        .onConflictDoUpdate({
          target: [userElementValues.userId, userElementValues.elementKey],
          set: {
            amount: value.amount,
            updatedAt
          }
        })
        .run();
    }
  });

  return getUserElementValues(userId);
}

export function resetUserElementValues(userId) {
  db.delete(userElementValues).where(eq(userElementValues.userId, userId)).run();
}

export function deleteUserElementValue(userId, elementKey) {
  db.delete(userElementValues)
    .where(and(eq(userElementValues.userId, userId), eq(userElementValues.elementKey, elementKey)))
    .run();
}

export function getUserPlanItems(userId) {
  return db
    .select()
    .from(userPlanItems)
    .where(eq(userPlanItems.userId, userId))
    .orderBy(asc(userPlanItems.day), asc(userPlanItems.ruleKey))
    .all();
}

export function replaceUserPlanItems(userId, items) {
  const updatedAt = new Date().toISOString();

  db.transaction((tx) => {
    tx.delete(userPlanItems).where(eq(userPlanItems.userId, userId)).run();

    for (const item of items) {
      tx.insert(userPlanItems)
        .values({
          userId,
          ruleKey: item.ruleKey,
          amount: item.amount,
          plannedAmount: item.plannedAmount,
          universalAmount: item.universalAmount,
          resourceCosts: item.resourceCosts,
          day: item.day,
          updatedAt
        })
        .run();
    }
  });

  return getUserPlanItems(userId);
}

export function getUserTrainingPlan(userId) {
  return (
    db.select().from(userTrainingPlans).where(eq(userTrainingPlans.userId, userId)).get() ?? {
      userId,
      enabled: false,
      soldierLevel: 1,
      currentSoldiers: 0,
      garrisonLimit: 0,
      plannedSoldiers: 0,
      batchLimit: 0,
      batchHours: 0,
      batchMinutes: 0,
      trainingSpeedupMinutes: 0,
      universalTrainingMinutes: 0,
      resourceCosts: [],
      updatedAt: null
    }
  );
}

function ensureTrainingPlanMetadataColumns() {
  const columnNames = new Set(sqlite.prepare('PRAGMA table_info(user_training_plans)').all().map((column) => column.name));

  if (!columnNames.has('enabled')) {
    sqlite.exec('ALTER TABLE user_training_plans ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1');
  }
}

export function upsertUserTrainingPlan(userId, plan) {
  const updatedAt = new Date().toISOString();

  db.insert(userTrainingPlans)
    .values({ userId, ...plan, updatedAt })
    .onConflictDoUpdate({
      target: userTrainingPlans.userId,
      set: { ...plan, updatedAt }
    })
    .run();

  return getUserTrainingPlan(userId);
}

export function resetUserCalculator(userId) {
  db.transaction((tx) => {
    tx.delete(userPlanItems).where(eq(userPlanItems.userId, userId)).run();
    tx.delete(userTrainingPlans).where(eq(userTrainingPlans.userId, userId)).run();
    tx.delete(userElementValues).where(eq(userElementValues.userId, userId)).run();
  });
}

function toPublicUser(user) {
  return {
    id: user.id,
    username: user.username,
    gameNickname: user.gameNickname,
    createdAt: user.createdAt
  };
}

function ensureUserProfileColumns() {
  const columnNames = new Set(sqlite.prepare('PRAGMA table_info(users)').all().map((column) => column.name));

  if (!columnNames.has('username')) {
    sqlite.exec('ALTER TABLE users ADD COLUMN username TEXT');
    sqlite.exec('UPDATE users SET username = nickname WHERE username IS NULL');
  }

  if (!columnNames.has('game_nickname')) {
    sqlite.exec('ALTER TABLE users ADD COLUMN game_nickname TEXT');
    sqlite.exec('UPDATE users SET game_nickname = COALESCE(nickname, username) WHERE game_nickname IS NULL');
  }

  if (!columnNames.has('nickname')) {
    sqlite.exec('ALTER TABLE users ADD COLUMN nickname TEXT');
    sqlite.exec('UPDATE users SET nickname = username WHERE nickname IS NULL');
  }

  sqlite.exec('UPDATE users SET username = nickname WHERE username IS NULL');
  sqlite.exec('UPDATE users SET game_nickname = username WHERE game_nickname IS NULL');
  sqlite.exec('UPDATE users SET nickname = username WHERE nickname IS NULL');
  sqlite.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users(username)');
}

function seedElements() {
  for (const element of elementSeed) {
    const normalizedElement = {
      ...element,
      tier: element.tier ?? null,
      colorName: element.colorName ?? null,
      colorHex: element.colorHex ?? null
    };

    db.insert(elements)
      .values(normalizedElement)
      .onConflictDoUpdate({
        target: elements.key,
        set: {
          name: element.name,
          category: element.category,
          unit: element.unit,
          icon: element.icon,
          days: element.days,
          tier: normalizedElement.tier,
          colorName: normalizedElement.colorName,
          colorHex: normalizedElement.colorHex
        }
      })
      .run();
  }
}

function ensureElementMetadataColumns() {
  const columnNames = new Set(sqlite.prepare('PRAGMA table_info(elements)').all().map((column) => column.name));

  if (!columnNames.has('tier')) {
    sqlite.exec('ALTER TABLE elements ADD COLUMN tier INTEGER');
  }

  if (!columnNames.has('color_name')) {
    sqlite.exec('ALTER TABLE elements ADD COLUMN color_name TEXT');
  }

  if (!columnNames.has('color_hex')) {
    sqlite.exec('ALTER TABLE elements ADD COLUMN color_hex TEXT');
  }
}

function ensureRuleMetadataColumns() {
  const columnNames = new Set(sqlite.prepare('PRAGMA table_info(event_rules)').all().map((column) => column.name));

  if (!columnNames.has('calculator_visible')) {
    sqlite.exec('ALTER TABLE event_rules ADD COLUMN calculator_visible INTEGER NOT NULL DEFAULT 1');
  }
}

function ensurePlanItemsSupportMultipleDays() {
  const primaryKeyColumns = sqlite
    .prepare('PRAGMA table_info(user_plan_items)')
    .all()
    .filter((column) => column.pk > 0)
    .sort((left, right) => left.pk - right.pk)
    .map((column) => column.name);

  if (primaryKeyColumns.join(',') === 'user_id,rule_key,day') {
    return;
  }

  sqlite.pragma('foreign_keys = OFF');

  try {
    sqlite.exec(`
      BEGIN;
      ALTER TABLE user_plan_items RENAME TO user_plan_items_legacy;
      CREATE TABLE user_plan_items (
        user_id INTEGER NOT NULL,
        rule_key TEXT NOT NULL,
        amount REAL NOT NULL,
        planned_amount REAL NOT NULL,
        universal_amount REAL NOT NULL DEFAULT 0,
        resource_costs TEXT NOT NULL DEFAULT '[]',
        day INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, rule_key, day),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (rule_key) REFERENCES event_rules(key)
      );
      INSERT INTO user_plan_items (
        user_id, rule_key, amount, planned_amount, universal_amount, resource_costs, day, updated_at
      )
      SELECT user_id, rule_key, amount, planned_amount, 0, '[]', day, updated_at
      FROM user_plan_items_legacy;
      DROP TABLE user_plan_items_legacy;
      COMMIT;
    `);
  } catch (error) {
    if (sqlite.inTransaction) {
      sqlite.exec('ROLLBACK');
    }
    throw error;
  } finally {
    sqlite.pragma('foreign_keys = ON');
  }
}

function ensureUniversalAllocationColumns() {
  const planColumns = new Set(sqlite.prepare('PRAGMA table_info(user_plan_items)').all().map((column) => column.name));
  const trainingColumns = new Set(sqlite.prepare('PRAGMA table_info(user_training_plans)').all().map((column) => column.name));

  if (!planColumns.has('universal_amount')) {
    sqlite.exec('ALTER TABLE user_plan_items ADD COLUMN universal_amount REAL NOT NULL DEFAULT 0');
  }

  if (!trainingColumns.has('universal_training_minutes')) {
    sqlite.exec('ALTER TABLE user_training_plans ADD COLUMN universal_training_minutes INTEGER NOT NULL DEFAULT 0');
  }
}

function ensureResourceCostColumns() {
  const planColumns = new Set(sqlite.prepare('PRAGMA table_info(user_plan_items)').all().map((column) => column.name));
  const trainingColumns = new Set(sqlite.prepare('PRAGMA table_info(user_training_plans)').all().map((column) => column.name));

  if (!planColumns.has('resource_costs')) {
    sqlite.exec("ALTER TABLE user_plan_items ADD COLUMN resource_costs TEXT NOT NULL DEFAULT '[]'");
  }

  if (!trainingColumns.has('resource_costs')) {
    sqlite.exec("ALTER TABLE user_training_plans ADD COLUMN resource_costs TEXT NOT NULL DEFAULT '[]'");
  }
}

function removeLegacyGrowthColumns() {
  for (const table of ['user_element_values', 'user_plan_items']) {
    const columns = new Set(sqlite.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name));

    if (columns.has('weekly_growth')) {
      sqlite.exec(`ALTER TABLE ${table} DROP COLUMN weekly_growth`);
    }
  }
}

function seedRules() {
  for (const rule of ruleSeed) {
    db.insert(eventRules)
      .values(rule)
      .onConflictDoUpdate({
        target: eventRules.key,
        set: {
          elementKey: rule.elementKey,
          action: rule.action,
          points: rule.points,
          days: rule.days,
          sortOrder: rule.sortOrder,
          calculatorVisible: rule.calculatorVisible
        }
      })
      .run();
  }
}

function removeHiddenPlanItems() {
  sqlite.exec(`
    DELETE FROM user_plan_items
    WHERE rule_key IN (
      SELECT key FROM event_rules WHERE calculator_visible = 0
    )
  `);
}

function seedDefaultUser() {
  const username = 'root';

  if (getUserByUsername(username)) {
    return;
  }

  createUser({
    username,
    gameNickname: username,
    passwordHash: hashPassword('0000')
  });
}
