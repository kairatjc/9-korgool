/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import sirv from 'sirv';
import { defineConfig, type Plugin } from 'vite';

const handoffDir = fileURLToPath(new URL('../../design/handoff', import.meta.url));

/** Dev only: serves the design reference (design/handoff) at /__handoff for /__design/compare and visual tests. */
function handoff(): Plugin {
  return {
    name: 'korgool-handoff',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__handoff', sirv(handoffDir, { dev: true }));
    },
  };
}

export default defineConfig({
  plugins: [react(), handoff()],
  server: { port: 5173, strictPort: true },
  // Pre-bundle everything up front: a dependency discovered later makes Vite reload open pages (flaky e2e).
  optimizeDeps: {
    include: [
      'react',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-dom',
      'react-dom/client',
      '@tanstack/react-router',
      'i18next',
      'react-i18next',
      'lucide-react',
    ],
  },
  test: { include: ['src/**/*.test.{ts,tsx}'] },
});
