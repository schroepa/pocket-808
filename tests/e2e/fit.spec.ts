import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import {
  closeSheet,
  eachView,
  layoutOf,
  openMode,
  openPage,
  openPattern,
  openRoll,
  openTempo,
  pickTrack,
  trackSteps,
  work,
  type ModeName,
} from './nav.ts';

/*
 * Passt das Gerät ohne Scrollen? Telefon hochkant mit 390 × 660 (Safari mit Leisten), die übrigen
 * Projekte in ihrer Größe. Jede Prüfung läuft durch alle Modi, die Spuren BD, BA und SM mit jeder
 * Seite, Trig mit offenem Sub- und Opt-Feld und die Flächen.
 */

/** Bereiche, die laut Entwurf in sich scrollen dürfen: Listen der Plattenkiste und die Song-Kette */
const SCROLLERS = ['.library-pages > section', '.song .chain'];
/**
 * Ausnahme (Ruling Task 13): Am Telefon hochkant mit 390 × 660 passen die Step-Optionen eines
 * Sampler-Pads (Velocity, Chance, Bedingung, Pitch, drei Locks, Zurücksetzen) nicht ganz; nur dieses
 * Feld scrollt dann in sich, Reiter und Pad-Reihe sind dabei schon ausgeblendet.
 */
const FIELD = '.opt-panel, .sub-ed';
const fieldMayScroll = (project: string, where: string): boolean =>
  project === 'mobile' && where === 'Sampler Trig mit Opt';
/** dichte Raster: Steps, Sub-Steps, Noten-Steps, Notenrolle, Alle Spuren (samt Zeilen-Beschriftung) */
const DENSE = '.step, .ss, .ns, .cell, .sb, .pc, .rl, .at-cell, .at-lab';
const CONTROLS =
  'button, [role=slider], [role=tab], [role=radio], [role=switch], [role=checkbox], input, select, textarea';

test.beforeEach(async ({ page }, info) => {
  if (info.project.name === 'mobile') await page.setViewportSize({ width: 390, height: 660 });
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
});

type Check = (page: Page, where: string) => Promise<string[]>;

/** Trig mit eingeschaltetem Sub- bzw. Opt-Feld; danach wieder aus */
async function withTrigField(
  page: Page,
  track: string,
  visit: (where: string) => Promise<void>,
): Promise<void> {
  await pickTrack(page, track);
  await openPage(page, 'Trig');
  for (const [name, label] of [
    ['Sub', 'Sub-Steps bearbeiten'],
    ['Opt', 'Step-Optionen bearbeiten'],
  ] as const) {
    const chip = work(page).getByRole('button', { name: label, exact: true });
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    // Opt zeigt seine Regler erst für einen gewählten Step; Sub wählt beim Einschalten Step 1
    if (name === 'Opt') {
      await (await trackSteps(page)).first().click();
      await expect(page.locator('.opt-ctl:visible')).toHaveCount(1);
    }
    await visit(`${track} Trig mit ${name}`);
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
  }
}

