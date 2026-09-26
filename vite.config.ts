import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base: './' keeps the built dashboard working from any folder or static host.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
  },
});
