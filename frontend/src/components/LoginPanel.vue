<script setup>
import { ref, watch } from 'vue';
import { apiClient } from '../api/client.js';

const emit = defineEmits(['authenticated']);

const mode = ref('login');
const username = ref('root');
const password = ref('0000');
const registerUsername = ref('');
const registerPassword = ref('');
const gameNickname = ref('');
const gameNicknameTouched = ref(false);
const loading = ref(false);
const error = ref('');
const panelMotion = {
  initial: { opacity: 0, y: 14 },
  enter: { opacity: 1, y: 0, transition: { duration: 360 } }
};

watch(registerUsername, (value) => {
  if (!gameNicknameTouched.value) {
    gameNickname.value = value;
  }
});

function switchMode(nextMode) {
  mode.value = nextMode;
  error.value = '';
}

async function login() {
  loading.value = true;
  error.value = '';

  try {
    const { data } = await apiClient.post('/api/auth/login', {
      username: username.value,
      password: password.value
    });
    emit('authenticated', data);
  } catch (requestError) {
    error.value = requestError.response?.data?.error ?? 'Не удалось войти в аккаунт.';
  } finally {
    loading.value = false;
  }
}

async function register() {
  loading.value = true;
  error.value = '';

  try {
    const { data } = await apiClient.post('/api/auth/register', {
      username: registerUsername.value,
      password: registerPassword.value,
      gameNickname: gameNickname.value || registerUsername.value
    });
    emit('authenticated', data);
  } catch (requestError) {
    error.value = requestError.response?.data?.error ?? 'Не удалось создать аккаунт.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="login-shell">
    <section
      v-motion="panelMotion"
      class="login-panel"
    >
      <div class="login-brand">
        <span class="login-brand__mark">TS</span>
        <div>
          <p>Turbo Turtle</p>
          <h1>Планировщик очков</h1>
        </div>
      </div>

      <div class="auth-tabs" role="tablist" aria-label="Авторизация">
        <button
          :aria-selected="mode === 'login'"
          :class="{ 'auth-tabs__button--active': mode === 'login' }"
          role="tab"
          type="button"
          @click="switchMode('login')"
        >
          <UIcon name="i-lucide-log-in" />
          Вход
        </button>
        <button
          :aria-selected="mode === 'register'"
          :class="{ 'auth-tabs__button--active': mode === 'register' }"
          role="tab"
          type="button"
          @click="switchMode('register')"
        >
          <UIcon name="i-lucide-user-plus" />
          Регистрация
        </button>
      </div>

      <form v-if="mode === 'login'" class="login-form" @submit.prevent="login">
        <label>
          <span>Имя пользователя</span>
          <UInput v-model="username" autocomplete="username" icon="i-lucide-user" size="xl" />
        </label>
        <label>
          <span>Пароль</span>
          <UInput
            v-model="password"
            autocomplete="current-password"
            icon="i-lucide-lock-keyhole"
            size="xl"
            type="password"
          />
        </label>

        <p v-if="error" class="form-error">{{ error }}</p>

        <UButton block icon="i-lucide-log-in" :loading="loading" size="xl" type="submit">
          Войти
        </UButton>
      </form>

      <form v-else class="login-form" @submit.prevent="register">
        <label>
          <span>Имя пользователя</span>
          <UInput v-model="registerUsername" autocomplete="username" icon="i-lucide-user" size="xl" />
        </label>
        <label>
          <span>Ник в игре</span>
          <UInput
            v-model="gameNickname"
            autocomplete="nickname"
            icon="i-lucide-gamepad-2"
            size="xl"
            @update:model-value="gameNicknameTouched = true"
          />
        </label>
        <label>
          <span>Пароль</span>
          <UInput
            v-model="registerPassword"
            autocomplete="new-password"
            icon="i-lucide-lock-keyhole"
            size="xl"
            type="password"
          />
        </label>

        <p v-if="error" class="form-error">{{ error }}</p>

        <UButton block icon="i-lucide-user-plus" :loading="loading" size="xl" type="submit">
          Создать аккаунт
        </UButton>
      </form>
    </section>
  </main>
</template>
