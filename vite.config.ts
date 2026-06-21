import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: '0.0.0.0', port: Number(process.env.PORT ?? 3000), strictPort: true },
  preview: { host: '0.0.0.0', port: Number(process.env.PORT ?? 3000), strictPort: true },
  test: {
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts',
    globals: true,
    css: true
  }
});
