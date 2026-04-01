import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts',
        'src/dashboard/views/**',
        'src/bot/**',
        'src/services/collector.ts',
        'src/dashboard/server.ts',
        'src/dashboard/routes/index.ts',
        'src/db/test-helper.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
