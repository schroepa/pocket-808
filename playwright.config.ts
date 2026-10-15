import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  fullyParallel: true,
  // WebKit bricht unter Last gelegentlich mit „browserContext.close: Test ended“ ab
  retries: 1,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4173' },
  projects: [
    {
      name: 'mobile',
      use: { ...devices['iPhone 14'], viewport: { width: 390, height: 844 } },
    },
    {
      name: 'mobile-quer',
      use: {
        ...devices['iPhone 14 landscape'],
        viewport: { width: 844, height: 390 },
      },
    },
    {
      name: 'tablet',
      use: { ...devices['iPad Pro 11'], viewport: { width: 820, height: 1180 } },
    },
    {
      name: 'tablet-quer',
      use: {
        ...devices['iPad Pro 11 landscape'],
        viewport: { width: 1180, height: 820 },
      },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  // immer frisch bauen: ein noch laufender Server zeigte womöglich einen alten Stand
  webServer: {
    command: 'npm run build && npm run preview',
    port: 4173,
    reuseExistingServer: false,
  },
});
