import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import {
  closeSheet,
  openAllTracks,
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

/**
 * Bereiche, die in sich scrollen dürfen: Listen der Plattenkiste, die Song-Kette und das Raster
 * „Alle Spuren“ (Tablet, Desktop; seine Reiter nicht). Das Raster muss dabei mindestens vier Zeilen
 * ganz zeigen.
 */
const SCROLLERS = ['.library-pages > section', '.song .chain', '.all-tracks'];
/**
 * Ausnahme (Ruling Task 13): Am Telefon hochkant mit 390 × 660 passen die Step-Optionen eines
 * Sampler-Pads (Velocity, Chance, Bedingung, Slice, Pitch, drei Locks, Zurücksetzen) nicht ganz; nur
 * dieses Feld scrollt dann in sich, höchstens um die gemessenen Pixel. Reiter und Pad-Reihe sind dabei
 * schon ausgeblendet.
 */
const FIELD = '.opt-panel, .sub-ed';
const FIELD_LIMIT: Readonly<Record<string, number>> = {
  'Sampler Trig mit Opt': 24,
  'Sampler Trig mit Opt und Chop': 24,
};
const fieldLimit = (project: string, where: string): number =>
  project === 'mobile' ? (FIELD_LIMIT[where] ?? 0) : 0;
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

/** die Step-Tasten der gewählten Spur, auch wenn unten „Alle Spuren“ steht */
async function stepsOf(page: Page): Promise<Locator> {
  const all = page.locator('[data-area=steps] .all-tracks');
  return (await all.isVisible()) ? all.locator('.at-row.sel .at-cell') : trackSteps(page);
}

/** Opt einschalten und einen Step wählen (sonst zeigt Opt keine Regler) */
async function optOn(page: Page): Promise<Locator> {
  const chip = work(page).getByRole('button', { name: 'Step-Optionen bearbeiten', exact: true });
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await (await stepsOf(page)).first().click();
  await expect(page.locator('.opt-ctl:visible')).toHaveCount(1);
  return chip;
}

async function off(chip: Locator): Promise<void> {
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'false');
}

/** Trig mit eingeschaltetem Sub- bzw. Opt-Feld, beim Sampler auch Opt mit Chop; danach wieder aus */
async function withTrigField(
  page: Page,
  track: string,
  visit: (where: string) => Promise<void>,
  prefix = '',
): Promise<void> {
  await pickTrack(page, track);
  await openPage(page, 'Trig');
  // Sub wählt beim Einschalten Step 1
  const sub = work(page).getByRole('button', { name: 'Sub-Steps bearbeiten', exact: true });
  await sub.click();
  await expect(sub).toHaveAttribute('aria-pressed', 'true');
  await visit(`${prefix}${track} Trig mit Sub`);
  await off(sub);
  const opt = await optOn(page);
  await visit(`${prefix}${track} Trig mit Opt`);
  await off(opt);
  if (track !== 'Sampler') return;
  const chop = async (n: string): Promise<void> => {
    await openPage(page, 'Chop');
    const radio = work(page).locator('.smp-chop [role=radio]', { hasText: n });
    await radio.click();
    await expect(radio).toHaveAttribute('aria-checked', 'true');
    await openPage(page, 'Trig');
  };
  await chop('4');
  const again = await optOn(page);
  await visit(`${prefix}${track} Trig mit Opt und Chop`);
  await off(again);
  await chop('Aus');
}

