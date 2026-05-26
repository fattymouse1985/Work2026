import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: '/Work2026/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    define: {
      'import.meta.env.VITE_GIST_ID': JSON.stringify(process.env.VITE_GIST_ID || env.VITE_GIST_ID || ''),
      'import.meta.env.VITE_GIST_PAT': JSON.stringify(process.env.VITE_GIST_PAT || env.VITE_GIST_PAT || ''),
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});