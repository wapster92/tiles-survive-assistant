import ui from '@nuxt/ui/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const backendUrl = process.env.VITE_DEV_API_URL ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [vue(), ui()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': backendUrl,
      '/api-docs': backendUrl,
      '/health': backendUrl,
      '/openapi.json': backendUrl
    }
  }
});
