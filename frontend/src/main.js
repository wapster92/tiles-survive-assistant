import ui from '@nuxt/ui/vue-plugin';
import { MotionPlugin } from '@vueuse/motion';
import { createApp } from 'vue';
import App from './App.vue';
import router from './router.js';
import './styles.css';

document.documentElement.classList.add('dark');
document.documentElement.style.colorScheme = 'dark';

createApp(App).use(router).use(ui).use(MotionPlugin).mount('#app');
