import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts', 'src/store/**/*.ts', 'src/ui/**/*.ts', 'src/platform/**/*.ts'],
      exclude: ['**/*.test.ts', 'src/core/test-utils.ts', 'src/ui/test-utils.ts'],
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90, perFile: true },
    },
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          exclude: ['src/ui/**', 'src/platform/**'],
          include: [
            'src/**/*.test.ts',
            'tests/support/**/*.test.ts',
            'tests/tooling/**/*.test.ts',
            'tests/reference/legacy/**/*.test.ts',
            'tests/reference/golden.test.ts',
          ],
        },
      },
      {
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: ['src/ui/**/*.test.ts', 'src/platform/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'reference',
          environment: 'node',
          include: ['tests/reference/*.test.ts'],
          exclude: ['tests/reference/golden.test.ts', 'tests/reference/bench.test.ts'],
          pool: 'forks',
          testTimeout: 300_000,
        },
      },
      {
        test: {
          name: 'bench',
          environment: 'node',
          include: ['tests/reference/bench.test.ts'],
          pool: 'forks',
          fileParallelism: false,
          testTimeout: 300_000,
        },
      },
    ],
  },
});
