import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const backendUrl = env.BACKEND_URL || env.VITE_API_BASE_URL || 'http://localhost:8081';
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
        },
        '/auth': {
          target: backendUrl,
          changeOrigin: true,
        },
        /** OSM geocode — brauzerdə birbaşa CORS problemi zamanı localhost üçün */
        '/geo-nominatim': {
          target: 'https://nominatim.openstreetmap.org',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/geo-nominatim/, ''),
        },
      },
    },
  };
});
