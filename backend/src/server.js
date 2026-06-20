import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { calculateUserPlan } from './calculator.js';
import {
  createAuthToken,
  hashPassword,
  normalizeGameNickname,
  normalizeUsername,
  validateGameNickname,
  validatePassword,
  validateUsername,
  verifyAuthToken,
  verifyPassword
} from './auth.js';
import {
  createUser,
  deleteUserElementValue,
  getDictionary,
  getPublicUserById,
  getRuleByKey,
  getRulesByDay,
  getRulesByElement,
  getUserById,
  getUserByUsername,
  getUserElementValues,
  getUserPlanItems,
  getUserTrainingPlan,
  initializeDatabase,
  replaceUserPlanItems,
  resetUserCalculator,
  resetUserElementValues,
  upsertUserElementValues,
  upsertUserTrainingPlan
} from './db/index.js';
import { openApiDocument } from './openapi.js';

export const app = express();
const port = Number(process.env.PORT ?? 3000);

initializeDatabase();

app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json());

app.get('/openapi.json', (_req, res) => {
  res.json(openApiDocument);
});
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(openApiDocument, {
    customSiteTitle: 'Tails Survive API',
    swaggerOptions: { persistAuthorization: true }
  })
);

const eventWindows = [
  { day: 'Понедельник', time: '16:00-19:00 МСК', activity: 'Снаряжение: обломки', overlaps: ['ТЧ', 'VS', 'ИК'] },
  { day: 'Вторник', time: '12:00-15:00 МСК', activity: 'Снаряжение: обломки', overlaps: ['ТЧ', 'ИК'] },
  { day: 'Пятница', time: '00:00-03:00 МСК', activity: 'Снаряжение: обломки', overlaps: ['ТЧ', 'ИК'] },
  { day: 'Суббота', time: '20:00-23:00 МСК', activity: 'Снаряжение: обломки', overlaps: ['ИК'] },
  { day: 'Воскресенье', time: '16:00-19:00 МСК', activity: 'Снаряжение: обломки', overlaps: ['ТЧ', 'ИК'] }
];

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/auth/register', (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const gameNickname = normalizeGameNickname(req.body?.gameNickname ?? req.body?.username);
  const password = req.body?.password;

  if (!validateUsername(username)) {
    res.status(400).json({ error: 'Username must be 3-32 characters and contain only letters, digits, underscore or hyphen.' });
    return;
  }

  if (!validateGameNickname(gameNickname)) {
    res.status(400).json({ error: 'Game nickname must be 1-32 characters.' });
    return;
  }

  if (!validatePassword(password)) {
    res.status(400).json({ error: 'Password must be 6-128 characters.' });
    return;
  }

  try {
    const user = createUser({
      username,
      gameNickname,
      passwordHash: hashPassword(password)
    });

    res.status(201).json({ user, token: createAuthToken(user) });
  } catch (error) {
    if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(409).json({ error: 'Username is already taken.' });
      return;
    }

    throw error;
  }
});

app.post('/api/auth/login', (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = req.body?.password;
  const user = getUserByUsername(username);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: 'Invalid username or password.' });
    return;
  }

  res.json({
    user: getPublicUserById(user.id),
    token: createAuthToken(user)
  });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: toPublicUser(req.user) });
});

app.get('/api/me/element-values', requireAuth, (req, res) => {
  res.json(getUserElementValues(req.user.id));
});

app.put('/api/me/element-values', requireAuth, (req, res) => {
  const values = normalizeElementValues(req.body?.values);

  if (!values) {
    res.status(400).json({ error: 'Body must contain values array.' });
    return;
  }

  try {
    res.json(upsertUserElementValues(req.user.id, values));
  } catch (error) {
    if (error?.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      res.status(400).json({ error: 'Unknown elementKey in values.' });
      return;
    }

    throw error;
  }
});

app.delete('/api/me/element-values', requireAuth, (req, res) => {
  resetUserElementValues(req.user.id);
  res.status(204).send();
});

app.delete('/api/me/element-values/:elementKey', requireAuth, (req, res) => {
  deleteUserElementValue(req.user.id, req.params.elementKey);
  res.status(204).send();
});

