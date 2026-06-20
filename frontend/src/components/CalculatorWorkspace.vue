<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { apiClient } from '../api/client.js';

const props = defineProps({
  user: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['logout']);

const elements = ref([]);
const rules = ref([]);
const planItems = ref([]);
const selectedRuleKey = ref('');
const ruleSearch = ref('');
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const savedMessage = ref('');

const speedups = reactive({
  totalMinutes: 0
});

const training = reactive({
  enabled: false,
  soldierLevel: 1,
  currentSoldiers: 0,
  garrisonLimit: 0,
  plannedSoldiers: 0,
  batchLimit: 0,
  batchHours: 0,
  batchMinutes: 0,
  trainingSpeedupMinutes: 0,
  universalTrainingMinutes: 0
});

const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const elementsByKey = computed(() => new Map(elements.value.map((element) => [element.key, element])));
const rulesByKey = computed(() => new Map(rules.value.map((rule) => [rule.key, rule])));
const selectedDaysByRule = computed(() => {
  const result = new Map();

  for (const item of planItems.value) {
    const days = result.get(item.ruleKey) ?? new Set();
    days.add(number(item.day));
    result.set(item.ruleKey, days);
  }

  return result;
});

const groupedRules = computed(() => {
  const query = ruleSearch.value.trim().toLocaleLowerCase('ru');
  const groups = new Map();

  for (const rule of rules.value.filter((item) => item.calculatorVisible !== false)) {
    if (availableDays(rule).length === 0) {
      continue;
    }

    const element = elementsByKey.value.get(rule.elementKey);
    const searchable = `${element?.name ?? ''} ${element?.category ?? ''} ${rule.action}`.toLocaleLowerCase('ru');

    if (query && !searchable.includes(query)) {
      continue;
    }

    const category = element?.category ?? 'Прочее';
    const group = groups.get(category) ?? [];
    group.push(rule);
    groups.set(category, group);
  }

  return [...groups.entries()].map(([category, groupRules]) => ({ category, rules: groupRules }));
});
const trainingOptionVisible = computed(() => {
  if (training.enabled) {
    return false;
  }
  const query = ruleSearch.value.trim().toLocaleLowerCase('ru');
  return !query || 'обучение солдат казарма войска'.includes(query);
});
const hasPlanEntries = computed(() => planItems.value.length > 0 || training.enabled);

const universalResearchMinutes = computed(() => universalMinutesForRule('research-speedup-1-minute'));
const universalConstructionMinutes = computed(() => universalMinutesForRule('construction-speedup-1-minute'));
const universalTrainingMinutes = computed(() => training.enabled ? number(training.universalTrainingMinutes) : 0);
const universalAllocated = computed(
  () => universalResearchMinutes.value + universalConstructionMinutes.value + universalTrainingMinutes.value
);
const universalRemaining = computed(() => number(speedups.totalMinutes) - universalAllocated.value);
const allocationInvalid = computed(() => universalRemaining.value < 0);
const trainingRule = computed(() => rulesByKey.value.get(`soldier-level-${number(training.soldierLevel)}-train`));
const trainingFreeCapacity = computed(() =>
  Math.max(number(training.garrisonLimit) - number(training.currentSoldiers), 0)
);
const trainingBatchDuration = computed(() =>
  number(training.batchHours) * 60 + number(training.batchMinutes)
);
const trainingRequiredMinutes = computed(() => {
  if (number(training.plannedSoldiers) === 0 || number(training.batchLimit) === 0) {
    return 0;
  }
  return Math.ceil(
    (number(training.plannedSoldiers) / number(training.batchLimit)) * trainingBatchDuration.value
  );
});
const trainingAvailableMinutes = computed(
  () => number(training.trainingSpeedupMinutes) + universalTrainingMinutes.value
);
const trainingCompletedSoldiers = computed(() => {
  if (trainingBatchDuration.value === 0 || number(training.batchLimit) === 0) {
    return 0;
  }
  const bySpeedups = Math.floor(
    (trainingAvailableMinutes.value * number(training.batchLimit)) / trainingBatchDuration.value
  );
  return Math.min(number(training.plannedSoldiers), trainingFreeCapacity.value, bySpeedups);
});
const trainingPoints = computed(
  () => (training.enabled ? trainingCompletedSoldiers.value * (trainingRule.value?.points ?? 0) : 0)
);
const trainingMissingMinutes = computed(() =>
  Math.max(trainingRequiredMinutes.value - trainingAvailableMinutes.value, 0)
);
const trainingQueues = computed(() =>
  number(training.plannedSoldiers) > 0 && number(training.batchLimit) > 0
    ? Math.ceil(number(training.plannedSoldiers) / number(training.batchLimit))
    : 0
);
const trainingStatus = computed(() => {
  if (number(training.plannedSoldiers) === 0) {
    return { text: 'План не задан', warning: false };
  }
  if (trainingMissingMinutes.value > 0) {
    return { text: `Не хватает ${formatPoints(trainingMissingMinutes.value)} мин.`, warning: true };
  }
  return { text: 'Ускорений хватает', warning: false };
});
const trainingInvalid = computed(() => {
  if (!training.enabled) {
    return false;
  }
  const integerValues = [
    training.soldierLevel,
    training.currentSoldiers,
    training.garrisonLimit,
    training.plannedSoldiers,
    training.batchLimit,
    training.batchHours,
    training.batchMinutes,
    training.trainingSpeedupMinutes
  ].map(number);

  return (
    integerValues.some((value) => !Number.isInteger(value) || value < 0) ||
    number(training.soldierLevel) < 1 ||
    number(training.soldierLevel) > 10 ||
    number(training.garrisonLimit) < number(training.currentSoldiers) ||
    number(training.plannedSoldiers) > trainingFreeCapacity.value ||
    number(training.batchMinutes) > 59 ||
    (number(training.plannedSoldiers) > 0 &&
      (number(training.batchLimit) === 0 || trainingBatchDuration.value === 0))
  );
});

const liveTotal = computed(() => {
  const resourcePoints = planItems.value.reduce((sum, item) => sum + plannedPoints(item), 0);
  return resourcePoints + trainingPoints.value;
});

const totalsByDay = computed(() => {
  const totals = Array.from({ length: 7 }, (_, index) => ({ day: index + 1, points: 0 }));

  for (const item of planItems.value) {
    const day = number(item.day);
    if (day >= 1 && day <= 7) {
      totals[day - 1].points += plannedPoints(item);
    }
  }

  totals[0].points += trainingPoints.value;
  return totals;
});

const planInvalid = computed(() => {
  const allocations = new Set();
  const totalsByRule = new Map();

  for (const item of planItems.value) {
    const rule = rulesByKey.value.get(item.ruleKey);
    const allocationKey = `${item.ruleKey}:${number(item.day)}`;
    const total = totalsByRule.get(item.ruleKey) ?? {
      amount: number(item.amount),
      plannedAmount: 0
    };

    if (
      number(item.amount) < 0 ||
      number(item.plannedAmount) < 0 ||
      number(item.universalAmount) < 0 ||
      (!supportsUniversalSpeedups(item) && number(item.universalAmount) > 0) ||
      total.amount !== number(item.amount) ||
      !rule?.days.includes(number(item.day)) ||
      allocations.has(allocationKey)
    ) {
      return true;
    }

    allocations.add(allocationKey);
    total.plannedAmount += number(item.plannedAmount);
    totalsByRule.set(item.ruleKey, total);
  }

  return [...totalsByRule.values()].some((item) => item.plannedAmount > item.amount);
});

const canSave = computed(
  () => !allocationInvalid.value && !planInvalid.value && !trainingInvalid.value && !saving.value
);

onMounted(loadWorkspace);

async function loadWorkspace() {
  loading.value = true;
  error.value = '';

  try {
    const [{ data: dictionary }, { data: state }] = await Promise.all([
      apiClient.get('/api/dictionaries'),
      apiClient.get('/api/me/calculator')
    ]);
    elements.value = dictionary.elements;
    rules.value = dictionary.rules;
    planItems.value = state.planItems
      .filter((item) => rulesByKey.value.get(item.ruleKey)?.calculatorVisible !== false)
      .map((item) => ({ ...item, universalAmount: item.universalAmount ?? 0 }));
    speedups.totalMinutes = state.speedups.totalMinutes;
    Object.assign(training, state.trainingPlan);
  } catch (requestError) {
    if (requestError.response?.status === 401) {
      emit('logout');
      return;
    }
    error.value = 'Не удалось загрузить данные калькулятора.';
  } finally {
    loading.value = false;
  }
}

function addSelectedRule() {
  if (selectedRuleKey.value === '__training__') {
    training.enabled = true;
    selectedRuleKey.value = '';
    ruleSearch.value = '';
    savedMessage.value = '';
    return;
  }

  const rule = rulesByKey.value.get(selectedRuleKey.value);

  if (!appendRule(rule)) {
    return;
  }
  selectedRuleKey.value = '';
  ruleSearch.value = '';
}

function addAnotherDay(ruleKey) {
  appendRule(rulesByKey.value.get(ruleKey));
}

function appendRule(rule) {
  const days = rule ? availableDays(rule) : [];

  if (!rule || days.length === 0) {
    return false;
  }

  const existing = planItems.value.find((item) => item.ruleKey === rule.key);

  planItems.value.push({
    ruleKey: rule.key,
    amount: existing?.amount ?? 0,
    plannedAmount: 0,
    universalAmount: 0,
    day: days[0]
  });
  savedMessage.value = '';
  return true;
}

function removeItem(target) {
  planItems.value = planItems.value.filter((item) => item !== target);
  savedMessage.value = '';
}

function removeTrainingPlan() {
  training.enabled = false;
  training.universalTrainingMinutes = 0;
  savedMessage.value = '';
}

function sendUniversalRemainderTo(ruleKey) {
  const remainder = universalRemaining.value;

  if (remainder <= 0) {
    return;
  }

  let target = null;

  for (let index = planItems.value.length - 1; index >= 0; index -= 1) {
    if (planItems.value[index].ruleKey === ruleKey) {
      target = planItems.value[index];
      break;
    }
  }

  if (!target) {
    const rule = rulesByKey.value.get(ruleKey);
    const appended = appendRule(rule);

    if (!appended) {
      return;
    }

    target = planItems.value.at(-1);
  }

  target.universalAmount = number(target.universalAmount) + remainder;
  savedMessage.value = '';
}

function availableDays(rule, currentItem = null) {
  const selectedDays = selectedDaysByRule.value.get(rule.key) ?? new Set();
  return rule.days.filter((day) => day === number(currentItem?.day) || !selectedDays.has(day));
}

function updateSharedField(ruleKey, field, value) {
  for (const item of planItems.value) {
    if (item.ruleKey === ruleKey) {
      item[field] = value;
    }
  }
  savedMessage.value = '';
}

function plannedForRule(ruleKey) {
  return planItems.value
    .filter((item) => item.ruleKey === ruleKey)
    .reduce((sum, item) => sum + number(item.plannedAmount), 0);
}

function remainingForRule(item) {
  return number(item.amount) - plannedForRule(item.ruleKey);
}

async function saveCalculator() {
  if (!canSave.value) {
    return;
  }

  saving.value = true;
  error.value = '';
  savedMessage.value = '';

  try {
    await apiClient.put('/api/me/plan-items', {
      items: planItems.value.map((item) => ({
        ruleKey: item.ruleKey,
        amount: number(item.amount),
        plannedAmount: number(item.plannedAmount),
        universalAmount: number(item.universalAmount),
        day: number(item.day)
      }))
    });
    await apiClient.put('/api/me/speedup-allocation', normalizedSpeedups());
    await apiClient.put('/api/me/training-plan', normalizedTrainingPlan());
    savedMessage.value = 'Запасы и план сохранены';
  } catch (requestError) {
    error.value = requestError.response?.data?.error ?? 'Не удалось сохранить калькулятор.';
  } finally {
    saving.value = false;
  }
}

async function resetCalculator() {
  if (!window.confirm('Сбросить все запасы, план и распределение ускорений?')) {
    return;
  }

  try {
    await apiClient.delete('/api/me/calculator');
    planItems.value = [];
    Object.assign(speedups, {
      totalMinutes: 0
    });
    Object.assign(training, {
      enabled: false,
      soldierLevel: 1,
      currentSoldiers: 0,
      garrisonLimit: 0,
      plannedSoldiers: 0,
      batchLimit: 0,
      batchHours: 0,
      batchMinutes: 0,
      trainingSpeedupMinutes: 0,
      universalTrainingMinutes: 0
    });
    savedMessage.value = 'Калькулятор сброшен';
  } catch {
    error.value = 'Не удалось сбросить данные.';
  }
}

function normalizedSpeedups() {
  return {
    totalMinutes: number(speedups.totalMinutes)
  };
}

function normalizedTrainingPlan() {
  return {
    enabled: Boolean(training.enabled),
    soldierLevel: number(training.soldierLevel),
    currentSoldiers: number(training.currentSoldiers),
    garrisonLimit: number(training.garrisonLimit),
    plannedSoldiers: number(training.plannedSoldiers),
    batchLimit: number(training.batchLimit),
    batchHours: number(training.batchHours),
    batchMinutes: number(training.batchMinutes),
    trainingSpeedupMinutes: number(training.trainingSpeedupMinutes),
    universalTrainingMinutes: number(training.universalTrainingMinutes)
  };
}

function ruleFor(item) {
  return rulesByKey.value.get(item.ruleKey);
}

function elementFor(item) {
  const rule = ruleFor(item);
  return rule ? elementsByKey.value.get(rule.elementKey) : null;
}

function ruleLabel(rule) {
  const element = elementsByKey.value.get(rule.elementKey);
  const tier = element?.tier ? ` T${element.tier}` : '';
  return `${element?.name ?? rule.elementKey}${tier} · ${rule.points.toLocaleString('ru-RU')} очк.`;
}

function plannedPoints(item) {
  return (number(item.plannedAmount) + number(item.universalAmount)) * (ruleFor(item)?.points ?? 0);
}

function supportsUniversalSpeedups(item) {
  return ['research-speedup-1-minute', 'construction-speedup-1-minute'].includes(item.ruleKey);
}

function universalMinutesForRule(ruleKey) {
  return planItems.value
    .filter((item) => item.ruleKey === ruleKey)
    .reduce((sum, item) => sum + number(item.universalAmount), 0);
}

function number(value) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function formatPoints(value) {
  return number(value).toLocaleString('ru-RU');
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="app-brand">
        <span class="app-brand__mark">TS</span>
        <div>
          <strong>Турбочерепашка</strong>
          <span>Планировщик недели</span>
        </div>
      </div>
      <div class="user-menu">
        <span>{{ props.user.gameNickname ?? props.user.username }}</span>
        <UButton color="neutral" icon="i-lucide-log-out" variant="ghost" @click="emit('logout')" />
      </div>
    </header>

    <main v-if="loading" class="workspace-loading">
      <UIcon name="i-lucide-loader-circle" />
      <span>Загружаю запасы</span>
    </main>

    <main v-else class="workspace">
      <section class="workspace-main">
        <div class="section-heading">
          <div>
            <p>Мои запасы</p>
            <h1>Соберите план из своих ресурсов</h1>
          </div>
          <UButton color="error" icon="i-lucide-rotate-ccw" variant="soft" @click="resetCalculator">
            Сбросить
          </UButton>
        </div>

        <section class="resource-picker">
          <div class="resource-picker__search">
            <UIcon name="i-lucide-search" />
            <input v-model="ruleSearch" placeholder="Найти ресурс или действие" type="search" />
          </div>
          <select v-model="selectedRuleKey" aria-label="Выберите ресурс">
            <option value="">Выберите ресурс</option>
            <optgroup v-if="trainingOptionVisible" label="Войска">
              <option value="__training__">Обучение солдат · расчёт по казарме</option>
            </optgroup>
            <optgroup v-for="group in groupedRules" :key="group.category" :label="group.category">
              <option v-for="rule in group.rules" :key="rule.key" :value="rule.key">
                {{ ruleLabel(rule) }}
              </option>
            </optgroup>
          </select>
          <UButton icon="i-lucide-plus" :disabled="!selectedRuleKey" @click="addSelectedRule">
            Добавить
          </UButton>
        </section>

        <div v-if="hasPlanEntries" class="resource-list">
          <article v-for="item in planItems" :key="`${item.ruleKey}:${item.day}`" class="resource-row">
            <div class="resource-identity">
              <div
                class="resource-icon"
                :style="{ color: elementFor(item)?.colorHex ?? '#2f6f55' }"
              >
                <img :src="elementFor(item)?.icon" alt="" />
              </div>
              <div>
                <div class="resource-name">
                  <strong>{{ elementFor(item)?.name }}</strong>
                  <span
                    v-if="elementFor(item)?.tier"
                    class="tier-badge"
                    :style="{ borderColor: elementFor(item)?.colorHex, color: elementFor(item)?.colorHex }"
                  >
                    T{{ elementFor(item)?.tier }} · {{ elementFor(item)?.colorName }}
                  </span>
                </div>
                <p>{{ ruleFor(item)?.action }}</p>
                <small>{{ formatPoints(ruleFor(item)?.points) }} очков за единицу</small>
              </div>
            </div>

            <div :class="['resource-fields', { 'resource-fields--universal': supportsUniversalSpeedups(item) }]">
              <label>
                <span>Общий запас</span>
                <UInput
                  :model-value="item.amount"
                  min="0"
                  type="number"
                  @update:model-value="updateSharedField(item.ruleKey, 'amount', $event)"
                />
              </label>
              <label>
                <span>Потратить</span>
                <UInput
                  v-model="item.plannedAmount"
                  :max="number(item.plannedAmount) + Math.max(remainingForRule(item), 0)"
                  min="0"
                  type="number"
                />
              </label>
              <label v-if="supportsUniversalSpeedups(item)">
                <span>Из универсальных ускорений (минуты)</span>
                <UInput v-model="item.universalAmount" min="0" type="number" />
              </label>
              <label>
                <span>День</span>
                <select v-model.number="item.day">
                  <option v-for="day in availableDays(ruleFor(item), item)" :key="day" :value="day">
                    {{ dayNames[day - 1] }} · день {{ day }}
                  </option>
                </select>
              </label>
            </div>

            <div class="resource-result">
              <span>В план</span>
              <strong>{{ formatPoints(plannedPoints(item)) }}</strong>
              <small>очков</small>
              <small>Остаток: {{ formatPoints(remainingForRule(item)) }}</small>
            </div>

            <div class="resource-actions">
              <UButton
                aria-label="Добавить этот ресурс на другой день"
                color="neutral"
                icon="i-lucide-calendar-plus"
                title="Добавить на другой день"
                variant="soft"
                :disabled="availableDays(ruleFor(item)).length === 0"
                @click="addAnotherDay(item.ruleKey)"
              />
              <UButton
                aria-label="Удалить ресурс"
                color="neutral"
                icon="i-lucide-trash-2"
                title="Удалить эту строку"
                variant="ghost"
                @click="removeItem(item)"
              />
            </div>
          </article>

          <article v-if="training.enabled" class="training-planner training-planner--plan">
            <div class="training-planner__heading">
              <div>
                <p>Казарма</p>
                <h3>Обучение солдат</h3>
              </div>
              <div class="training-heading-actions">
                <span :class="['training-status', { 'training-status--warning': trainingStatus.warning }]">
                  {{ trainingStatus.text }}
                </span>
                <UButton
                  aria-label="Удалить обучение из плана"
                  color="neutral"
                  icon="i-lucide-trash-2"
                  title="Удалить обучение из плана"
                  variant="ghost"
                  @click="removeTrainingPlan"
                />
              </div>
            </div>

            <div class="training-fields">
              <label>
                <span>Уровень солдат</span>
                <select v-model.number="training.soldierLevel">
                  <option v-for="level in 10" :key="level" :value="level">Уровень {{ level }}</option>
                </select>
              </label>
              <label>
                <span>Сейчас в гарнизоне</span>
                <UInput v-model="training.currentSoldiers" min="0" step="1" type="number" />
              </label>
              <label>
                <span>Лимит гарнизона</span>
                <UInput v-model="training.garrisonLimit" min="0" step="1" type="number" />
              </label>
              <label>
                <span>Обучить солдат</span>
                <UInput
                  v-model="training.plannedSoldiers"
                  :max="trainingFreeCapacity"
                  min="0"
                  step="1"
                  type="number"
                />
              </label>
              <label>
                <span>Лимит обучения казармы</span>
                <UInput v-model="training.batchLimit" min="1" step="1" type="number" />
              </label>
              <label>
                <span>Часы полной очереди</span>
                <UInput v-model="training.batchHours" min="0" step="1" type="number" />
              </label>
              <label>
                <span>Минуты полной очереди</span>
                <UInput v-model="training.batchMinutes" max="59" min="0" step="1" type="number" />
              </label>
              <label>
                <span>Ускорения обучения (минуты)</span>
                <UInput v-model="training.trainingSpeedupMinutes" min="0" step="1" type="number" />
              </label>
              <label>
                <span>Из универсальных ускорений (минуты)</span>
                <UInput v-model="training.universalTrainingMinutes" min="0" step="1" type="number" />
              </label>
            </div>

            <div class="training-actions">
              <UButton
                color="neutral"
                icon="i-lucide-users"
                size="sm"
                variant="soft"
                @click="training.plannedSoldiers = trainingFreeCapacity"
              >
                Заполнить гарнизон
              </UButton>
            </div>

            <div class="training-results">
              <div><span>Свободно мест</span><strong>{{ formatPoints(trainingFreeCapacity) }}</strong></div>
              <div><span>Очередей</span><strong>{{ formatPoints(trainingQueues) }}</strong></div>
              <div><span>Нужно минут</span><strong>{{ formatPoints(trainingRequiredMinutes) }}</strong></div>
              <div><span>Доступно минут</span><strong>{{ formatPoints(trainingAvailableMinutes) }}</strong></div>
              <div><span>Гарантированно солдат</span><strong>{{ formatPoints(trainingCompletedSoldiers) }}</strong></div>
              <div><span>Очки в понедельник</span><strong>{{ formatPoints(trainingPoints) }}</strong></div>
            </div>

            <p v-if="trainingInvalid" class="form-error">
              Проверьте вместимость гарнизона, размер и время полной очереди.
            </p>
          </article>
        </div>
        <div v-else class="empty-state">
          <UIcon name="i-lucide-package-plus" />
          <strong>План пока пуст</strong>
          <span>Добавьте только те ресурсы, которые есть у вас в запасе.</span>
        </div>

        <section class="speedup-section">
          <div class="speedup-heading">
            <div>
              <p>Общий пул</p>
              <h2>Универсальные ускорения</h2>
            </div>
            <div :class="['remaining-badge', { 'remaining-badge--error': allocationInvalid }]">
              Остаток: {{ formatPoints(universalRemaining) }} мин.
            </div>
          </div>

          <div class="speedup-stock">
            <label>
              <span>Всего ускорений (минуты)</span>
              <UInput v-model="speedups.totalMinutes" min="0" type="number" />
            </label>
            <div class="speedup-quick-actions">
              <UButton
                color="neutral"
                icon="i-lucide-hard-hat"
                size="sm"
                variant="soft"
                :disabled="universalRemaining <= 0"
                @click="sendUniversalRemainderTo('construction-speedup-1-minute')"
              >
                Остаток в стройку
              </UButton>
              <UButton
                color="neutral"
                icon="i-lucide-flask-conical"
                size="sm"
                variant="soft"
                :disabled="universalRemaining <= 0"
                @click="sendUniversalRemainderTo('research-speedup-1-minute')"
              >
                Остаток в исследования
              </UButton>
            </div>
          </div>

          <div class="universal-breakdown">
            <div><span>Исследования</span><strong>{{ formatPoints(universalResearchMinutes) }} мин.</strong></div>
            <div><span>Строительство</span><strong>{{ formatPoints(universalConstructionMinutes) }} мин.</strong></div>
            <div><span>Обучение</span><strong>{{ formatPoints(universalTrainingMinutes) }} мин.</strong></div>
          </div>

          <p v-if="allocationInvalid" class="form-error">
            Распределено больше универсальных минут, чем есть в запасе.
          </p>
        </section>
      </section>

      <aside class="summary-panel">
        <div class="summary-total">
          <span>План недели</span>
          <strong>{{ formatPoints(liveTotal) }}</strong>
          <small>очков</small>
        </div>

        <div class="day-summary">
          <div v-for="item in totalsByDay" :key="item.day">
            <span>{{ dayNames[item.day - 1] }}</span>
            <strong>{{ formatPoints(item.points) }}</strong>
          </div>
        </div>

        <div class="summary-meta">
          <span>Ресурсов в плане</span>
          <strong>{{ planItems.length + (training.enabled ? 1 : 0) }}</strong>
          <span>Универсальных распределено</span>
          <strong>{{ formatPoints(universalAllocated) }} мин.</strong>
        </div>

        <p v-if="planInvalid" class="form-error">Планируемая трата не может превышать запас.</p>
        <p v-if="error" class="form-error">{{ error }}</p>
        <p v-if="savedMessage" class="save-message">{{ savedMessage }}</p>

        <UButton
          block
          icon="i-lucide-save"
          :disabled="!canSave"
          :loading="saving"
          size="xl"
          @click="saveCalculator"
        >
          Сохранить и рассчитать
        </UButton>
      </aside>
    </main>
  </div>
</template>
