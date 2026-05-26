import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: { port: 3000, host: true },
    preview: { port: Number(env.PORT) || 3000, host: true },
    build: { sourcemap: true, target: 'es2020' },
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(env.PINE_API_URL || '/api/v1'),
      'import.meta.env.VITE_REALTIME_URL': JSON.stringify(env.PINE_REALTIME_URL || ''),
      'import.meta.env.VITE_INTERNAL_BASE_PATH': JSON.stringify(env.PINE_INTERNAL_BASE_PATH || '/ops'),
    },
  };
});
