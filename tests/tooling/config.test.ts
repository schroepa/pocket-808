import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import playwright from '../../playwright.config.ts';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
  scripts: Record<string, string>;
};

describe('Werkzeug-Konfiguration', () => {
  it('Playwright baut immer frisch, statt einen laufenden (evtl. alten) Server zu nutzen', () => {
    const servers = [playwright.webServer ?? []].flat();
    expect(servers.map((s) => s.port)).toEqual([4173]);
    for (const s of servers) expect(s.reuseExistingServer).toBe(false);
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

describe('Versionsnummer', () => {
  it('APP_VERSION entspricht package.json', async () => {
    const { APP_VERSION } = await import('../../src/core/constants.ts');
    const p = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
      version: string;
    };
    expect(APP_VERSION).toBe(p.version);
  });
});