app.get('/api/me/calculator', requireAuth, (req, res) => {
  res.json(getCalculatorState(req.user.id));
});

app.put('/api/me/plan-items', requireAuth, (req, res) => {
  const items = normalizePlanItems(req.body?.items);

  if (!items) {
    res.status(400).json({ error: 'Invalid calculator plan items.' });
    return;
  }

  res.json(replaceUserPlanItems(req.user.id, items));
});

app.put('/api/me/speedup-allocation', requireAuth, (req, res) => {
  const speedups = normalizeSpeedupAllocation(req.body);

  if (!speedups) {
    res.status(400).json({ error: 'Invalid universal speedup allocation.' });
    return;
  }

  upsertUserElementValues(req.user.id, [
    {
      elementKey: 'universal-speedup',
      amount: speedups.totalMinutes
    }
  ]);
  res.json(getCalculatorState(req.user.id).speedups);
});

app.put('/api/me/training-plan', requireAuth, (req, res) => {
  const plan = normalizeTrainingPlan(req.body);

  if (!plan) {
    res.status(400).json({ error: 'Invalid training plan.' });
    return;
  }

  res.json(upsertUserTrainingPlan(req.user.id, plan));
});

app.get('/api/me/calculation', requireAuth, (req, res) => {
  res.json(calculateUserPlan(req.user.id));
});

app.delete('/api/me/calculator', requireAuth, (req, res) => {
  resetUserCalculator(req.user.id);
  res.status(204).send();
});

app.get('/api/event-context', (_req, res) => {
  const dictionary = getDictionary();

  res.json({
    name: 'Turbo Turtle / Турбочерепашка',
    timezone: 'Europe/Moscow',
    note: 'Коэффициенты очков нужно сверить с вашим сервером и текущим событием.',
    eventWindows,
    dictionary: {
      elementCount: dictionary.elements.length,
      ruleCount: dictionary.rules.length
    }
  });
});

app.get('/api/dictionaries', (_req, res) => {
  res.json(getDictionary());
});

app.get('/api/elements', (_req, res) => {
  res.json(getDictionary().elements);
});

app.get('/api/rules', (req, res) => {
  if (req.query.day) {
    res.json(getRulesByDay(req.query.day));
    return;
  }

  if (req.query.elementKey) {
    res.json(getRulesByElement(String(req.query.elementKey)));
    return;
  }

  res.json(getDictionary().rules);
});

app.post('/api/calculate', (req, res) => {
  const resources = normalizeNumberMap(req.body?.resources);
  const coefficients = normalizeNumberMap(req.body?.coefficients);

  const rows = Object.entries(resources).map(([key, amount]) => {
    const coefficient = coefficients[key] ?? 0;
    return {
      key,
      amount,
      coefficient,
      points: amount * coefficient
    };
  });

  const totalPoints = rows.reduce((sum, row) => sum + row.points, 0);

  res.json({ rows, totalPoints });
});

if (process.env.SKIP_LISTEN !== '1') {
  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
}

