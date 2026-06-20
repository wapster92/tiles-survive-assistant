<script setup>
import { onMounted, ref } from 'vue';
import { apiClient } from './api/client.js';
import CalculatorWorkspace from './components/CalculatorWorkspace.vue';
import LoginPanel from './components/LoginPanel.vue';

const user = ref(null);
const checkingSession = ref(true);

onMounted(async () => {
  if (!localStorage.getItem('authToken')) {
    checkingSession.value = false;
    return;
  }

  try {
    const { data } = await apiClient.get('/api/me');
    user.value = data.user;
  } catch {
    localStorage.removeItem('authToken');
  } finally {
    checkingSession.value = false;
  }
});

function handleAuthenticated(payload) {
  localStorage.setItem('authToken', payload.token);
  user.value = payload.user;
}

function logout() {
  localStorage.removeItem('authToken');
  user.value = null;
}
</script>

<template>
  <UApp>
    <div v-if="checkingSession" class="session-loader">
      <UIcon class="session-loader__icon" name="i-lucide-loader-circle" />
    </div>
    <LoginPanel v-else-if="!user" @authenticated="handleAuthenticated" />
    <CalculatorWorkspace v-else :user="user" @logout="logout" />
  </UApp>
</template>
