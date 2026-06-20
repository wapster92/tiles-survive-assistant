import {
  getDictionary,
  getUserElementValues,
  getUserPlanItems,
  getUserTrainingPlan
} from './db/index.js';

const universalSpeedupKey = 'universal-speedup';
const researchRuleKey = 'research-speedup-1-minute';
const constructionRuleKey = 'construction-speedup-1-minute';

export function calculateUserPlan(userId) {
  const dictionary = getDictionary();
  const rulesByKey = new Map(dictionary.rules.map((rule) => [rule.key, rule]));
  const elementsByKey = new Map(dictionary.elements.map((element) => [element.key, element]));
  const planItems = getUserPlanItems(userId);
  const rows = [];

  for (const item of planItems) {
    const rule = rulesByKey.get(item.ruleKey);
    const element = rule ? elementsByKey.get(rule.elementKey) : null;

    if (!rule?.calculatorVisible || !element) {
      continue;
    }

    rows.push({
      source: 'resource',
      ruleKey: rule.key,
      elementKey: element.key,
      name: element.name,
      action: rule.action,
      icon: element.icon,
      tier: element.tier,
      colorName: element.colorName,
      colorHex: element.colorHex,
      amount: item.amount,
      plannedAmount: item.plannedAmount,
      pointsPerUnit: rule.points,
      points: item.plannedAmount * rule.points,
      day: item.day
    });

    if (item.universalAmount > 0) {
      rows.push({
        source: 'universal-resource',
        ruleKey: rule.key,
        elementKey: universalSpeedupKey,
        name: `Универсальные ускорения: ${element.name}`,
        action: rule.action,
        icon: elementsByKey.get(universalSpeedupKey)?.icon ?? '',
        tier: null,
        colorName: null,
        colorHex: null,
        amount: item.universalAmount,
        plannedAmount: item.universalAmount,
        pointsPerUnit: rule.points,
        points: item.universalAmount * rule.points,
        day: item.day
      });
    }
  }

  const trainingPlan = getUserTrainingPlan(userId);
  const speedups = buildUniversalSpeedupResult(userId, planItems, trainingPlan, rulesByKey);
  const training = buildTrainingResult(userId, rulesByKey, elementsByKey, speedups.summary.trainingMinutes);
  rows.push(...training.rows);

  const totalsByDay = Array.from({ length: 7 }, (_, index) => ({ day: index + 1, points: 0 }));

  for (const row of rows) {
    if (row.day >= 1 && row.day <= 7) {
      totalsByDay[row.day - 1].points += row.points;
    }
  }

  return {
    rows,
    totalPoints: rows.reduce((sum, row) => sum + row.points, 0),
    totalsByDay,
    universalSpeedups: speedups.summary,
    trainingPlan: training.summary
  };
}

function buildTrainingResult(userId, rulesByKey, elementsByKey, universalTrainingMinutes) {
  const plan = getUserTrainingPlan(userId);
  if (!plan.enabled) {
    return {
      rows: [],
      summary: {
        ...plan,
        freeCapacity: Math.max(plan.garrisonLimit - plan.currentSoldiers, 0),
        batchDurationMinutes: plan.batchHours * 60 + plan.batchMinutes,
        requiredMinutes: 0,
        dedicatedTrainingMinutes: plan.trainingSpeedupMinutes,
        universalTrainingMinutes,
        availableSpeedupMinutes: plan.trainingSpeedupMinutes + universalTrainingMinutes,
        completedSoldiers: 0,
        missingMinutes: 0,
        remainingSpeedupMinutes: plan.trainingSpeedupMinutes + universalTrainingMinutes,
        queues: 0,
        pointsPerUnit: 0,
        points: 0
      }
    };
  }
  const rule = rulesByKey.get(`soldier-level-${plan.soldierLevel}-train`);
  const element = rule ? elementsByKey.get(rule.elementKey) : null;
  const freeCapacity = Math.max(plan.garrisonLimit - plan.currentSoldiers, 0);
  const batchDurationMinutes = plan.batchHours * 60 + plan.batchMinutes;
  const availableSpeedupMinutes = plan.trainingSpeedupMinutes + universalTrainingMinutes;
  const requiredMinutes =
    plan.plannedSoldiers > 0 && plan.batchLimit > 0
      ? Math.ceil((plan.plannedSoldiers / plan.batchLimit) * batchDurationMinutes)
      : 0;
  const speedupCapacity =
    batchDurationMinutes > 0 && plan.batchLimit > 0
      ? Math.floor((availableSpeedupMinutes * plan.batchLimit) / batchDurationMinutes)
      : 0;
  const completedSoldiers = Math.min(plan.plannedSoldiers, freeCapacity, speedupCapacity);
  const pointsPerUnit = rule?.points ?? 0;
  const rows = [];

  if (completedSoldiers > 0 && rule && element) {
    rows.push({
      source: 'training',
      ruleKey: rule.key,
      elementKey: element.key,
      name: element.name,
      action: rule.action,
      icon: element.icon,
      tier: null,
      colorName: null,
      colorHex: null,
      amount: freeCapacity,
      plannedAmount: completedSoldiers,
      pointsPerUnit,
      points: completedSoldiers * pointsPerUnit,
      day: 1
    });
  }

  return {
    rows,
    summary: {
      ...plan,
      freeCapacity,
      batchDurationMinutes,
      requiredMinutes,
      dedicatedTrainingMinutes: plan.trainingSpeedupMinutes,
      universalTrainingMinutes,
      availableSpeedupMinutes,
      completedSoldiers,
      missingMinutes: Math.max(requiredMinutes - availableSpeedupMinutes, 0),
      remainingSpeedupMinutes: Math.max(availableSpeedupMinutes - requiredMinutes, 0),
      queues: plan.plannedSoldiers > 0 && plan.batchLimit > 0 ? Math.ceil(plan.plannedSoldiers / plan.batchLimit) : 0,
      pointsPerUnit,
      points: completedSoldiers * pointsPerUnit
    }
  };
}

function buildUniversalSpeedupResult(userId, planItems, trainingPlan, rulesByKey) {
  const value = getUserElementValues(userId).find((item) => item.elementKey === universalSpeedupKey);
  const totalMinutes = value?.amount ?? 0;
  const researchMinutes = sumUniversalMinutes(planItems, researchRuleKey);
  const constructionMinutes = sumUniversalMinutes(planItems, constructionRuleKey);
  const trainingMinutes = trainingPlan.enabled ? trainingPlan.universalTrainingMinutes : 0;
  const allocatedMinutes = researchMinutes + constructionMinutes + trainingMinutes;

  return {
    summary: {
      totalMinutes,
      researchMinutes,
      constructionMinutes,
      trainingMinutes,
      remainingMinutes: Math.max(totalMinutes - allocatedMinutes, 0),
      points: planItems.reduce((sum, item) => {
        if (![researchRuleKey, constructionRuleKey].includes(item.ruleKey)) return sum;
        const rule = rulesByKey.get(item.ruleKey);
        return sum + item.universalAmount * (rule?.points ?? 0);
      }, 0)
    }
  };
}

function sumUniversalMinutes(items, ruleKey) {
  return items
    .filter((item) => item.ruleKey === ruleKey)
    .reduce((sum, item) => sum + item.universalAmount, 0);
}
