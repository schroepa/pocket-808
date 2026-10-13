import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
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
          name: 'reference',
          environment: 'node',
          include: ['tests/reference/*.test.ts'],
          exclude: ['tests/reference/golden.test.ts', 'tests/reference/bench.test.ts'],
          pool: 'forks',
          testTimeout: 300_000,
        },
      },
    ],
  },
});