/** alle Zustände des Geräts nacheinander; `check` liefert Fundstellen, gesammelt je Zustand */
async function walk(page: Page, check: Check): Promise<string[]> {
  const found: string[] = [];
  const visit = async (where: string): Promise<void> => {
    for (const f of await check(page, where)) found.push(`${where}: ${f}`);
  };
  await visit('Start');
  for (const track of ['Bass Drum', 'Bass', 'Sampler']) {
    await pickTrack(page, track);
    await eachView(page, (v) => visit(`${track} ${v}`));
  }
  await pickTrack(page, 'Bass');
  await openRoll(page);
  await visit('Bass Rolle');
  await withTrigField(page, 'Bass Drum', visit);
  await withTrigField(page, 'Sampler', visit);
  for (const mode of ['Sound', 'Mixer', 'Song', 'Punch'] as const satisfies ModeName[]) {
    await openMode(page, mode);
    await eachView(page, (v) => visit(`${mode} ${v}`));
  }
  await openMode(page, 'Spur');
  for (const [name, open] of [
    ['Pattern', openPattern],
    ['Tempo', openTempo],
  ] as const) {
    const sheet = await open(page);
    await visit(`Fläche ${name}`);
    await closeSheet(sheet);
  }
  if ((await layoutOf(page)) === 'mobile') {
    await page.getByRole('button', { name: 'Spur wählen', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Pad-Feld' });
    await expect(sheet).toBeVisible();
    await visit('Fläche Pad-Feld');
    await closeSheet(sheet);
  }
  return found;
}

const documentScroll: Check = (page) =>
  page.evaluate(() => {
    const d = document.documentElement;
    const out: string[] = [];
    if (d.scrollHeight > window.innerHeight)
      out.push(`Dokument ${d.scrollHeight - window.innerHeight} px zu hoch`);
    if (d.scrollWidth > window.innerWidth)
      out.push(`Dokument ${d.scrollWidth - window.innerWidth} px zu breit`);
    return out;
  });

/** Arbeitsfläche, Step-Bereich und das Sub-/Opt-Feld scrollen nicht (Feld: außer in der Ausnahme) */
const middleScroll =
  (project: string): Check =>
  (page, where) =>
    page.evaluate(
      ({ field, allowed }) => {
        const out: string[] = [];
        const areas = `[data-area=work], [data-area=steps]${allowed ? '' : `, ${field}`}`;
        for (const el of document.querySelectorAll<HTMLElement>(areas)) {
          if (el.getClientRects().length === 0) continue;
          const over = el.scrollHeight - el.clientHeight;
          const name = el.dataset.area ?? el.className;
          if (over > 1) out.push(`${name} scrollt ${over} px`);
        }
        return out;
      },
      { field: FIELD, allowed: fieldMayScroll(project, where) },
    );

const inView =
  (project: string, scrollers: readonly string[]): Check =>
  (page, where) =>
    page.evaluate(
      ({ controls, scrollers: allowed }) => {
        const label = (el: HTMLElement): string =>
          (el.getAttribute('aria-label') ?? el.textContent).trim().slice(0, 40);
        const out: string[] = [];
        const tol = 1;
        const inside = (
          r: DOMRect,
          b: { left: number; top: number; right: number; bottom: number },
        ) =>
          r.left >= b.left - tol &&
          r.top >= b.top - tol &&
          r.right <= b.right + tol &&
          r.bottom <= b.bottom + tol;
        for (const el of document.querySelectorAll<HTMLElement>(controls)) {
          if (el.getClientRects().length === 0) continue;
          const r = el.getBoundingClientRect();
          if (r.width < 2 && r.height < 2) continue;
          if (allowed.some((s) => el.closest(s))) continue;
          const view = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
          if (!inside(r, view)) {
            out.push(
              `„${label(el)}“ außerhalb des Fensters (${Math.round(r.top)}…${Math.round(r.bottom)})`,
            );
            continue;
          }
          // abschneidende Vorfahren (Scrollrahmen): die Box muss in ihrem sichtbaren Teil liegen
          for (let p = el.parentElement; p; p = p.parentElement) {
            const s = getComputedStyle(p);
            if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
            const b = p.getBoundingClientRect();
            const box = {
              left: b.left + p.clientLeft,
              top: b.top + p.clientTop,
              right: b.left + p.clientLeft + p.clientWidth,
              bottom: b.top + p.clientTop + p.clientHeight,
            };
            if (!inside(r, box)) {
              const where = p.dataset.area ?? p.getAttribute('aria-label') ?? p.className;
              out.push(`„${label(el)}“ verdeckt in ${where}`);
              break;
            }
          }
        }
        return out;
      },
      {
        controls: CONTROLS,
        scrollers: fieldMayScroll(project, where) ? [...scrollers, FIELD] : scrollers,
      },
    );

const touchTargets: Check = async (page) => {
  const min = (await layoutOf(page)) === 'desktop' ? 32 : 44;
  return page.evaluate(
    ({ controls, dense, min }) => {
      const label = (el: HTMLElement): string =>
        (el.getAttribute('aria-label') ?? el.textContent).trim().slice(0, 40);
      const out: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>(controls)) {
        if (el.getClientRects().length === 0 || el.closest(dense)) continue;
        const r = el.getBoundingClientRect();
        // nur für Screenreader (versteckte Datei-Eingaben, Beschriftungen): kein Ziel
        if (r.width < 2 && r.height < 2) continue;
        if (Math.min(r.width, r.height) < min - 0.5)
          out.push(`„${label(el)}“ ${Math.round(r.width)} × ${Math.round(r.height)}`);
      }
      for (const cell of document.querySelectorAll<HTMLElement>('.roll .pc')) {
        if (cell.getClientRects().length === 0) continue;
        const h = cell.getBoundingClientRect().height;
        if (h < 18 - 0.5) {
          out.push(`Notenrolle Zeile ${Math.round(h)} px hoch`);
          break;
        }
      }
      return out;
    },
    { controls: CONTROLS, dense: DENSE, min },
  );
};

test('Dokument scrollt nie', async ({ page }) => {
  expect(await walk(page, documentScroll)).toEqual([]);
});

test('Mitte passt ohne Scrollen', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile-quer', 'Telefon quer: Die Mitte darf scrollen');
  expect(await walk(page, middleScroll(info.project.name))).toEqual([]);
});

