import { defineConfig, devices } from '@playwright/test';

// Neue App (Schritt 5) aus dist-next, eigener Vorschau-Server
const NEXT = 'http://localhost:4174';

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
      testDir: 'tests/e2e',
      use: { ...devices['iPhone 14'], viewport: { width: 390, height: 844 } },
    },
    {
      name: 'tablet',
      testDir: 'tests/e2e',
      use: { ...devices['iPad Pro 11'], viewport: { width: 820, height: 1180 } },
    },
    {
      name: 'desktop',
      testDir: 'tests/e2e',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'next-mobile',
      testDir: 'tests/e2e-next',
      use: { ...devices['iPhone 14'], viewport: { width: 390, height: 844 }, baseURL: NEXT },
    },
    {
      name: 'next-tablet',
      testDir: 'tests/e2e-next',
      use: { ...devices['iPad Pro 11'], viewport: { width: 820, height: 1180 }, baseURL: NEXT },
    },
    {
      name: 'next-tablet-quer',
      testDir: 'tests/e2e-next',
      use: {
        ...devices['iPad Pro 11 landscape'],
        viewport: { width: 1180, height: 820 },
        baseURL: NEXT,
      },
    },
    {
      name: 'next-desktop',
      testDir: 'tests/e2e-next',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, baseURL: NEXT },
    },
  ],
  // immer frisch bauen: ein noch laufender Server zeigte womöglich einen alten Stand
  webServer: [
    { command: 'npm run build && npm run preview', port: 4173, reuseExistingServer: false },
    {
      command: 'npm run build:next && npm run preview:next',
      port: 4174,
      reuseExistingServer: false,
    },
  ],
});
