import type { Locator, Page } from '@playwright/test';
import { expect } from './fixtures.ts';

/* Wege durch das „Gerät“: Modus, Spur, Seite und die Flächen für Pattern und Tempo. */

export type ModeName = 'Spur' | 'Sound' | 'Mixer' | 'Song' | 'Punch';

export const layoutOf = (page: Page): Promise<string | null> =>
  page.locator('html').getAttribute('data-layout');

/** der sichtbare Bereich der Arbeitsfläche */
export const work = (page: Page): Locator =>
  page.locator('[data-area=work] > section:not([hidden])');

export async function openMode(page: Page, name: ModeName): Promise<void> {
  await page
    .getByRole('tablist', { name: 'Bereich', exact: true })
    .getByRole('tab', { name, exact: true })
    .click();
  await expect(page.locator(`[data-area=work] > section[data-mode]:not([hidden])`)).toHaveAttribute(
    'aria-label',
    name,
  );
}

/**
 * Die Taste, die eine Spur wählt und anspielt: Tablet und Desktop haben je Spur eine (Tablet mit
 * „Alle Spuren“: die Zeilen-Beschriftung), das Telefon öffnet dafür das Pad-Feld. Beim Sampler ist das
 * dort das gewählte Pad, im Raster die erste Pad-Zeile.
 */
export async function trackButton(page: Page, name: string): Promise<Locator> {
  const label = `${name} wählen und anhören`;
  if ((await layoutOf(page)) !== 'mobile') {
    const keys = page.locator('[data-area=tracks]');
    if (await keys.isVisible()) return keys.getByRole('button', { name: label, exact: true });
    // Tablet mit „Alle Spuren“: Die Zeilen-Beschriftungen ersetzen die Spurtasten
    const grid = page.locator('[data-area=steps] .all-tracks');
    return name === 'Sampler'
      ? grid.locator('.at-lab[aria-label^="Zeile Pad"]').first()
      : grid.getByRole('button', { name: `Zeile ${name}`, exact: true });
  }
  const sheet = page.getByRole('dialog', { name: 'Pad-Feld' });
  if (!(await sheet.isVisible()))
    await page.getByRole('button', { name: 'Spur wählen', exact: true }).click();
  await expect(sheet).toBeVisible();
  if (name !== 'Sampler') return sheet.getByRole('button', { name: label, exact: true });
  // Bei anderer Spur ist im Feld kein Pad markiert; das gewählte nennt die Reihe der Sampler-Seite
  const pad = await page.locator('.smp-head .pad[aria-pressed=true]').getAttribute('aria-label');
  return sheet.getByRole('button', { name: pad ?? '', exact: true });
}

export async function pickTrack(page: Page, name: string): Promise<void> {
  await (await trackButton(page, name)).click();
  await expect(page.getByRole('dialog', { name: 'Pad-Feld' })).toBeHidden();
}

/** Anzeige und Spurwahl nennen diese Spur, z. B. ('SD', 'Snare Drum') */
export async function expectTrack(page: Page, id: string, name: string): Promise<void> {
  await expect(page.locator('.lcd-sub')).toHaveText(`${id} · ${name}`);
  if ((await layoutOf(page)) === 'mobile')
    await expect(page.locator('.track-title')).toHaveText(`${id} · ${name}`);
  else await expect(page.locator('.track-key[aria-pressed=true]')).toHaveText(id);
}

/** Seite der sichtbaren Arbeitsfläche zeigen; Reiter nur, wo sie nicht schon nebeneinander steht */
export async function openPage(page: Page, name: string): Promise<void> {
  const tab = work(page)
    .getByRole('tablist')
    .getByRole('tab', { name: new RegExp(`(^|· )${name}( ·|$)`) });
  if (await tab.isVisible()) await tab.click();
  await expect(
    work(page).locator(`section[data-page][aria-label="${name}"]:visible`),
  ).toBeVisible();
}

/** alle Ansichten der sichtbaren Arbeitsfläche nacheinander (ohne Reiter genau eine) */
export async function eachView(page: Page, fn: (view: string) => Promise<void>): Promise<void> {
  const tabs = work(page).getByRole('tablist').getByRole('tab');
  const count = await tabs.count();
  if (count === 0) {
    await fn('alle');
    return;
  }
  for (let i = 0; i < count; i++) {
    await tabs.nth(i).click();
    await expect(tabs.nth(i)).toHaveAttribute('aria-selected', 'true');
    await fn((await tabs.nth(i).textContent()) ?? String(i));
  }
}

/** Notenrolle von Bass bzw. Lead zeigen: Seite Noten, auf dem Desktop der untere Bereich */
export async function openRoll(page: Page): Promise<void> {
  await openPage(page, 'Noten');
  if ((await layoutOf(page)) === 'desktop')
    await page
      .getByRole('tablist', { name: 'Step-Bereich' })
      .getByRole('tab', { name: 'Noten' })
      .click();
  await expect(page.locator('.roll')).toBeVisible();
}

