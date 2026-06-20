import { integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const elements = sqliteTable('elements', {
  key: text('key').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  unit: text('unit').notNull(),
  icon: text('icon').notNull(),
  days: text('days', { mode: 'json' }).notNull(),
  tier: integer('tier'),
  colorName: text('color_name'),
  colorHex: text('color_hex')
});

export const eventRules = sqliteTable('event_rules', {
  key: text('key').primaryKey(),
  elementKey: text('element_key')
    .notNull()
    .references(() => elements.key),
  action: text('action').notNull(),
  points: integer('points').notNull(),
  days: text('days', { mode: 'json' }).notNull(),
  sortOrder: integer('sort_order').notNull(),
  calculatorVisible: integer('calculator_visible', { mode: 'boolean' }).notNull().default(true)
});

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  gameNickname: text('game_nickname').notNull(),
  legacyNickname: text('nickname'),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').notNull()
});

export const userElementValues = sqliteTable(
  'user_element_values',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    elementKey: text('element_key')
      .notNull()
      .references(() => elements.key),
    amount: real('amount').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.elementKey] })
  })
);

export const userPlanItems = sqliteTable(
  'user_plan_items',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ruleKey: text('rule_key')
      .notNull()
      .references(() => eventRules.key),
    amount: real('amount').notNull(),
    plannedAmount: real('planned_amount').notNull(),
    universalAmount: real('universal_amount').notNull().default(0),
    resourceCosts: text('resource_costs', { mode: 'json' }).notNull().default('[]'),
    day: integer('day').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.ruleKey, table.day] })
  })
);

export const userTrainingPlans = sqliteTable('user_training_plans', {
  userId: integer('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  soldierLevel: integer('soldier_level').notNull(),
  currentSoldiers: integer('current_soldiers').notNull(),
  garrisonLimit: integer('garrison_limit').notNull(),
  plannedSoldiers: integer('planned_soldiers').notNull(),
  batchLimit: integer('batch_limit').notNull(),
  batchHours: integer('batch_hours').notNull(),
  batchMinutes: integer('batch_minutes').notNull(),
  trainingSpeedupMinutes: integer('training_speedup_minutes').notNull(),
  universalTrainingMinutes: integer('universal_training_minutes').notNull().default(0),
  resourceCosts: text('resource_costs', { mode: 'json' }).notNull().default('[]'),
  updatedAt: text('updated_at').notNull()
});