test('Alles Sichtbare liegt im Bild', async ({ page }, info) => {
  // Telefon quer ist niedriger als 660 px: Dort dürfen Arbeitsfläche und Step-Bereich scrollen
  const scrollers =
    info.project.name === 'mobile-quer'
      ? [...SCROLLERS, '[data-area=work]', '[data-area=steps]']
      : SCROLLERS;
  expect(await walk(page, inView(info.project.name, scrollers))).toEqual([]);
});

test('Touch-Ziele', async ({ page }) => {
  expect(await walk(page, touchTargets)).toEqual([]);
});

/** Kurzer Ton als 16-Bit-WAV (0,1 s, 22,05 kHz) */
function toneWav(): Buffer {
  const rate = 22050;
  const n = Math.round(rate * 0.1);
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++)
    b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 12000), 44 + i * 2);
  return b;
}

/** Fundstellen: Behälter läuft über oder ein sichtbares Kind ragt rechts heraus */
const overflowIn = (page: Page, selector: string): Promise<string[]> =>
  page.evaluate((sel) => {
    const out: string[] = [];
    for (const box of document.querySelectorAll<HTMLElement>(sel)) {
      if (box.getClientRects().length === 0) continue;
      if (box.scrollWidth > box.clientWidth)
        out.push(`${sel} läuft ${box.scrollWidth - box.clientWidth} px über`);
      const right = box.getBoundingClientRect().right;
      for (const el of box.querySelectorAll<HTMLElement>('*')) {
        if (el.getClientRects().length === 0) continue;
        const over = el.getBoundingClientRect().right - right;
        if (over > 1)
          out.push(`${sel}: „${el.textContent.slice(0, 20)}“ ragt ${Math.round(over)} px heraus`);
      }
      if (box.getBoundingClientRect().right > window.innerWidth + 1)
        out.push(`${sel} ragt aus dem Fenster`);
    }
    return out;
  }, selector);

test('Lange Namen laufen nicht über', async ({ page }) => {
  // breite Buchstaben zuerst: Die App kürzt Pad-Namen auf 12 und zeigt vom Drum-Sample 10 Zeichen
  const long = `${'WM'.repeat(10)} und noch vierzig Zeichen im Namen, Ende`;
  expect(long).toHaveLength(60);
  const load = async (button: () => Promise<void>): Promise<void> => {
    const chooser = page.waitForEvent('filechooser');
    await button();
    await (
      await chooser
    ).setFiles({ name: `${long}.wav`, mimeType: 'audio/wav', buffer: toneWav() });
  };
  await pickTrack(page, 'Bass Drum');
  await openPage(page, 'Klang');
  await load(() =>
    work(page).getByRole('button', { name: 'Eigenes Sample für diese Spur laden' }).click(),
  );
  await expect(page.locator('.drum-smp-name')).toBeVisible();
  await pickTrack(page, 'Sampler');
  await openPage(page, 'Klang');
  await load(() => page.locator('.smp-tools .chip', { hasText: 'Laden' }).click());
  await expect(page.locator('.smp-head .pad[aria-pressed=true] small')).toHaveText(
    long.slice(0, 12),
  );
  const found: string[] = [];
  const all = async (where: string): Promise<void> => {
    for (const sel of ['[data-area=display]', '[data-area=tracks]', '.pads', '.drum-sound'])
      for (const f of await overflowIn(page, sel)) found.push(`${where}: ${f}`);
  };
  await all('Sampler');
  await pickTrack(page, 'Bass Drum');
  await openPage(page, 'Klang');
  await all('Bass Drum');
  if ((await layoutOf(page)) === 'mobile') {
    await page.getByRole('button', { name: 'Spur wählen', exact: true }).click();
    await all('Pad-Feld');
  }
  expect(found).toEqual([]);
});

test('Start und Stopp bleiben lesbar oder nur Symbol', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'setzt die Größen selbst');
  for (const width of [390, 421, 430, 440, 443, 461, 500]) {
    await page.setViewportSize({ width, height: 932 });
    for (const playing of ['true', 'false']) {
      await page.locator('.play').click();
      await expect(page.locator('.play')).toHaveAttribute('aria-pressed', playing);
      // die Beschriftung ist entweder ganz zu sehen oder nur für Screenreader da (1 px)
      const cut = await page.locator('.play span').evaluate((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 2 && el.scrollWidth > el.clientWidth;
      });
      expect(cut, `${width} px, spielt: ${playing}`).toBe(false);
    }
  }
});