/** Zelle der Notenrolle: Zeile von oben (0–11), Spalte in der Takthälfte (0–7) */
export const rollCell = (page: Page, row: number, col: number): Locator =>
  page.locator('.roll .rr:not(.hd)').nth(row).locator('.pc').nth(col);

/**
 * Die 16 Step-Tasten der gewählten Spur: Telefon und Tablet im Step-Bereich, auf dem Desktop ihre
 * Zeile in „Alle Spuren“.
 */
export async function trackSteps(page: Page): Promise<Locator> {
  return (await layoutOf(page)) === 'desktop'
    ? page.locator('.all-tracks .at-row.sel .at-cell')
    : page.locator('[data-area=steps] .step-area > div:not([hidden]) button');
}

/** Lauflicht in irgendeinem Step-Raster */
export const playheads = (page: Page): Locator =>
  page.locator('[data-area=steps] :is(.step, .ss, .ns, .at-cell).now');

async function openSheet(page: Page, name: string, opener: RegExp): Promise<Locator> {
  const sheet = page.getByRole('dialog', { name, exact: true });
  if (!(await sheet.isVisible())) await page.getByRole('button', { name: opener }).click();
  await expect(sheet).toBeVisible();
  return sheet;
}

export const openPattern = (page: Page): Promise<Locator> =>
  openSheet(page, 'Pattern', /^Pattern wählen, aktuell/);

export const openTempo = (page: Page): Promise<Locator> =>
  openSheet(page, 'Tempo', /^Tempo \d+ BPM/);

export async function closeSheet(sheet: Locator): Promise<void> {
  await sheet.getByRole('button', { name: 'Schließen' }).click();
  await expect(sheet).toBeHidden();
}

/** Pattern-Platz wählen; die Fläche schließt sich dabei */
export async function selectPattern(page: Page, slot: string): Promise<void> {
  const sheet = await openPattern(page);
  await sheet.getByRole('button', { name: `Pattern ${slot}`, exact: true }).click();
  await expect(sheet).toBeHidden();
}

export async function expectPattern(page: Page, slot: string): Promise<void> {
  const sheet = await openPattern(page);
  await expect(sheet.getByRole('button', { name: `Pattern ${slot}`, exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await closeSheet(sheet);
}

export interface Box {
  name: string;
  w: number;
  h: number;
}

/** sichtbare Treffer des Selektors: wie viele, und welche kleiner als 44 × 44 px sind */
export async function targets(
  page: Page,
  selector: string,
): Promise<{ count: number; small: Box[] }> {
  const all = await page.evaluate(
    (sel) =>
      [...document.querySelectorAll<HTMLElement>(sel)]
        .filter((el) => el.getClientRects().length > 0)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return {
            name: el.getAttribute('aria-label') ?? el.textContent,
            w: Math.round(r.width),
            h: Math.round(r.height),
          };
        }),
    selector,
  );
  return { count: all.length, small: all.filter((x) => x.w < 44 || x.h < 44) };
}

/** größter Überstand sichtbarer Treffer über den rechten Fensterrand (≤ 0: alles im Fenster) */
export async function rightOverhang(page: Page, selector: string): Promise<number> {
  const rights = await page.evaluate(
    (sel) =>
      [...document.querySelectorAll<HTMLElement>(sel)]
        .filter((el) => el.getClientRects().length > 0)
        .map((el) => Math.round(el.getBoundingClientRect().right - window.innerWidth)),
    selector,
  );
  expect(rights.length, selector).toBeGreaterThan(0);
  return Math.max(...rights);
}

/**
 * Behälter, die selbst scrollen oder abschneiden: Das Dokument allein kann kaum überlaufen, weil die
 * Hülle (`.shell`) abschneidet; die Plattenkiste scrollt in ihren Abschnitten.
 */
const CONTAINERS = [
  '.shell',
  '[data-area]',
  '.sheet',
  '[data-mode=sound]',
  '.library-pages > section',
].join();

/** horizontaler Überlauf des Dokuments und der sichtbaren Behälter des Geräts */
export async function horizontalOverflow(page: Page): Promise<string[]> {
  return page.evaluate((selector) => {
    const out: string[] = [];
    const doc = document.documentElement.scrollWidth - window.innerWidth;
    if (doc > 0) out.push(`Dokument ${doc}`);
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      if (el.getClientRects().length === 0) continue;
      const over = el.scrollWidth - el.clientWidth;
      const name = el.dataset.area ?? el.getAttribute('aria-label') ?? el.className;
      if (over > 0) out.push(`${name} ${over}`);
    }
    return out;
  }, CONTAINERS);
}

/** Tablet: unten „Alle Spuren“ statt der 16 Steps zeigen */
export async function openAllTracks(page: Page): Promise<void> {
  const tab = page
    .getByRole('tablist', { name: 'Step-Bereich' })
    .getByRole('tab', { name: 'Alle Spuren' });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.all-tracks')).toBeVisible();
}
