import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import playwright from '../../playwright.config.ts';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
  scripts: Record<string, string>;
};

describe('Werkzeug-Konfiguration', () => {
  it('Playwright baut immer frisch, statt einen laufenden (evtl. alten) Server zu nutzen', () => {
    const server = playwright.webServer;
    expect(Array.isArray(server)).toBe(false);
    expect(server && !Array.isArray(server) && server.reuseExistingServer).toBe(false);
  });

  it('npm test umfasst alle Testebenen einschließlich Performance-Budget', () => {
    for (const level of ['test:unit', 'test:ref', 'test:e2e', 'bench']) {
      expect(pkg.scripts.test).toContain(`npm run ${level}`);
    }
  });
});

describe('Playwright-Stabilität', () => {
  it('wiederholt einen Test einmal (sporadische WebKit-Aussetzer)', () => {
    expect(playwright.retries).toBe(1);
  });
});