/** alle Zustände des Geräts nacheinander; `check` liefert Fundstellen, gesammelt je Zustand */
async function walk(page: Page, check: Check): Promise<string[]> {
  const found: string[] = [];
  const visit = async (where: string): Promise<void> => {
    for (const f of await check(page, where)) found.push(`${where}: ${f}`);
  };
  await visit('Start');
  await tour(page, visit, '');
  for (const [name, open] of [
    ['Pattern', openPattern],
    ['Tempo', openTempo],
  ] as const) {
    const sheet = await open(page);
    await visit(`Fläche ${name}`);
    await closeSheet(sheet);
  }
  const layout = await layoutOf(page);
  if (layout === 'mobile') {
    await page.getByRole('button', { name: 'Spur wählen', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Pad-Feld' });
    await expect(sheet).toBeVisible();
    await visit('Fläche Pad-Feld');
    await closeSheet(sheet);
  }
  // Tablet: alles noch einmal mit „Alle Spuren“ unten (Desktop zeigt es immer)
  if (layout === 'tablet') {
    await openAllTracks(page);
    await tour(page, visit, 'Alle Spuren: ');
  }
  return found;
}

/** Spuren mit allen Ansichten, Rolle, Sub/Opt, die übrigen Modi (Song auch voll); endet in Spur */
async function tour(
  page: Page,
  visit: (where: string) => Promise<void>,
  prefix: string,
): Promise<void> {
  for (const track of ['Bass Drum', 'Bass', 'Sampler']) {
    await pickTrack(page, track);
    await eachView(page, (v) => visit(`${prefix}${track} ${v}`));
  }
  await pickTrack(page, 'Bass');
  await openRoll(page);
  await visit(`${prefix}Bass Rolle`);
  await withTrigField(page, 'Bass Drum', visit, prefix);
  await withTrigField(page, 'Sampler', visit, prefix);
  for (const mode of ['Sound', 'Mixer', 'Song', 'Punch'] as const satisfies ModeName[]) {
    await openMode(page, mode);
    await eachView(page, (v) => visit(`${prefix}${mode} ${v}`));
    if (mode !== 'Song') continue;
    // volle Song-Kette (32 Positionen): nur die Kette scrollt, Kopf und Werkzeuge bleiben
    const add = work(page).getByRole('button', { name: 'Aktuelles Pattern an den Song anhängen' });
    while (await add.isEnabled()) await add.click();
    await expect(work(page).locator('.blk')).toHaveCount(32);
    await visit(`${prefix}Song mit 32 Positionen`);
    await work(page).getByRole('button', { name: 'Leeren', exact: true }).click();
    await expect(work(page).locator('.blk')).toHaveCount(0);
  }
  await openMode(page, 'Spur');
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

/**
 * Arbeitsfläche, Step-Bereich und das Sub-/Opt-Feld scrollen nicht (Feld: höchstens um die Ausnahme);
 * „Alle Spuren“ zeigt mindestens vier ganze Zeilen
 */
const middleScroll =
  (project: string): Check =>
  (page, where) =>
    page.evaluate(
      ({ field, limit }) => {
        const out: string[] = [];
        const check = (selector: string, allowed: number): void => {
          for (const el of document.querySelectorAll<HTMLElement>(selector)) {
            if (el.getClientRects().length === 0) continue;
            const over = el.scrollHeight - el.clientHeight;
            const name = el.dataset.area ?? el.className;
            if (over > allowed + 1) out.push(`${name} scrollt ${over} px`);
          }
        };
        check('[data-area=work], [data-area=steps]', 0);
        check(field, limit);
        for (const grid of document.querySelectorAll<HTMLElement>('.all-tracks')) {
          if (grid.getClientRects().length === 0) continue;
          const box = grid.getBoundingClientRect();
          const rows = [...grid.querySelectorAll('.at-row')].map((r) => r.getBoundingClientRect());
          const whole = rows.filter((r) => r.top >= box.top - 1 && r.bottom <= box.bottom + 1);
          if (whole.length < Math.min(4, rows.length))
            out.push(`Alle Spuren zeigt nur ${whole.length} ganze Zeilen`);
        }
        return out;
      },
      { field: FIELD, limit: fieldLimit(project, where) },
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
        scrollers: fieldLimit(project, where) > 0 ? [...scrollers, FIELD] : scrollers,
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