function requireAuth(req, res, next) {
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  const payload = verifyAuthToken(token);

  if (!payload) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  const user = getUserById(Number(payload.sub));

  if (!user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  req.user = user;
  next();
}

function toPublicUser(user) {
  return {
    id: user.id,
    username: user.username,
    gameNickname: user.gameNickname,
    createdAt: user.createdAt
  };
}

function normalizeElementValues(value) {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalized = [];

  for (const item of value) {
    const elementKey = String(item?.elementKey ?? '').trim();
    const amount = Number(item?.amount);
    if (!elementKey || !Number.isFinite(amount) || amount < 0) {
      return null;
    }

    normalized.push({ elementKey, amount });
  }

  return normalized;
}

function normalizePlanItems(value) {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalized = [];
  const allocations = new Set();
  const totalsByRule = new Map();

  for (const item of value) {
    const ruleKey = String(item?.ruleKey ?? '').trim();
    const amount = Number(item?.amount);
    const plannedAmount = Number(item?.plannedAmount);
    const universalAmount = Number(item?.universalAmount ?? 0);
    const day = Number(item?.day);
    const rule = getRuleByKey(ruleKey);

    if (
      !rule ||
      !rule.calculatorVisible ||
      allocations.has(`${ruleKey}:${day}`) ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      !Number.isFinite(plannedAmount) ||
      plannedAmount < 0 ||
      plannedAmount > amount ||
      !Number.isFinite(universalAmount) ||
      universalAmount < 0 ||
      (universalAmount > 0 && !['research-speedup-1-minute', 'construction-speedup-1-minute'].includes(ruleKey)) ||
      !Number.isInteger(day) ||
      !rule.days.includes(day)
    ) {
      return null;
    }

    const total = totalsByRule.get(ruleKey);

    if (total && total.amount !== amount) {
      return null;
    }

    allocations.add(`${ruleKey}:${day}`);
    totalsByRule.set(ruleKey, {
      amount,
      plannedAmount: (total?.plannedAmount ?? 0) + plannedAmount
    });
    normalized.push({ ruleKey, amount, plannedAmount, universalAmount, day });
  }

  if ([...totalsByRule.values()].some((item) => item.plannedAmount > item.amount)) {
    return null;
  }

  return normalized;
}

function normalizeSpeedupAllocation(value) {
  const totalMinutes = Number(value?.totalMinutes);

  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) {
    return null;
  }

  return { totalMinutes };
}

function normalizeTrainingPlan(value) {
  const plan = {
    enabled: value?.enabled,
    soldierLevel: Number(value?.soldierLevel),
    currentSoldiers: Number(value?.currentSoldiers),
    garrisonLimit: Number(value?.garrisonLimit),
    plannedSoldiers: Number(value?.plannedSoldiers),
    batchLimit: Number(value?.batchLimit),
    batchHours: Number(value?.batchHours),
    batchMinutes: Number(value?.batchMinutes),
    trainingSpeedupMinutes: Number(value?.trainingSpeedupMinutes),
    universalTrainingMinutes: Number(value?.universalTrainingMinutes ?? 0)
  };
  const values = Object.entries(plan)
    .filter(([key]) => key !== 'enabled')
    .map(([, number]) => number);
  const freeCapacity = plan.garrisonLimit - plan.currentSoldiers;
  const batchDuration = plan.batchHours * 60 + plan.batchMinutes;

  if (
    typeof plan.enabled !== 'boolean' ||
    !values.every((number) => Number.isInteger(number) && number >= 0) ||
    (plan.enabled &&
      (plan.soldierLevel < 1 ||
        plan.soldierLevel > 10 ||
        plan.garrisonLimit < plan.currentSoldiers ||
        plan.plannedSoldiers > freeCapacity ||
        plan.batchMinutes > 59 ||
        (plan.plannedSoldiers > 0 && (plan.batchLimit === 0 || batchDuration === 0))))
  ) {
    return null;
  }

  return plan;
}

function getCalculatorState(userId) {
  const universalValue = getUserElementValues(userId).find((item) => item.elementKey === 'universal-speedup');
  const planItems = getUserPlanItems(userId);
  const trainingPlan = getUserTrainingPlan(userId);
  const researchMinutes = sumUniversalMinutes(planItems, 'research-speedup-1-minute');
  const constructionMinutes = sumUniversalMinutes(planItems, 'construction-speedup-1-minute');
  const trainingMinutes = trainingPlan.enabled ? trainingPlan.universalTrainingMinutes : 0;

  return {
    planItems,
    speedups: {
      totalMinutes: universalValue?.amount ?? 0,
      researchMinutes,
      constructionMinutes,
      trainingMinutes,
      remainingMinutes: Math.max((universalValue?.amount ?? 0) - researchMinutes - constructionMinutes - trainingMinutes, 0)
    },
    trainingPlan,
    calculation: calculateUserPlan(userId)
  };
}

function sumUniversalMinutes(items, ruleKey) {
  return items
    .filter((item) => item.ruleKey === ruleKey)
    .reduce((sum, item) => sum + item.universalAmount, 0);
}

function normalizeNumberMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, rawValue]) => {
      const numberValue = Number(rawValue);
      return [key, Number.isFinite(numberValue) && numberValue > 0 ? numberValue : 0];
    })
  );
}
