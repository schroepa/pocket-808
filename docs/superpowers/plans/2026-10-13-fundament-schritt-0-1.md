# Fundament Schritt 0+1: Gerüst und Referenztests – Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernes Werkzeug-Gerüst (Node 24, TypeScript, Vite, ESLint, Vitest, Playwright) aufsetzen und das heutige Verhalten der App (Klang, Speicherstände, Layout, Last) als Referenz festhalten, bevor eine Zeile portiert wird.

**Architecture:** Die bestehende App wandert unverändert nach `legacy/index.html` und bleibt bis Schritt 6 die ausgelieferte App. Vite baut in der Übergangszeit diese Datei nach `dist/index.html`. Eine Test-Harness lädt `legacy/index.html` in jsdom mit `node-web-audio-api`, rendert Klänge offline in eigenen Kindprozessen und vergleicht kompakte Fingerabdrücke (Spitze, RMS-Verlauf, spektraler Schwerpunkt) mit eingecheckten Referenzdateien.

**Tech Stack:** Node 24 LTS, TypeScript 6.0, Vite 8 + vite-plugin-singlefile, Vitest 5, Playwright 1.64 (+ @axe-core/playwright), ESLint 10 + typescript-eslint 8, Prettier 3, simple-git-hooks, jsdom 30, node-web-audio-api 2.

**Spec:** `docs/superpowers/specs/2026-10-13-fundament-design.md` (Abschnitte 2 „Teststrategie“, 3 „Werkzeuge“, 4 „Ablauf“ Schritte 0 und 1)

## Global Constraints

- Sprache: Kommentare, Testnamen, Fehlermeldungen und Commit-Nachrichten auf **Deutsch**. Hardware-Begriffe bleiben englisch (Level, Tune, Decay, Reverb, Cutoff, Reso).
- **`legacy/index.html` wird inhaltlich nicht verändert.** Nur verschoben (`git mv`). Die Harness patcht den Script-Text ausschließlich im Speicher.
- Laufzeit-Abhängigkeiten: **keine**. In `package.json` gibt es nur `devDependencies`.
- Node: `.nvmrc` = `24`, `engines.node` = `>=24`.
- TypeScript **6.0.x** (nicht 7: typescript-eslint 8.71 unterstützt `<6.1`).
- Browser-Ziel: `['safari17', 'chrome120', 'firefox121']`.
- Einzige externe Ressource der App: Google Fonts.
- localStorage-Schlüssel: `pocket808.v1` (Zustand), `pocket808.smp.v1` (Samples).
- E2E-Viewports: mobile 390 × 844 (WebKit), tablet 820 × 1180 (WebKit), desktop 1440 × 900 (Chromium).
- Kleine, einzelne Commits. Jede Commit-Nachricht endet mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. **Nie pushen.**
- Alle Arbeit auf Branch `fundament`.
- Shell-Hinweis: Die Bash-Umgebung behält keinen Zustand. Jeder Befehl, der Node braucht, beginnt mit `source ~/.nvm/nvm.sh && nvm use >/dev/null && `. Im Plan steht dafür abkürzend **`[n]`**.

## Review Focus

1. **Nicht reproduzierbare Referenzen** (Zufallsrauschen, Vorrender-Wettlauf): Gleiches Szenario mit gleichem Seed in zwei Prozessen muss identische Fingerabdrücke liefern → Test in Task 8.
2. **Stille Anker-Fehler in der Harness**: Wenn sich der Legacy-Text so ändert, dass ein Patch-Anker fehlt, muss die Harness laut scheitern statt ungepatcht weiterzulaufen → Test in Task 6.
3. **Referenzen versehentlich überschrieben oder fehlend**: Ohne `REF_UPDATE=1` darf nie geschrieben werden, eine fehlende Referenz ist ein Fehler → Test in Task 6.
4. **NaN/Infinity im Audio** würden von Spitze und RMS verschluckt: Fingerabdruck zählt ungültige Samples, Vergleich meldet sie → Test in Task 5.
5. **Schwankende Screenshots** durch Google Fonts (online/offline) oder Zufall: Fonts werden in allen E2E-Tests blockiert, `Math.random` wird geseedet → Fixture in Task 3, genutzt in Task 4.

---

## Dateistruktur (Ergebnis dieses Plans)

```
.nvmrc                      Node-Version
package.json                Skripte, devDependencies, Git-Hook
tsconfig.json               strenges TS für src/ und tests/
eslint.config.js            Lint inkl. Schichtregel
.prettierrc.json, .prettierignore
vite.config.ts              Build (Übergang: root = legacy/)
vitest.config.ts            Projekte unit / reference / bench
playwright.config.ts        E2E auf drei Viewports
legacy/index.html           bisherige App (unverändert, verschoben)
legacy/tests/*.cjs          bisherige Tests (verschoben, .js → .cjs)
src/                        (noch leer, ab Schritt 2)
tests/tooling/              Tests für Werkzeug-Regeln
tests/support/fft.ts        FFT für den Spektral-Schwerpunkt
tests/support/fingerprint.ts  Fingerabdruck + Vergleich
tests/e2e/                  Playwright-Specs, Fixture, axe-Baseline, Screenshots
tests/reference/legacy/     Harness, Typen, Szenarien, Kindprozess-Runner
tests/reference/*.ts        Golden-Verwaltung, Toleranzen, Prozess-Aufruf, Referenztests
tests/reference/fixtures/   alte Speicherstände
tests/reference/golden/     erzeugte Referenzdateien (eingecheckt)
```

---

### Task 1: Node 24, Abhängigkeiten und Umzug der alten App

**Files:**
- Create: `.nvmrc`
- Modify: `package.json` (komplett neu)
- Modify: `.gitignore`
- Move: `index.html` → `legacy/index.html`
- Move: `tests/*.js` → `legacy/tests/*.cjs`
- Modify: `legacy/tests/mix-test2.cjs`, `legacy/tests/mix-scn.cjs` (Verweise auf `.cjs`)
- Modify: `CLAUDE.md` (Abschnitt „Entwickeln und testen“), `README.md` (Abschnitt „Entwicklung“)

**Interfaces:**
- Produces: npm-Skripte `test:legacy`, `bench:legacy`. Ordner `legacy/` mit lauffähiger App und alten Tests.

- [ ] **Step 1: Node 24 installieren** (mit dem User bestätigen, bevor es ausgeführt wird: installiert eine weitere Node-Version in nvm, ändert nichts am System)

```bash
source ~/.nvm/nvm.sh && nvm install 24 && nvm use 24 && node -v
```
Expected: `v24.x.y` mit x ≥ 15 (jsdom 30 verlangt `^24.15.0`).

- [ ] **Step 2: `.nvmrc` anlegen**

```
24
```

- [ ] **Step 3: Alte App und Tests verschieben**

```bash
cd /Users/ptrck/Developer/pocket-808
mkdir -p legacy/tests
git mv index.html legacy/index.html
for f in tests/*.js; do git mv "$f" "legacy/tests/$(basename "${f%.js}").cjs"; done
rmdir tests 2>/dev/null || true
grep -n "mixlib.js\|mix-scn.js" legacy/tests/*.cjs
```
Expected: Treffer in `mix-test2.cjs` (`require('./mixlib.js')`, `__dirname+'/mix-scn.js'`) und `mix-scn.cjs` (`require('./mixlib.js')`).

- [ ] **Step 4: Verweise auf `.cjs` umstellen**

```bash
sed -i '' "s#require('./mixlib.js')#require('./mixlib.cjs')#; s#/mix-scn.js'#/mix-scn.cjs'#" legacy/tests/mix-test2.cjs legacy/tests/mix-scn.cjs
grep -n "mixlib\|mix-scn" legacy/tests/*.cjs
```
Expected: nur noch `.cjs`-Verweise. Die Pfade zu `index.html` stimmen ohne Änderung, weil alle alten Tests `path.resolve(__dirname,'..') + '/index.html'` nutzen, und das ist jetzt `legacy/index.html`.

- [ ] **Step 5: `package.json` neu schreiben**

```json
{
  "name": "pocket-808",
  "version": "0.15.0",
  "private": true,
  "type": "module",
  "description": "Pocket 808 – mobile Drum-Machine mit Synth, Sampler, Mixer und FX als einzelne HTML-Datei",
  "engines": {
    "node": ">=24"
  },
  "scripts": {
    "test:legacy": "node legacy/tests/synth-test.cjs && node legacy/tests/smp-test.cjs && node legacy/tests/sub-test.cjs && node legacy/tests/compat-test.cjs && node legacy/tests/env-test.cjs && node legacy/tests/mix-test2.cjs",
    "bench:legacy": "node legacy/tests/bench.cjs index.html demo && node legacy/tests/bench.cjs index.html worst"
  }
}
```

- [ ] **Step 6: Abhängigkeiten installieren**

```bash
[n] npm install -D jsdom@^30.1.2 node-web-audio-api@^2.2.0 @types/jsdom@^30.0.0 @types/node@^24.19.2 typescript@~6.0.3 vite@^8.3.4 vite-plugin-singlefile@^2.3.3 vitest@^5.0.4 @playwright/test@^1.64.0 @axe-core/playwright@^4.13.0 eslint@^10.12.0 @eslint/js@^10.0.1 typescript-eslint@^8.71.2 globals@^17.13.0 prettier@^3.9.10 simple-git-hooks@^2.14.0
```
Expected: Installation ohne `ERESOLVE`-Fehler. Peer-Warnungen zu `rollup` (vite-plugin-singlefile) sind harmlos.

- [ ] **Step 7: `.gitignore` ergänzen**

```
node_modules/
.DS_Store
*.bak.html
*.png
!tests/e2e/__screenshots__/**/*.png
dist/
coverage/
playwright-report/
test-results/
```

- [ ] **Step 8: Alte Tests unter Node 24 und jsdom 30 laufen lassen**

```bash
[n] npm run test:legacy 2>&1 | grep -E "FAIL|ALL OK|Error" | head -40
```
Expected: Jede Testdatei endet mit `ALL OK`, keine `FAIL`-Zeile. Falls jsdom 30 eine alte Datei bricht: Fehlermeldung an den User melden und **nicht** die alten Tests umschreiben, sondern jsdom auf `^29` setzen und erneut prüfen.

- [ ] **Step 9: Bench-Ausgangswert notieren**

```bash
[n] npm run bench:legacy
```
Expected: zwei Zeilen `index.html demo | Render 8 s Audio in … ms` und `… worst …`. Werte für den Abschlussbericht notieren.

- [ ] **Step 10: CLAUDE.md und README anpassen**

In `CLAUDE.md` den Codeblock unter „## Entwickeln und testen“ ersetzen durch:

````markdown
```sh
nvm use         # Node 24 laut .nvmrc
npm install
npm run test:legacy   # alte Tests gegen legacy/index.html
npm run bench:legacy  # alte Render-Last-Messung
```

- Übergangsphase (Branch `fundament`): Die App liegt unverändert in `legacy/index.html`, die alten Tests in `legacy/tests/`. Neue Werkzeuge und Referenztests kommen schrittweise dazu, siehe `docs/superpowers/plans/`.
````

In `README.md` im Abschnitt „## Entwicklung“ die Befehle ebenso ersetzen und den Satz „Ein Single-File-Projekt: …“ ersetzen durch: „Übergangsphase: Die App liegt in `legacy/index.html` und wird schrittweise nach TypeScript portiert (siehe `docs/superpowers/specs/`).“

- [ ] **Step 11: Commit**

```bash
git add -A
git status --short
git commit -m "Gerüst: Node 24, Abhängigkeiten, alte App nach legacy/

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Expected in `git status`: `R index.html -> legacy/index.html`, `R tests/… -> legacy/tests/….cjs`, neue `.nvmrc`, geänderte `package.json`, `package-lock.json`, `.gitignore`, `CLAUDE.md`, `README.md`.

---

### Task 2: TypeScript, ESLint mit Schichtregel, Prettier, Vitest-Grundgerüst, Git-Hook

**Files:**
- Create: `tsconfig.json`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `vitest.config.ts`
- Create: `tests/tooling/boundaries.test.ts`, `tests/tooling/package.test.ts`
- Modify: `package.json` (Skripte, Hook)

**Interfaces:**
- Produces: npm-Skripte `typecheck`, `lint`, `format`, `test:unit`. Vitest-Projekt `unit` (include `src/**/*.test.ts`, `tests/support/**/*.test.ts`, `tests/tooling/**/*.test.ts`, `tests/reference/legacy/**/*.test.ts`, `tests/reference/golden.test.ts`). Schichtregel per `no-restricted-imports`.

- [ ] **Step 1: `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": ["node"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "isolatedModules": true,
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src", "tests", "*.ts"]
}
```
`erasableSyntaxOnly` und `allowImportingTsExtensions` sind nötig, weil die Referenz-Runner als `.ts` direkt mit Node 24 laufen (Type Stripping).

- [ ] **Step 2: `vitest.config.ts`** (erst nur das Projekt `unit`, die anderen kommen in Task 6 und 11)

```ts
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
    ],
  },
});
```

- [ ] **Step 3: Failing Test für die Schichtregel schreiben** – `tests/tooling/boundaries.test.ts`

```ts
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
// Ohne Typprüfung: Die Dateien existieren nur virtuell, es geht nur um die Import-Regel.
const eslint = new ESLint({ cwd: ROOT, overrideConfig: [tseslint.configs.disableTypeChecked] });

async function importErrors(filePath: string, specifier: string): Promise<string[]> {
  const [result] = await eslint.lintText(`import { x } from '${specifier}';\nexport const y = x;\n`, {
    filePath,
  });
  if (!result) throw new Error('ESLint hat kein Ergebnis geliefert');
  const fatal = result.messages.filter((m) => m.fatal);
  if (fatal.length) throw new Error(fatal.map((m) => m.message).join('\n'));
  return result.messages.filter((m) => m.ruleId === 'no-restricted-imports').map((m) => m.message);
}

const CASES: [file: string, specifier: string, allowed: boolean][] = [
  ['src/core/pattern.ts', './music.ts', true],
  ['src/core/pattern.ts', '../store/signal.ts', false],
  ['src/core/pattern.ts', '../audio/engine.ts', false],
  ['src/core/pattern.ts', '../ui/knob.ts', false],
  ['src/core/pattern.ts', '../platform/ios.ts', false],
  ['src/core/pattern.ts', '../main.ts', false],
  ['src/store/store.ts', '../core/state.ts', true],
  ['src/store/store.ts', '../audio/engine.ts', false],
  ['src/store/store.ts', '../platform/ios.ts', false],
  ['src/audio/engine.ts', '../core/state.ts', true],
  ['src/audio/engine.ts', '../store/store.ts', true],
  ['src/audio/engine.ts', '../platform/ios.ts', true],
  ['src/audio/engine.ts', '../ui/knob.ts', false],
  ['src/ui/knob.ts', '../store/store.ts', true],
  ['src/ui/knob.ts', '../audio/engine.ts', false],
  ['src/ui/knob.ts', '../main.ts', false],
  ['src/platform/ios.ts', '../core/state.ts', true],
  ['src/platform/ios.ts', '../store/store.ts', false],
  ['src/main.ts', './audio/engine.ts', true],
  ['src/main.ts', './ui/knob.ts', true],
];

describe('Schichtregel', () => {
  for (const [file, specifier, allowed] of CASES) {
    it(`${file} → ${specifier} ist ${allowed ? 'erlaubt' : 'verboten'}`, async () => {
      const errors = await importErrors(file, specifier);
      expect(errors.length > 0).toBe(!allowed);
    });
  }
});
```

- [ ] **Step 4: Failing Test „keine Laufzeit-Abhängigkeiten“** – `tests/tooling/package.test.ts`

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
  dependencies?: Record<string, string>;
  engines?: { node?: string };
};

describe('package.json', () => {
  it('hat keine Laufzeit-Abhängigkeiten', () => {
    expect(pkg.dependencies ?? {}).toEqual({});
  });
  it('verlangt Node 24', () => {
    expect(pkg.engines?.node).toBe('>=24');
  });
});
```

- [ ] **Step 5: Skripte ergänzen und Tests rot sehen**

In `package.json` unter `scripts` ergänzen (die beiden `legacy`-Skripte bleiben):

```json
"typecheck": "tsc --noEmit",
"lint": "eslint . && prettier --check .",
"format": "prettier --write .",
"test:unit": "vitest run --project unit",
"prepare": "simple-git-hooks"
```

```bash
[n] npm run test:unit
```
Expected: FAIL in `boundaries.test.ts` (es gibt noch keine `eslint.config.js`, ESLint findet keine Konfiguration bzw. meldet keine Fehler bei verbotenen Importen). `package.test.ts` PASS.

- [ ] **Step 6: `eslint.config.js`**

```js
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Verbietet Importe aus den genannten Schichten (Schichtregel aus der Spezifikation). */
const forbid = (files, layers, message) => ({
  files,
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          { regex: `(^|/)(${layers.filter((l) => l !== 'main').join('|')})(/|$)`, message },
          ...(layers.includes('main') ? [{ regex: '(^|/)main(\\.ts)?$', message }] : []),
        ],
      },
    ],
  },
});

export default defineConfig(
  {
    ignores: [
      'dist/',
      'legacy/',
      'coverage/',
      'playwright-report/',
      'test-results/',
      'tests/reference/golden/',
    ],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: { allowDefaultProject: ['*.js'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  { files: ['**/*.js'], extends: [tseslint.configs.disableTypeChecked] },
  {
    // DSP- und Test-Hilfscode indiziert Typed Arrays in engen Schleifen
    files: ['tests/**/*.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  forbid(['src/core/**/*.ts'], ['store', 'audio', 'ui', 'platform', 'main'], 'core ist reine Logik und importiert keine anderen Schichten.'),
  forbid(['src/store/**/*.ts'], ['audio', 'ui', 'platform', 'main'], 'store darf nur core importieren.'),
  forbid(['src/audio/**/*.ts'], ['ui', 'main'], 'audio und ui kennen einander nicht. Verbindung nur über main.ts.'),
  forbid(['src/ui/**/*.ts'], ['audio', 'main'], 'audio und ui kennen einander nicht. Verbindung nur über main.ts.'),
  forbid(['src/platform/**/*.ts'], ['store', 'audio', 'ui', 'main'], 'platform importiert nur core.'),
);
```

- [ ] **Step 7: Tests grün sehen**

```bash
[n] npm run test:unit
```
Expected: alle 22 Tests PASS. Falls ESLint die Option `regex` in `patterns` ablehnt (Fehlermeldung zum Schema): auf `group` mit gitignore-Mustern umstellen, z. B. `{ group: ['**/store', '**/store/**'], message }` je Schicht, und erneut laufen lassen.

- [ ] **Step 8: Prettier konfigurieren**

`.prettierrc.json`:
```json
{
  "singleQuote": true,
  "printWidth": 100
}
```

`.prettierignore`:
```
legacy/
dist/
coverage/
playwright-report/
test-results/
tests/reference/golden/
tests/e2e/__screenshots__/
tests/e2e/axe-baseline.json
package-lock.json
**/*.md
```

```bash
[n] npm run format && npm run lint && npm run typecheck
```
Expected: alle drei ohne Fehler.

- [ ] **Step 9: Git-Hook** – in `package.json` auf oberster Ebene ergänzen:

```json
"simple-git-hooks": {
  "pre-commit": "npm run lint && npm run typecheck && npm run test:unit"
}
```

```bash
[n] npx simple-git-hooks && cat .git/hooks/pre-commit
```
Expected: Hook-Datei enthält den Befehl. (In Task 12 wird `test:ref` ergänzt, sobald es existiert.)

Hinweis für alle folgenden Commits: Der Hook ruft `npm` auf. Commits deshalb ebenfalls mit `[n]` ausführen.

- [ ] **Step 10: Commit**

```bash
git add -A
[n] git commit -m "Gerüst: TypeScript, ESLint mit Schichtregel, Prettier, Vitest, Git-Hook

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Expected: Hook läuft durch, Commit entsteht.

---

### Task 3: Vite-Build und End-to-End-Grundtests auf drei Viewports

**Files:**
- Create: `vite.config.ts`, `playwright.config.ts`
- Create: `tests/e2e/fixtures.ts`, `tests/e2e/smoke.spec.ts`, `tests/e2e/build.spec.ts`, `tests/e2e/a11y.spec.ts`, `tests/e2e/axe-baseline.json` (erzeugt)
- Modify: `package.json` (Skripte)

**Interfaces:**
- Produces: `npm run build` → `dist/index.html`. Fixture `test` aus `tests/e2e/fixtures.ts` mit automatisch aktivem Font-Block, Zufalls-Seed und Fehler-Sammlung `pageErrors: string[]`. Playwright-Projekte `mobile`, `tablet`, `desktop`.

- [ ] **Step 1: `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Übergangsphase: Gebaut wird die bestehende App aus legacy/.
// Mit Schritt 6 wechselt der Einstieg auf die neue index.html im Projektwurzelverzeichnis.
export default defineConfig({
  root: 'legacy',
  plugins: [viteSingleFile()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: ['safari17', 'chrome120', 'firefox121'],
  },
  preview: { port: 4173, strictPort: true },
});
```

- [ ] **Step 2: Skripte ergänzen und bauen**

In `package.json` unter `scripts`:
```json
"dev": "vite",
"build": "vite build",
"preview": "vite preview",
"test:e2e": "playwright test"
```

```bash
[n] npm run build && ls -l dist/ && wc -c legacy/index.html dist/index.html
```
Expected: `dist/index.html` existiert. Eine Warnung, dass das klassische Inline-Script nicht gebündelt wird, ist erwartet und harmlos. Größe von `dist/index.html` notieren (Wert **G** in Bytes, für Step 7).

- [ ] **Step 3: Playwright-Browser installieren**

```bash
[n] npx playwright install webkit chromium
```

- [ ] **Step 4: `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4173' },
  projects: [
    {
      name: 'mobile',
      use: { ...devices['iPhone 14'], viewport: { width: 390, height: 844 } },
    },
    {
      name: 'tablet',
      use: { ...devices['iPad Pro 11'], viewport: { width: 820, height: 1180 } },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
});
```
`iPhone 14` und `iPad Pro 11` sind WebKit-Geräte, `Desktop Chrome` ist Chromium.

- [ ] **Step 5: Fixture** – `tests/e2e/fixtures.ts`

```ts
import { test as base, expect } from '@playwright/test';

export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      // Google Fonts immer blockieren: gleiche Darstellung online wie offline
      await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
      // Fester Zufalls-Seed (mulberry32), damit z. B. erzeugte Samples und Wellenformen gleich bleiben
      await page.addInitScript(() => {
        let a = 1;
        Math.random = () => {
          a = (a + 0x6d2b79f5) >>> 0;
          let t = a;
          t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      });
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error' && !/Failed to load resource|fonts\.g/.test(m.text())) {
          errors.push(m.text());
        }
      });
      await use(errors);
    },
    { auto: true },
  ],
});

export { expect };
```

- [ ] **Step 6: Smoke-Tests** – `tests/e2e/smoke.spec.ts`

```ts
import { expect, test } from './fixtures.ts';

test('App lädt ohne Fehler', async ({ page, pageErrors }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Pocket 808');
  await expect(page.locator('#play')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('kein horizontaler Scroll', async ({ page }) => {
  await page.goto('/');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('Start-Tipp schaltet Wiedergabe ein und aus', async ({ page, pageErrors }) => {
  await page.goto('/');
  const play = page.locator('#play');
  await play.click();
  await expect(play).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#playLabel')).toHaveText('Stopp');
  await play.click();
  await expect(play).toHaveAttribute('aria-pressed', 'false');
  expect(pageErrors).toEqual([]);
});
```

- [ ] **Step 7: Build-Budget** – `tests/e2e/build.spec.ts`. `BUDGET_BYTES` = `Math.ceil(G * 1.1)` mit **G** aus Step 2, als Zahl eintragen.

```ts
import { readFileSync, statSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// Ausgangsgröße der gebauten Legacy-App plus 10 % Puffer (Spezifikation: Größenbudget)
const BUDGET_BYTES = 0; // ← hier Math.ceil(G * 1.1) eintragen
const DIST = new URL('../../dist/index.html', import.meta.url);

test.describe('gebaute dist/index.html', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'nur einmal prüfen');

  test('bleibt im Größenbudget', () => {
    expect(statSync(DIST).size).toBeLessThanOrEqual(BUDGET_BYTES);
  });

  test('ist eigenständig: nur Google Fonts als externe Ressource', () => {
    const html = readFileSync(DIST, 'utf8');
    expect(html).not.toMatch(/<script[^>]+src=/);
    const links = [...html.matchAll(/<link[^>]+href="([^"]+)"/g)].map((m) => m[1] ?? '');
    for (const href of links) expect(href).toMatch(/^https:\/\/fonts\.(googleapis|gstatic)\.com/);
  });
});
```
Hinweis: Der Platzhalterwert `0` ist absichtlich ungültig. Der Test schlägt fehl, bis der gemessene Wert eingetragen ist. Vor dem Commit muss die Zahl stehen.

- [ ] **Step 8: axe-Prüfung mit Ausgangsliste** – `tests/e2e/a11y.spec.ts`

```ts
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures.ts';

// Bekannte Verstöße der Legacy-App (serious/critical). Ziel bis Ende Schritt 5: leere Listen.
const BASELINE = new URL('./axe-baseline.json', import.meta.url);

test('keine neuen schweren Barrierefreiheits-Verstöße', async ({ page }, info) => {
  await page.goto('/');
  for (const id of ['synHead', 'smpHead', 'mixHead', 'fxHead']) await page.locator(`#${id}`).click();
  const { violations } = await new AxeBuilder({ page }).analyze();
  const found = violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .flatMap((v) => v.nodes.map((n) => `${v.id} @ ${n.target.join(' ')}`))
    .sort();

  const all = existsSync(BASELINE)
    ? (JSON.parse(readFileSync(BASELINE, 'utf8')) as Record<string, string[]>)
    : {};
  if (process.env.AXE_UPDATE === '1') {
    all[info.project.name] = found;
    writeFileSync(BASELINE, JSON.stringify(all, null, 2) + '\n');
    return;
  }
  const known = new Set(all[info.project.name] ?? []);
  expect(found.filter((f) => !known.has(f))).toEqual([]);
});
```

- [ ] **Step 9: Baseline erzeugen und alle E2E-Tests laufen lassen**

```bash
[n] AXE_UPDATE=1 npx playwright test a11y --workers=1 && cat tests/e2e/axe-baseline.json
[n] npm run test:e2e
```
Expected beim zweiten Befehl: alle Tests PASS (`build.spec.ts` nur im Projekt `desktop`, sonst übersprungen). Die Baseline-Datei zeigt die heutigen schweren Verstöße je Viewport. **Inhalt dem User zeigen.**

Falls `kein horizontaler Scroll` auf `tablet` oder `desktop` fehlschlägt, ist das ein Befund über die Legacy-App und kein Fehler im Test: **anhalten und dem User berichten**, nicht den Test abschwächen.

- [ ] **Step 10: Lint, Typen, Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck
git add -A
[n] git commit -m "Gerüst: Vite-Build und E2E-Grundtests auf drei Viewports

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Layout-Referenz-Screenshots (Mobile)

**Files:**
- Create: `tests/e2e/layout.spec.ts`
- Create (erzeugt): `tests/e2e/__screenshots__/mobile/*.png`

**Interfaces:**
- Consumes: Fixture `test` aus `tests/e2e/fixtures.ts` (Task 3).
- Produces: Screenshots `legacy-eingeklappt.png`, `legacy-ausgeklappt.png` als Vergleich für Schritt 5.

- [ ] **Step 1: Test schreiben** – `tests/e2e/layout.spec.ts`

```ts
import { expect, test } from './fixtures.ts';

// Referenz des heutigen Layouts bei 390 × 844. Schritt 5 muss genau so aussehen.
test.describe('Layout-Referenz', () => {
  test.skip(({ viewport }) => viewport?.width !== 390, 'Referenz nur für Mobile');

  test('eingeklappt', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot('legacy-eingeklappt.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('alle Module ausgeklappt', async ({ page }) => {
    await page.goto('/');
    for (const id of ['synHead', 'smpHead', 'mixHead', 'fxHead']) {
      await page.locator(`#${id}`).click();
    }
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot('legacy-ausgeklappt.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});
```

- [ ] **Step 2: Erster Lauf erzeugt die Referenzen**

```bash
[n] npx playwright test layout --project=mobile --update-snapshots
ls tests/e2e/__screenshots__/mobile/
```
Expected: zwei PNG-Dateien.

- [ ] **Step 3: Stabilität prüfen (dreimal ohne Update)**

```bash
[n] for i in 1 2 3; do npx playwright test layout --project=mobile || break; done
```
Expected: dreimal PASS. Falls ein Lauf abweicht: Diff-Bild unter `test-results/` ansehen, Ursache benennen (z. B. Animation, Zeitanzeige) und dem User berichten, bevor Toleranzen gesetzt werden.

- [ ] **Step 4: Screenshots ansehen**

Beide PNGs mit dem Read-Werkzeug öffnen und prüfen, dass sie die App vollständig zeigen (Kopf, Step-Raster, alle Module).

- [ ] **Step 5: Commit**

```bash
[n] npm run lint
git add tests/e2e/layout.spec.ts tests/e2e/__screenshots__
[n] git commit -m "Referenz: Layout-Screenshots der Legacy-App (Mobile)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: FFT und Klang-Fingerabdruck

**Files:**
- Create: `tests/support/fft.ts`, `tests/support/fft.test.ts`
- Create: `tests/support/fingerprint.ts`, `tests/support/fingerprint.test.ts`

**Interfaces:**
- Produces:
  - `magnitudeSpectrum(input: Float64Array): Float64Array` – Länge `n/2 + 1`, wirft `RangeError` bei Länge, die keine Zweierpotenz ist.
  - `interface Fingerprint { sampleRate: number; length: number; peak: number; nonFinite: number; rmsDb: number[]; centroidHz: number }`
  - `interface Tolerance { peakRel: number; rmsFloorDb: number; rmsMeanDb: number; rmsMaxDb: number; centroidRel: number }`
  - `fingerprint(samples: Float32Array, sampleRate: number): Fingerprint`
  - `compareFingerprints(expected: Fingerprint, actual: Fingerprint, tol: Tolerance): string[]` – leeres Array = passt.
  - `SILENCE_DB = -180`

- [ ] **Step 1: Failing Tests für die FFT** – `tests/support/fft.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { magnitudeSpectrum } from './fft.ts';

describe('magnitudeSpectrum', () => {
  it('Impuls ergibt flaches Spektrum', () => {
    const x = new Float64Array(64);
    x[0] = 1;
    const mag = magnitudeSpectrum(x);
    expect(mag).toHaveLength(33);
    for (const m of mag) expect(m).toBeCloseTo(1, 10);
  });

  it('Sinus auf Bin 8 hat dort sein Maximum', () => {
    const n = 256;
    const x = Float64Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 8 * i) / n));
    const mag = magnitudeSpectrum(x);
    const max = mag.indexOf(Math.max(...mag));
    expect(max).toBe(8);
    expect(mag[8]).toBeCloseTo(n / 2, 6);
  });

  it('lehnt Längen ab, die keine Zweierpotenz sind', () => {
    expect(() => magnitudeSpectrum(new Float64Array(100))).toThrow(RangeError);
    expect(() => magnitudeSpectrum(new Float64Array(0))).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Rot sehen**

```bash
[n] npx vitest run tests/support/fft.test.ts
```
Expected: FAIL, Modul `./fft.ts` nicht gefunden.

- [ ] **Step 3: FFT implementieren** – `tests/support/fft.ts`

```ts
/** Betragsspektrum einer reellen Folge (iterative Radix-2-FFT). Länge des Ergebnisses: n/2 + 1. */
export function magnitudeSpectrum(input: Float64Array): Float64Array {
  const n = input.length;
  if (n === 0 || (n & (n - 1)) !== 0) {
    throw new RangeError(`FFT-Länge muss eine Zweierpotenz sein, war ${n}`);
  }
  const re = Float64Array.from(input);
  const im = new Float64Array(n);
  // Bit-Umkehr-Permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const t = re[i]!;
      re[i] = re[j]!;
      re[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k;
        const b = a + half;
        const xr = re[b]! * cr - im[b]! * ci;
        const xi = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - xr;
        im[b] = im[a]! - xi;
        re[a] = re[a]! + xr;
        im[a] = im[a]! + xi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
  const out = new Float64Array((n >> 1) + 1);
  for (let k = 0; k < out.length; k++) out[k] = Math.hypot(re[k]!, im[k]!);
  return out;
}
```

- [ ] **Step 4: Grün sehen**

```bash
[n] npx vitest run tests/support/fft.test.ts
```
Expected: 3 PASS.

- [ ] **Step 5: Failing Tests für den Fingerabdruck** – `tests/support/fingerprint.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { compareFingerprints, fingerprint, SILENCE_DB, type Tolerance } from './fingerprint.ts';

const SR = 44100;
const sine = (hz: number, seconds: number, amp = 1) =>
  Float32Array.from({ length: Math.round(SR * seconds) }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / SR));
const TOL: Tolerance = { peakRel: 0.05, rmsFloorDb: -50, rmsMeanDb: 0.5, rmsMaxDb: 3, centroidRel: 0.03 };

describe('fingerprint', () => {
  it('misst Spitze, RMS in 10-ms-Fenstern und Schwerpunkt eines Sinus', () => {
    const fp = fingerprint(sine(1000, 0.5, 0.5), SR);
    expect(fp.length).toBe(22050);
    expect(fp.rmsDb).toHaveLength(50);
    expect(fp.peak).toBeCloseTo(0.5, 3);
    // RMS eines Sinus = Amplitude / √2 → 20·log10(0,5/√2) ≈ −9,03 dB
    for (const db of fp.rmsDb) expect(db).toBeCloseTo(-9.03, 1);
    expect(Math.abs(fp.centroidHz - 1000) / 1000).toBeLessThan(0.02);
    expect(fp.nonFinite).toBe(0);
  });

  it('kennzeichnet Stille und zählt NaN/Infinity', () => {
    const x = new Float32Array(882);
    x[500] = Number.NaN;
    x[600] = Number.POSITIVE_INFINITY;
    const fp = fingerprint(x, SR);
    expect(fp.nonFinite).toBe(2);
    expect(fp.rmsDb[0]).toBe(SILENCE_DB);
    expect(fp.centroidHz).toBe(0);
  });

  it('kommt mit Puffern kürzer als ein FFT-Rahmen zurecht', () => {
    const fp = fingerprint(sine(2000, 0.01), SR);
    expect(fp.centroidHz).toBeGreaterThan(1500);
    expect(fp.centroidHz).toBeLessThan(2500);
  });
});

describe('compareFingerprints', () => {
  const base = fingerprint(sine(440, 0.3, 0.8), SR);

  it('gleicher Klang passt', () => {
    expect(compareFingerprints(base, fingerprint(sine(440, 0.3, 0.8), SR), TOL)).toEqual([]);
  });

  it('meldet lauteren Klang (Spitze und RMS)', () => {
    const problems = compareFingerprints(base, fingerprint(sine(440, 0.3, 1), SR), TOL);
    expect(problems.some((p) => p.startsWith('Spitze'))).toBe(true);
    expect(problems.some((p) => p.startsWith('RMS'))).toBe(true);
  });

  it('meldet einen Halbton höheren Klang (Schwerpunkt)', () => {
    const up = fingerprint(sine(440 * 2 ** (1 / 12), 0.3, 0.8), SR);
    expect(compareFingerprints(base, up, TOL).some((p) => p.startsWith('Schwerpunkt'))).toBe(true);
  });

  it('meldet abweichende Länge statt abzustürzen', () => {
    const problems = compareFingerprints(base, fingerprint(sine(440, 0.5, 0.8), SR), TOL);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^Länge/);
  });

  it('meldet ungültige Samples', () => {
    const bad = { ...base, nonFinite: 3 };
    expect(compareFingerprints(base, bad, TOL)[0]).toMatch(/ungültige Samples/);
  });
});
```

- [ ] **Step 6: Rot sehen**

```bash
[n] npx vitest run tests/support/fingerprint.test.ts
```
Expected: FAIL, Modul nicht gefunden.

- [ ] **Step 7: Fingerabdruck implementieren** – `tests/support/fingerprint.ts`

```ts
import { magnitudeSpectrum } from './fft.ts';

/** Kompakte, vergleichbare Beschreibung eines gerenderten Klangs. */
export interface Fingerprint {
  sampleRate: number;
  length: number;
  peak: number;
  /** Anzahl NaN/Infinity-Samples. Muss 0 sein. */
  nonFinite: number;
  /** RMS je 10-ms-Fenster in dBFS, Stille = SILENCE_DB */
  rmsDb: number[];
  /** energiegewichteter spektraler Schwerpunkt in Hz */
  centroidHz: number;
}

export interface Tolerance {
  /** erlaubte relative Abweichung der Spitze */
  peakRel: number;
  /** nur Fenster vergleichen, die höchstens so viele dB unter dem lautesten liegen (negativ) */
  rmsFloorDb: number;
  /** erlaubte mittlere Abweichung der verglichenen Fenster in dB */
  rmsMeanDb: number;
  /** erlaubte größte Abweichung eines Fensters in dB */
  rmsMaxDb: number;
  /** erlaubte relative Abweichung des Schwerpunkts */
  centroidRel: number;
}

export const SILENCE_DB = -180;
const WINDOW_S = 0.01;
const FRAME = 2048;
const round = (v: number, digits: number) => Math.round(v * 10 ** digits) / 10 ** digits;
const HANN = Float64Array.from(
  { length: FRAME },
  (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FRAME - 1)),
);

function spectralCentroid(samples: Float32Array, sampleRate: number): number {
  let num = 0;
  let den = 0;
  const frame = new Float64Array(FRAME);
  for (let start = 0; start < samples.length; start += FRAME) {
    for (let i = 0; i < FRAME; i++) {
      const x = samples[start + i] ?? 0;
      frame[i] = Number.isFinite(x) ? x * HANN[i]! : 0;
    }
    const mag = magnitudeSpectrum(frame);
    for (let k = 1; k < mag.length; k++) {
      const power = mag[k]! * mag[k]!;
      num += ((k * sampleRate) / FRAME) * power;
      den += power;
    }
  }
  return den > 0 ? num / den : 0;
}

export function fingerprint(samples: Float32Array, sampleRate: number): Fingerprint {
  let peak = 0;
  let nonFinite = 0;
  for (const x of samples) {
    if (!Number.isFinite(x)) nonFinite++;
    else if (Math.abs(x) > peak) peak = Math.abs(x);
  }
  const win = Math.round(sampleRate * WINDOW_S);
  const rmsDb: number[] = [];
  for (let i = 0; i < samples.length; i += win) {
    const end = Math.min(samples.length, i + win);
    let sum = 0;
    for (let k = i; k < end; k++) {
      const x = samples[k]!;
      if (Number.isFinite(x)) sum += x * x;
    }
    const rms = Math.sqrt(sum / (end - i));
    rmsDb.push(rms > 0 ? round(20 * Math.log10(rms), 2) : SILENCE_DB);
  }
  return {
    sampleRate,
    length: samples.length,
    peak: round(peak, 5),
    nonFinite,
    rmsDb,
    centroidHz: round(spectralCentroid(samples, sampleRate), 1),
  };
}

const pct = (v: number) => `${(v * 100).toFixed(1)} %`;

export function compareFingerprints(
  expected: Fingerprint,
  actual: Fingerprint,
  tol: Tolerance,
): string[] {
  const problems: string[] = [];
  if (actual.nonFinite > 0) problems.push(`${actual.nonFinite} ungültige Samples (NaN/Infinity)`);
  if (expected.sampleRate !== actual.sampleRate || expected.length !== actual.length) {
    problems.push(
      `Länge/Rate weicht ab: ${expected.length}@${expected.sampleRate} → ${actual.length}@${actual.sampleRate}`,
    );
    return problems;
  }
  const peakDiff = Math.abs(actual.peak - expected.peak) / Math.max(expected.peak, 1e-6);
  if (peakDiff > tol.peakRel) {
    problems.push(`Spitze ${expected.peak} → ${actual.peak} (${pct(peakDiff)})`);
  }
  const loudest = Math.max(...expected.rmsDb);
  const diffs = expected.rmsDb.flatMap((e, i) =>
    e >= loudest + tol.rmsFloorDb ? [Math.abs((actual.rmsDb[i] ?? SILENCE_DB) - e)] : [],
  );
  const mean = diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 0;
  const max = Math.max(0, ...diffs);
  if (mean > tol.rmsMeanDb || max > tol.rmsMaxDb) {
    problems.push(`RMS-Verlauf weicht ab: Mittel ${mean.toFixed(2)} dB, Max ${max.toFixed(2)} dB`);
  }
  const cDiff =
    Math.abs(actual.centroidHz - expected.centroidHz) / Math.max(expected.centroidHz, 1);
  if (cDiff > tol.centroidRel) {
    problems.push(`Schwerpunkt ${expected.centroidHz} Hz → ${actual.centroidHz} Hz (${pct(cDiff)})`);
  }
  return problems;
}
```

- [ ] **Step 8: Grün sehen**

```bash
[n] npx vitest run tests/support
```
Expected: 11 PASS.

- [ ] **Step 9: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck
git add tests/support
[n] git commit -m "Testhilfe: FFT und Klang-Fingerabdruck mit Vergleich

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Legacy-Harness, Kindprozess-Runner und Referenz-Verwaltung

**Files:**
- Create: `tests/reference/legacy/types.ts`
- Create: `tests/reference/legacy/harness.ts`, `tests/reference/legacy/harness.test.ts`
- Create: `tests/reference/legacy/scenarios.ts` (zunächst nur `smoke`)
- Create: `tests/reference/legacy/runner.ts`
- Create: `tests/reference/run.ts`
- Create: `tests/reference/golden.ts`, `tests/reference/golden.test.ts`
- Create: `tests/reference/tolerance.ts`
- Create: `tests/reference/expect.ts`
- Modify: `vitest.config.ts` (Projekt `reference`), `package.json` (Skripte)

**Interfaces:**
- Consumes: `fingerprint`, `compareFingerprints`, `Fingerprint`, `Tolerance` aus `tests/support/fingerprint.ts` (Task 5).
- Produces:
  - `loadLegacy(opts?: LegacyOptions): LegacyPage`
  - `interface LegacyOptions { seed?: number; audio?: AudioSetup; storage?: Readonly<Record<string, string>>; prerender?: boolean; instrument?: (ctx: OfflineAudioContext) => void }`
  - `interface AudioSetup { seconds: number; channels?: 1 | 2; sampleRate?: number }`
  - `interface LegacyPage { window: DOMWindow; t: LegacyHooks; errors: string[]; ctx(): OfflineAudioContext; setNow(seconds: number): void; close(): void }`
  - `splitLegacy(html: string, patches?: readonly Patch[]): { body: string; script: string }`, `PATCHES`, `mulberry32(seed: number): () => number`
  - `LegacyHooks`, `LegacyState`, `LegacyPattern`, `DrumParams`, `MixChannel`, `SynthPatch`, `row(p: LegacyPattern, id: string): number[]` aus `types.ts`
  - `runLegacy<T>(name: string, args: object, attempts?: number): Promise<T>`
  - `readGolden<T>(name: string, actual: T, root?: string): T`
  - `TOLERANCE: Tolerance`
  - `interface StereoPrint { L: Fingerprint; R: Fingerprint }` (in `scenarios.ts`)
  - `expectPrint(expect: ExpectStatic, name: string, actual: Fingerprint): void`, `expectStereo(expect: ExpectStatic, name: string, actual: StereoPrint): void`

- [ ] **Step 1: Typen der Legacy-Schnittstelle** – `tests/reference/legacy/types.ts`

```ts
/** Was die Harness aus dem Legacy-Script herausreicht (siehe HOOK in harness.ts). */
export interface DrumParams {
  level: number;
  tune: number;
  decay: number;
}
export interface MixChannel {
  v: number;
  p: number;
  r: number;
  m: boolean;
  s: boolean;
}
export type SynthPatch = Record<string, number | string | boolean | null>;
export type Part = 'BA' | 'LD';

export interface LegacyPattern {
  [voice: string]: unknown;
  notes: Record<Part, unknown[]>;
  smp: number[][];
  sub: Record<string, unknown>;
}

export interface LegacyState {
  tempo: number;
  swing: number;
  master: number;
  mode: string;
  cur: string;
  pat: LegacyPattern;
  patterns: Record<string, LegacyPattern>;
  params: Record<string, DrumParams>;
  synth: Record<Part, SynthPatch>;
  mix: Record<string, MixChannel>;
  fx: Record<string, number>;
}

export interface LegacyHooks {
  state: LegacyState;
  readonly ctx: BaseAudioContext | null;
  serial(): unknown;
  ensureAudio(): boolean;
  applyMixAll(): void;
  stutterOn(fraction: number): void;
  stutterOff(): void;
  synthNote(part: Part, midi: number, time: number, duration: number): void;
  smpPlay(pad: number, time: number): void;
  renderVoice(index: number): Promise<void>;
  prerenderAll(): Promise<void>;
  pump(): void;
  begin(): void;
  stop(): void;
  voiceBuf: Record<string, AudioBuffer | undefined>;
  smpPcm: (Float32Array | null)[];
  drumPcm: Record<string, Float32Array | undefined>;
  VOICES: readonly { id: string; name: string }[];
  SYN_PRESETS: Record<Part, readonly { name: string; v: SynthPatch }[]>;
}

/** Step-Reihe einer Drum-Spur. */
export function row(p: LegacyPattern, id: string): number[] {
  const r = p[id];
  if (!Array.isArray(r)) throw new Error(`Keine Step-Reihe für ${id}`);
  return r as number[];
}
```

- [ ] **Step 2: Failing Tests für die Harness** – `tests/reference/legacy/harness.test.ts`

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LEGACY_HTML, loadLegacy, mulberry32, PATCHES, splitLegacy } from './harness.ts';

describe('splitLegacy', () => {
  const html = '<html><body><p>x</p><script>\n(function(){\nconst hot=window.claude;\nsetupGraph(ctx);\n  prerenderAll();\n})();\n</script></body></html>';

  it('trennt Script und Markup und wendet alle Patches an', () => {
    const { body, script } = splitLegacy(html);
    expect(body).toBe('<html><body><p>x</p></body></html>');
    expect(script).toContain('window.__t=');
    expect(script).toContain('if(!window.__noPrerender) prerenderAll();');
  });

  it('scheitert laut, wenn ein Anker fehlt', () => {
    expect(() => splitLegacy(html.replace('const hot=window.claude', 'const x=1'))).toThrow(
      /Anker nicht gefunden/,
    );
  });

  it('scheitert laut, wenn das Script fehlt', () => {
    expect(() => splitLegacy('<html></html>')).toThrow(/Legacy-Script nicht gefunden/);
  });

  it('findet alle Anker im echten Legacy-Code', () => {
    expect(PATCHES.length).toBeGreaterThanOrEqual(2);
    expect(() => splitLegacy(readFileSync(LEGACY_HTML, 'utf8'))).not.toThrow();
  });
});

describe('mulberry32', () => {
  it('ist reproduzierbar und liegt in [0, 1)', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    const xs = Array.from({ length: 100 }, () => a());
    expect(xs).toEqual(Array.from({ length: 100 }, () => b()));
    for (const x of xs) expect(x >= 0 && x < 1).toBe(true);
    expect(mulberry32(8)()).not.toBe(xs[0]);
  });
});

describe('loadLegacy', () => {
  it('startet die Legacy-App ohne Fehler und reicht den Zustand heraus', () => {
    const p = loadLegacy();
    try {
      expect(p.errors).toEqual([]);
      expect(p.t.state.tempo).toBe(90);
      expect(p.t.VOICES.map((v) => v.id)).toEqual([
        'BD', 'SD', 'LT', 'HT', 'RS', 'CP', 'CB', 'CH', 'OH', 'CY',
      ]);
      expect(p.t.ctx).toBeNull();
    } finally {
      p.close();
    }
  });

  it('übernimmt Speicherstände aus storage', () => {
    const p = loadLegacy({ storage: { 'pocket808.v1': JSON.stringify({ tempo: 133 }) } });
    try {
      expect(p.t.state.tempo).toBe(133);
    } finally {
      p.close();
    }
  });
});
```

- [ ] **Step 3: Rot sehen**

```bash
[n] npx vitest run tests/reference/legacy/harness.test.ts
```
Expected: FAIL, Modul `./harness.ts` nicht gefunden.

- [ ] **Step 4: Harness implementieren** – `tests/reference/legacy/harness.ts`

```ts
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole, type DOMWindow } from 'jsdom';
import type { LegacyHooks } from './types.ts';

const require = createRequire(import.meta.url);
const wa = require('node-web-audio-api') as { OfflineAudioContext: typeof OfflineAudioContext };

export const LEGACY_HTML = fileURLToPath(new URL('../../../legacy/index.html', import.meta.url));

/** Reicht interne Funktionen und Werte des Legacy-Scripts an die Tests heraus. */
const HOOK =
  'window.__t={state,serial,ensureAudio,applyMixAll,stutterOn,stutterOff,synthNote,smpPlay,' +
  'renderVoice,prerenderAll,pump,voiceBuf,smpPcm,drumPcm,VOICES,SYN_PRESETS,get ctx(){return ctx;},' +
  'begin(){playing=true;step=0;songFirst=true;barSong=false;queue.length=0;nextTime=.08;},' +
  'stop(){playing=false;}};\n';

export interface Patch {
  find: string;
  replace: string;
}

export const PATCHES: readonly Patch[] = [
  { find: 'const hot=window.claude', replace: HOOK + 'const hot=window.claude' },
  {
    // Vorrendern steuert der Test selbst, sonst überschreibt es gezielt gerenderte Varianten
    find: 'setupGraph(ctx);\n  prerenderAll();',
    replace: 'setupGraph(ctx);\n  if(!window.__noPrerender) prerenderAll();',
  },
];

export function splitLegacy(
  html: string,
  patches: readonly Patch[] = PATCHES,
): { body: string; script: string } {
  const m = /<script>\n\(function\(\)\{[\s\S]*?<\/script>/.exec(html);
  if (!m) throw new Error('Legacy-Script nicht gefunden');
  let script = m[0].replace(/^<script>/, '').replace(/<\/script>$/, '');
  for (const p of patches) {
    if (!script.includes(p.find)) throw new Error(`Anker nicht gefunden: ${p.find}`);
    script = script.replace(p.find, p.replace);
  }
  return { body: html.replace(m[0], ''), script };
}

/** Kleiner, reproduzierbarer Zufallsgenerator (ersetzt Math.random im Legacy-Fenster). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface AudioSetup {
  seconds: number;
  channels?: 1 | 2;
  sampleRate?: number;
}

export interface LegacyOptions {
  seed?: number;
  /** ohne audio gibt es keinen AudioContext: Die App startet stumm (gut für Speicherstand-Tests). */
  audio?: AudioSetup;
  storage?: Readonly<Record<string, string>>;
  /** true = Legacy rendert die Drums selbst beim Anlegen des Kontexts vor */
  prerender?: boolean;
  instrument?: (ctx: OfflineAudioContext) => void;
}

export interface LegacyPage {
  window: DOMWindow;
  t: LegacyHooks;
  errors: string[];
  ctx(): OfflineAudioContext;
  setNow(seconds: number): void;
  close(): void;
}

export function loadLegacy(opts: LegacyOptions = {}): LegacyPage {
  const { body, script } = splitLegacy(readFileSync(LEGACY_HTML, 'utf8'));
  const errors: string[] = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e: Error) => errors.push(String(e.stack ?? e)));
  const dom = new JSDOM(body, {
    url: 'https://example.test/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole: vc,
  });
  const w = dom.window as DOMWindow & Record<string, unknown>;
  w.Math.random = mulberry32(opts.seed ?? 1);
  // node-web-audio-api erwartet Float32Arrays aus dem Node-Realm
  w.Float32Array = Float32Array;
  w.HTMLCanvasElement.prototype.getContext = () => null;
  for (const [k, v] of Object.entries(opts.storage ?? {})) w.localStorage.setItem(k, v);

  let now = 0;
  let ctx: OfflineAudioContext | null = null;
  if (opts.audio) {
    const { seconds, channels = 2, sampleRate = 44100 } = opts.audio;
    w.AudioContext = function () {
      const c = new wa.OfflineAudioContext(channels, Math.ceil(seconds * sampleRate), sampleRate);
      Object.defineProperty(c, 'currentTime', { get: () => now });
      opts.instrument?.(c);
      ctx = c;
      return c;
    };
    w.OfflineAudioContext = wa.OfflineAudioContext;
    w.__noPrerender = opts.prerender !== true;
  }

  w.eval(script);
  const t = w.__t as LegacyHooks | undefined;
  if (!t) throw new Error('Hook wurde nicht gesetzt');
  return {
    window: w,
    t,
    errors,
    ctx() {
      if (!ctx) throw new Error('Kein AudioContext: ensureAudio() aufrufen und audio-Option setzen');
      return ctx;
    },
    setNow(seconds) {
      now = seconds;
    },
    close() {
      w.close();
    },
  };
}
```

- [ ] **Step 5: Grün sehen**

```bash
[n] npx vitest run tests/reference/legacy/harness.test.ts
```
Expected: 7 PASS. Falls `loadLegacy` `errors` meldet (z. B. „Not implemented“ aus jsdom): Meldung lesen. Stammt sie aus einem Browser-API-Aufruf beim Start, das jsdom nicht kennt, dieses API in `loadLegacy` vor `w.eval` als leere Funktion bereitstellen und den Grund als Kommentar notieren. Die Legacy-Datei bleibt unverändert.

- [ ] **Step 6: Failing Tests für die Referenz-Verwaltung** – `tests/reference/golden.test.ts`

```ts
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readGolden } from './golden.ts';

describe('readGolden', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('scheitert, wenn die Referenz fehlt und nicht aktualisiert wird', () => {
    vi.stubEnv('REF_UPDATE', '');
    const dir = mkdtempSync(join(tmpdir(), 'golden-'));
    expect(() => readGolden('drums/BD', { a: 1 }, dir)).toThrow(/Referenz fehlt/);
  });

  it('schreibt nur mit REF_UPDATE=1 und liest danach die gespeicherte Referenz', () => {
    const dir = mkdtempSync(join(tmpdir(), 'golden-'));
    vi.stubEnv('REF_UPDATE', '1');
    expect(readGolden('drums/BD', { a: 1 }, dir)).toEqual({ a: 1 });
    expect(JSON.parse(readFileSync(join(dir, 'drums/BD.json'), 'utf8'))).toEqual({ a: 1 });
    vi.stubEnv('REF_UPDATE', '');
    // gespeicherter Wert gewinnt, nicht der aktuelle
    expect(readGolden('drums/BD', { a: 2 }, dir)).toEqual({ a: 1 });
  });
});
```

- [ ] **Step 7: Rot sehen, dann implementieren** – `tests/reference/golden.ts`

```bash
[n] npx vitest run tests/reference/golden.test.ts
```
Expected: FAIL, Modul nicht gefunden.

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('./golden/', import.meta.url));

/**
 * Liefert die gespeicherte Referenz für `name`.
 * Nur mit REF_UPDATE=1 wird stattdessen `actual` als neue Referenz geschrieben.
 */
export function readGolden<T>(name: string, actual: T, root: string = ROOT): T {
  const file = join(root, `${name}.json`);
  if (process.env.REF_UPDATE === '1') {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(actual, null, 1) + '\n');
    return actual;
  }
  if (!existsSync(file)) {
    throw new Error(`Referenz fehlt: ${file}. Mit "npm run ref:update" erzeugen.`);
  }
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}
```

```bash
[n] npx vitest run tests/reference/golden.test.ts
```
Expected: 2 PASS.

- [ ] **Step 8: Toleranzen und Vergleichshelfer**

`tests/reference/tolerance.ts`:
```ts
import type { Tolerance } from '../support/fingerprint.ts';

/**
 * Startwerte. Task 8 (Kalibrierung) prüft, dass Zufallsrauschen toleriert wird,
 * Tune +1 Halbton und Decay +10 % aber auffallen. Änderungen hier nur mit Kalibrierungslauf.
 */
export const TOLERANCE: Tolerance = {
  peakRel: 0.05,
  rmsFloorDb: -50,
  rmsMeanDb: 0.5,
  rmsMaxDb: 3,
  centroidRel: 0.03,
};
```

`tests/reference/expect.ts`:
```ts
import type { ExpectStatic } from 'vitest';
import { compareFingerprints, type Fingerprint } from '../support/fingerprint.ts';
import { readGolden } from './golden.ts';
import type { StereoPrint } from './legacy/scenarios.ts';
import { TOLERANCE } from './tolerance.ts';

export function expectPrint(expect: ExpectStatic, name: string, actual: Fingerprint): void {
  const golden = readGolden(name, actual);
  expect(compareFingerprints(golden, actual, TOLERANCE), name).toEqual([]);
}

export function expectStereo(expect: ExpectStatic, name: string, actual: StereoPrint): void {
  const golden = readGolden(name, actual);
  const problems = [
    ...compareFingerprints(golden.L, actual.L, TOLERANCE).map((p) => `L: ${p}`),
    ...compareFingerprints(golden.R, actual.R, TOLERANCE).map((p) => `R: ${p}`),
  ];
  expect(problems, name).toEqual([]);
}
```

- [ ] **Step 9: Szenarien-Grundgerüst, Runner und Prozess-Aufruf**

`tests/reference/legacy/scenarios.ts`:
```ts
import { fingerprint, type Fingerprint } from '../../support/fingerprint.ts';
import { loadLegacy, type LegacyPage } from './harness.ts';

export interface StereoPrint {
  L: Fingerprint;
  R: Fingerprint;
}

export async function renderStereo(p: LegacyPage): Promise<StereoPrint> {
  const buf = await p.ctx().startRendering();
  const right = buf.numberOfChannels > 1 ? 1 : 0;
  return {
    L: fingerprint(buf.getChannelData(0), buf.sampleRate),
    R: fingerprint(buf.getChannelData(right), buf.sampleRate),
  };
}

/** Prüft die Kette Kindprozess → jsdom → Audio: ein kurzer Synth-Ton. */
export async function smoke(): Promise<{ errors: string[]; peak: number }> {
  const p = loadLegacy({ audio: { seconds: 0.5 } });
  try {
    if (!p.t.ensureAudio()) throw new Error('Audio-Kontext fehlt');
    p.setNow(0.001);
    p.t.applyMixAll();
    p.setNow(0);
    p.t.synthNote('BA', 45, 0.05, 0.2);
    const print = await renderStereo(p);
    return { errors: p.errors, peak: print.L.peak };
  } finally {
    p.close();
  }
}

export const SCENARIOS: Record<string, (args: never) => Promise<unknown>> = { smoke };
```

`tests/reference/legacy/runner.ts`:
```ts
// Führt genau ein Referenz-Szenario in einem eigenen Prozess aus.
// node-web-audio-api ist bei mehreren Kontexten pro Prozess unzuverlässig.
// Aufruf: node tests/reference/legacy/runner.ts <szenario> '<json-argumente>'
import { SCENARIOS } from './scenarios.ts';

const [name = '', json = '{}'] = process.argv.slice(2);
const run = SCENARIOS[name] as ((args: unknown) => Promise<unknown>) | undefined;
if (!run) {
  console.error(`Unbekanntes Szenario: ${name}`);
  process.exit(2);
}
try {
  const result = await run(JSON.parse(json));
  process.stdout.write(`RESULT ${JSON.stringify(result)}\n`, () => process.exit(0));
} catch (e) {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
}
```

`tests/reference/run.ts`:
```ts
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const RUNNER = fileURLToPath(new URL('./legacy/runner.ts', import.meta.url));

/** Startet ein Legacy-Szenario in einem Kindprozess. Wiederholt bei Absturz der Audio-Bibliothek. */
export async function runLegacy<T>(name: string, args: object, attempts = 3): Promise<T> {
  let last = '';
  for (let i = 0; i < attempts; i++) {
    try {
      const { stdout } = await exec(process.execPath, [RUNNER, name, JSON.stringify(args)], {
        timeout: 180_000,
        maxBuffer: 64 * 1024 * 1024,
      });
      const line = stdout.split('\n').find((l) => l.startsWith('RESULT '));
      if (line) return JSON.parse(line.slice('RESULT '.length)) as T;
      last = `keine RESULT-Zeile: ${stdout.slice(-300)}`;
    } catch (e) {
      last = e instanceof Error ? e.message.slice(-800) : String(e);
    }
  }
  throw new Error(`Szenario ${name} ${JSON.stringify(args)} scheiterte ${attempts}×: ${last}`);
}
```

- [ ] **Step 10: Projekt `reference` und Skripte**

In `vitest.config.ts` das Array `projects` um ein zweites Projekt ergänzen:
```ts
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
```

In `package.json` unter `scripts`:
```json
"test:ref": "vitest run --project reference",
"ref:update": "REF_UPDATE=1 vitest run --project reference"
```

- [ ] **Step 11: Smoke-Test der Prozesskette** – `tests/reference/smoke.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { runLegacy } from './run.ts';

describe('Referenz-Infrastruktur', () => {
  it('Kindprozess rendert einen Legacy-Synth-Ton', async () => {
    const r = await runLegacy<{ errors: string[]; peak: number }>('smoke', {});
    expect(r.errors).toEqual([]);
    expect(r.peak).toBeGreaterThan(0.01);
  });

  it('unbekanntes Szenario scheitert mit klarer Meldung', async () => {
    await expect(runLegacy('gibtEsNicht', {}, 1)).rejects.toThrow(/gibtEsNicht/);
  });
});
```

```bash
[n] npm run test:ref && npm run test:unit
```
Expected: beide grün (`reference`: 2 PASS).

- [ ] **Step 12: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck
git add -A
[n] git commit -m "Referenz: Legacy-Harness, Kindprozess-Runner und Referenz-Verwaltung

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Referenz Speicherstände (`merge()` und Sample-Speicher)

**Files:**
- Create: `tests/reference/fixtures/saves.ts`
- Create: `tests/reference/merge.test.ts`
- Create (erzeugt): `tests/reference/golden/merge/*.json`

**Interfaces:**
- Consumes: `loadLegacy` (Task 6), `readGolden` (Task 6).
- Produces: `SAVES: Record<string, string | null>`, `SAMPLE_STORE: string`. Referenzdateien `merge/<name>.json`, `merge/sample-speicher.json`. Schritt 2 vergleicht das neue `merge()` gegen genau diese Dateien.

- [ ] **Step 1: Testdaten** – `tests/reference/fixtures/saves.ts`

```ts
const j = (v: unknown) => JSON.stringify(v);
const ones = () => new Array<number>(16).fill(1);

/** Rohwerte für localStorage['pocket808.v1']. null = nichts gespeichert. */
export const SAVES: Record<string, string | null> = {
  leer: null,
  kaputtesJson: '{nicht json',
  zahl: '42',
  array: '[1,2,3]',
  altFormatEinPattern: j({ tempo: 128, swing: 0.1, pat: { BD: 'x...x...x...x...', SD: '....x.......x...' } }),
  altFormatKompat: j({
    tempo: 100, swing: 0.2, master: 0.7, sel: 2,
    patterns: { A: { BD: 'x...x...x...x...' }, C: { SD: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] } },
    cur: 'C', song: [{ p: 'A', n: 2 }], mode: 'pattern', params: {}, preset: null,
  }),
  synthSus: j({ synth: { BA: { sus: 0.3, cut: 0.5, wave: 1 }, LD: { sus: 1, fa: 0.2 } } }),
  synthMute: j({ synth: { BA: { mute: true }, LD: { mute: false } } }),
  grenzwerte: j({
    tempo: 500, swing: -1, master: 2, sel: 99, key: 15, scale: 99, noteLen: 3,
    cur: 'Z', mode: 'x', part: 'XX',
    song: [{ p: 'A', n: 40 }, { p: 'Q', n: 1 }, null, { p: 'B' }, { p: 'C', n: 0.4 }],
    params: { BD: { level: 2, tune: -1, decay: 'a' } },
  }),
  subUndSampler: j({
    patterns: {
      A: {
        sub: {
          BD: { 0: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0], 16: ones() },
          XX: { 0: ones() },
          P3: { 2: new Array<number>(16).fill(0), 5: ones() },
        },
        smp: Array.from({ length: 8 }, (_, i) => (i === 0 ? ones() : 'kaputt')),
      },
    },
    smp: { sel: 3, pads: [{ start: 0.5, end: 0.51, name: 'ein sehr langer Name' }, { tune: 2, rev: true }] },
  }),
  mixUndFx: j({
    mix: { BD: { v: 0.3, p: 0, r: 0.9, m: true, s: false }, LD: { v: 'laut' }, XX: { v: 1 } },
    fx: { size: 0.9, dj: 1.5, unbekannt: 1 },
  }),
  notenAlt: j({
    patterns: {
      B: {
        notes: {
          BA: Array.from({ length: 16 }, (_, i) => (i % 4 === 0 ? { d: i % 12, l: 3.6 } : null)),
          LD: [{ d: 99, l: 1 }],
        },
      },
    },
  }),
};

const b64 = (xs: number[]) => Buffer.from(Int16Array.from(xs).buffer).toString('base64');

/** Rohwert für localStorage['pocket808.smp.v1']: Pad 0 geleert, Pad 5 eigenes Sample, eigenes BD-Sample, Müll. */
export const SAMPLE_STORE = j({
  0: { d: '' },
  5: { d: b64([0, 16383, -16384, 32767]) },
  'D:BD': { d: b64([1000, -1000]), n: 'Mein Kick' },
  'D:XX': { d: b64([1]) },
  9: { d: b64([1]) },
});
```

- [ ] **Step 2: Test schreiben** – `tests/reference/merge.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { SAMPLE_STORE, SAVES } from './fixtures/saves.ts';
import { readGolden } from './golden.ts';
import { loadLegacy } from './legacy/harness.ts';

const plain = (v: unknown): unknown => JSON.parse(JSON.stringify(v));

describe('Referenz: Laden von Speicherständen (merge)', () => {
  for (const [name, raw] of Object.entries(SAVES)) {
    it(name, () => {
      const p = loadLegacy({ storage: raw === null ? {} : { 'pocket808.v1': raw } });
      try {
        expect(p.errors).toEqual([]);
        const state = plain(p.t.serial());
        expect(state).toEqual(readGolden(`merge/${name}`, state));
      } finally {
        p.close();
      }
    });
  }

  it('Rundlauf: gespeicherter Stand lädt identisch', () => {
    const first = loadLegacy({ storage: { 'pocket808.v1': SAVES.subUndSampler ?? '' } });
    const saved = JSON.stringify(first.t.serial());
    first.close();
    const second = loadLegacy({ storage: { 'pocket808.v1': saved } });
    try {
      expect(JSON.stringify(second.t.serial())).toBe(saved);
    } finally {
      second.close();
    }
  });

  it('Sample-Speicher', () => {
    const p = loadLegacy({ storage: { 'pocket808.smp.v1': SAMPLE_STORE } });
    try {
      expect(p.errors).toEqual([]);
      const state = p.t.serial() as { smp: { pads: { name: string }[] } };
      const actual = {
        padNames: state.smp.pads.map((pad) => pad.name),
        padLengths: p.t.smpPcm.map((pcm) => pcm?.length ?? null),
        pad5: Array.from(p.t.smpPcm[5] ?? []).map((x) => Math.round(x * 1e4) / 1e4),
        drumBD: Array.from(p.t.drumPcm.BD ?? []).map((x) => Math.round(x * 1e4) / 1e4),
        drumKeys: Object.keys(p.t.drumPcm).sort(),
      };
      expect(actual).toEqual(readGolden('merge/sample-speicher', actual));
    } finally {
      p.close();
    }
  });
});
```

- [ ] **Step 3: Ohne Referenz rot sehen**

```bash
[n] npx vitest run --project reference tests/reference/merge.test.ts
```
Expected: FAIL mit `Referenz fehlt: …/golden/merge/leer.json` (und weitere).

- [ ] **Step 4: Referenzen erzeugen und prüfen**

```bash
[n] REF_UPDATE=1 npx vitest run --project reference tests/reference/merge.test.ts
[n] npx vitest run --project reference tests/reference/merge.test.ts
ls tests/reference/golden/merge/
```
Expected: zweiter Lauf 14 PASS. 13 JSON-Dateien (12 Speicherstände + `sample-speicher`).

- [ ] **Step 5: Stichprobe der Referenzen auf Plausibilität** (Migrationen sichtbar?)

```bash
node -e "const g=require('./tests/reference/golden/merge/synthSus.json');console.log(g.synth.BA.as, g.synth.LD.as, g.synth.LD.fa)"
node -e "const g=require('./tests/reference/golden/merge/synthMute.json');console.log(g.mix.BA.m, g.synth.BA.mute)"
node -e "const g=require('./tests/reference/golden/merge/grenzwerte.json');console.log(g.tempo, g.swing, g.master, g.song)"
```
Expected: `synthSus`: BA `as` ≈ 0,384 (0,12 + 0,88·0,3), LD `as` = 0,65 (Saw-Standard, weil das vorhandene `fa` die Umrechnung verhindert), LD `fa` = 0,2. `synthMute`: `true false`. `grenzwerte`: `200 0 1` und Song `[{p:'A',n:16},{p:'C',n:1}]`. Weicht etwas ab, ist das ein Befund über das Legacy-Verhalten: dem User zeigen, Referenz trotzdem so belassen (Referenz = heutiges Verhalten).

- [ ] **Step 6: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck
git add tests/reference
[n] git commit -m "Referenz: Speicherstände, Migrationen und Sample-Speicher

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Referenz Drum-Stimmen und Kalibrierung der Toleranzen

**Files:**
- Modify: `tests/reference/legacy/scenarios.ts` (Szenario `drumVariants`)
- Create: `tests/reference/drums.test.ts`, `tests/reference/calibration.test.ts`
- Modify (falls Kalibrierung es verlangt): `tests/reference/tolerance.ts`
- Create (erzeugt): `tests/reference/golden/drums/*.json`

**Interfaces:**
- Consumes: `loadLegacy`, `DrumParams`, `runLegacy`, `expectPrint`, `TOLERANCE`, `compareFingerprints`.
- Produces: Szenario `drumVariants(args: { voice: string; seed?: number; variants: Record<string, Partial<DrumParams>> }): Promise<Record<string, Fingerprint>>`. Referenzdateien `drums/<VOICE>-<variante>.json`.

- [ ] **Step 1: Szenario ergänzen** – in `tests/reference/legacy/scenarios.ts` Import und Funktion hinzufügen und in `SCENARIOS` eintragen

```ts
import type { DrumParams } from './types.ts';

/** Rendert eine Drum-Stimme über den Legacy-Vorrender-Pfad (renderVoice) in mehreren Parameter-Varianten. */
export async function drumVariants(args: {
  voice: string;
  seed?: number;
  variants: Record<string, Partial<DrumParams>>;
}): Promise<Record<string, Fingerprint>> {
  const p = loadLegacy({ seed: args.seed ?? 1, audio: { seconds: 1 } });
  try {
    if (!p.t.ensureAudio()) throw new Error('Audio-Kontext fehlt');
    const index = p.t.VOICES.findIndex((v) => v.id === args.voice);
    const params = p.t.state.params[args.voice];
    if (index < 0 || !params) throw new Error(`Unbekannte Stimme ${args.voice}`);
    const base = { ...params };
    const out: Record<string, Fingerprint> = {};
    for (const [name, change] of Object.entries(args.variants)) {
      Object.assign(params, base, change);
      // renderVoice verschluckt Fehler: alten Buffer entfernen, damit nichts Veraltetes durchrutscht
      delete p.t.voiceBuf[args.voice];
      await p.t.renderVoice(index);
      const buf = p.t.voiceBuf[args.voice];
      if (!buf) throw new Error(`Kein Buffer für ${args.voice}/${name}`);
      out[name] = fingerprint(buf.getChannelData(0), buf.sampleRate);
    }
    return out;
  } finally {
    p.close();
  }
}

export const SCENARIOS: Record<string, (args: never) => Promise<unknown>> = { smoke, drumVariants };
```
(Die bisherige `SCENARIOS`-Zeile wird durch die neue ersetzt.)

- [ ] **Step 2: Drum-Referenztest** – `tests/reference/drums.test.ts`

```ts
import { describe, it } from 'vitest';
import type { Fingerprint } from '../support/fingerprint.ts';
import { expectPrint } from './expect.ts';
import { runLegacy } from './run.ts';

const VOICES = ['BD', 'SD', 'LT', 'HT', 'RS', 'CP', 'CB', 'CH', 'OH', 'CY'] as const;
const VARIANTS = {
  default: {},
  tune0: { tune: 0 },
  tune1: { tune: 1 },
  decay0: { decay: 0 },
  decay1: { decay: 1 },
};

describe.concurrent('Referenz: Drum-Stimmen', () => {
  for (const voice of VOICES) {
    it(voice, async ({ expect }) => {
      const prints = await runLegacy<Record<string, Fingerprint>>('drumVariants', {
        voice,
        variants: VARIANTS,
      });
      for (const [variant, print] of Object.entries(prints)) {
        expectPrint(expect, `drums/${voice}-${variant}`, print);
      }
    });
  }
});
```

- [ ] **Step 3: Kalibrierungstest** – `tests/reference/calibration.test.ts`

```ts
import { describe, it } from 'vitest';
import { compareFingerprints, type Fingerprint } from '../support/fingerprint.ts';
import { runLegacy } from './run.ts';
import { TOLERANCE } from './tolerance.ts';

// Standardwerte aus legacy/index.html (DEFAULTS). Tune +0,08 ≈ +1 Halbton bei der BD (38 + 44·Tune Hz).
const CASES = {
  BD: { tune: 0.5, decay: 0.55 }, // tonal
  SD: { tune: 0.5, decay: 0.45 }, // Ton + Rauschen
  CH: { tune: 0.5, decay: 0.4 }, // metallisch, kurz
} as const;

type Prints = Record<string, Fingerprint>;

describe.concurrent('Kalibrierung der Klang-Toleranzen', () => {
  for (const [voice, d] of Object.entries(CASES)) {
    it(voice, async ({ expect }) => {
      const variants = { base: {}, tuneUp: { tune: d.tune + 0.08 }, decayUp: { decay: d.decay * 1.1 } };
      const [a, again, other] = await Promise.all([
        runLegacy<Prints>('drumVariants', { voice, seed: 1, variants }),
        runLegacy<Prints>('drumVariants', { voice, seed: 1, variants: { base: {} } }),
        runLegacy<Prints>('drumVariants', { voice, seed: 2, variants: { base: {} } }),
      ]);
      expect(again.base, 'gleicher Seed in zwei Prozessen ergibt identischen Fingerabdruck').toEqual(a.base);
      expect(compareFingerprints(a.base!, other.base!, TOLERANCE), 'anderes Zufallsrauschen muss toleriert werden').toEqual([]);
      expect(compareFingerprints(a.base!, a.tuneUp!, TOLERANCE).length, 'Tune +1 Halbton muss auffallen').toBeGreaterThan(0);
      expect(compareFingerprints(a.base!, a.decayUp!, TOLERANCE).length, 'Decay +10 % muss auffallen').toBeGreaterThan(0);
    });
  }
});
```

- [ ] **Step 4: Kalibrierung laufen lassen**

```bash
[n] npx vitest run --project reference tests/reference/calibration.test.ts
```
Expected: 3 PASS.

**Falls ein Fall scheitert**, nach dieser Regel vorgehen (und jede Änderung dem User berichten):
- *„identischer Fingerabdruck“ scheitert*: Es gibt eine nicht geseedete Zufallsquelle oder einen Zeitwettlauf. Ursache suchen (z. B. `grep -n "Math.random\|performance.now\|Date.now" legacy/index.html`) und in der Harness abstellen. Toleranzen **nicht** anfassen.
- *„Zufallsrauschen toleriert“ scheitert*: Die gemeldete Kennzahl in `tolerance.ts` um eine Stufe lockern (`rmsMeanDb` +0,25, `rmsMaxDb` +1, `centroidRel` +0,01, `peakRel` +0,02) und erneut laufen lassen. Wiederholen, bis es passt.
- *„Tune/Decay fällt auf“ scheitert* (auch nach einer Lockerung): **Anhalten.** Mit dem User besprechen, ob eine zusätzliche Kennzahl nötig ist. Nicht weiter lockern.

- [ ] **Step 5: Drum-Referenzen erzeugen und prüfen**

```bash
[n] REF_UPDATE=1 npx vitest run --project reference tests/reference/drums.test.ts
[n] npx vitest run --project reference tests/reference/drums.test.ts
ls tests/reference/golden/drums/ | wc -l
```
Expected: zweiter Lauf 10 PASS, 50 Dateien.

- [ ] **Step 6: Plausibilität**

```bash
node -e "for (const v of ['BD','CH','CY']) { const g=require('./tests/reference/golden/drums/'+v+'-default.json'); console.log(v, g.peak, g.centroidHz, g.length, g.nonFinite) }"
```
Expected: Spitzen zwischen 0,05 und 1,5, BD-Schwerpunkt deutlich unter dem von CH und CY, Längen entsprechend `VDUR` (BD 1,7 s = 74970 Samples, CH 0,3 s = 13230, CY 2,8 s = 123480), `nonFinite` 0.

- [ ] **Step 7: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck
git add tests/reference
[n] git commit -m "Referenz: Drum-Stimmen und kalibrierte Klang-Toleranzen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Referenz Synth-Presets und Fabrik-Samples

**Files:**
- Modify: `tests/reference/legacy/scenarios.ts` (Szenarien `synthPreset`, `samplerPad`)
- Create: `tests/reference/synth.test.ts`, `tests/reference/sampler.test.ts`
- Modify: `tests/reference/calibration.test.ts` (Synth-Fall)
- Create (erzeugt): `tests/reference/golden/synth/*.json`, `tests/reference/golden/sampler/*.json`

**Interfaces:**
- Consumes: `loadLegacy`, `renderStereo`, `StereoPrint`, `Part`, `runLegacy`, `expectStereo`.
- Produces: `synthPreset(args: { part: Part; preset: string; midi: number; seed?: number }): Promise<StereoPrint>`, `samplerPad(args: { pad: number; seed?: number }): Promise<StereoPrint>`.

- [ ] **Step 1: Szenarien ergänzen** – in `tests/reference/legacy/scenarios.ts`

```ts
import type { DrumParams, Part } from './types.ts';

/** Ein Synth-Ton mit Preset, durch Kanalzug, Delay und Master-Kette. Reverb aus (eigenes Mix-Szenario). */
export async function synthPreset(args: {
  part: Part;
  preset: string;
  midi: number;
  seed?: number;
}): Promise<StereoPrint> {
  const p = loadLegacy({ seed: args.seed ?? 1, audio: { seconds: 2 } });
  try {
    const { t } = p;
    const preset = t.SYN_PRESETS[args.part].find((x) => x.name === args.preset);
    if (!preset) throw new Error(`Unbekanntes Preset ${args.part}/${args.preset}`);
    t.state.tempo = 120;
    Object.assign(t.state.synth[args.part], preset.v);
    for (const ch of Object.values(t.state.mix)) ch.r = 0;
    if (!t.ensureAudio()) throw new Error('Audio-Kontext fehlt');
    p.setNow(0.001);
    t.applyMixAll();
    p.setNow(0);
    t.synthNote(args.part, args.midi, 0.1, 0.5);
    return await renderStereo(p);
  } finally {
    p.close();
  }
}

/** Ein Fabrik-Sample mit Standard-Pad-Einstellungen. */
export async function samplerPad(args: { pad: number; seed?: number }): Promise<StereoPrint> {
  const p = loadLegacy({ seed: args.seed ?? 1, audio: { seconds: 2 } });
  try {
    const { t } = p;
    const mix = t.state.mix.SM;
    if (!mix) throw new Error('Kanal SM fehlt');
    mix.r = 0;
    if (!t.ensureAudio()) throw new Error('Audio-Kontext fehlt');
    if (!t.smpPcm[args.pad]) throw new Error(`Pad ${args.pad} ist leer`);
    p.setNow(0.001);
    t.applyMixAll();
    p.setNow(0);
    t.smpPlay(args.pad, 0.1);
    return await renderStereo(p);
  } finally {
    p.close();
  }
}

export const SCENARIOS: Record<string, (args: never) => Promise<unknown>> = {
  smoke,
  drumVariants,
  synthPreset,
  samplerPad,
};
```
(Den bestehenden `import type { DrumParams }` durch den neuen ersetzen, die alte `SCENARIOS`-Zeile ersetzen.)

- [ ] **Step 2: Tests** – `tests/reference/synth.test.ts`

```ts
import { describe, it } from 'vitest';
import { expectStereo } from './expect.ts';
import type { StereoPrint } from './legacy/scenarios.ts';
import { runLegacy } from './run.ts';

// Bass auf A2 (MIDI 45), Lead auf A4 (MIDI 69)
const CASES = [
  ['BA', 'Sub', 45], ['BA', 'Acid', 45], ['BA', 'Pluck', 45],
  ['LD', 'Saw', 69], ['LD', 'Pulse', 69], ['LD', 'Soft', 69],
] as const;

describe.concurrent('Referenz: Synth-Presets', () => {
  for (const [part, preset, midi] of CASES) {
    it(`${part} ${preset}`, async ({ expect }) => {
      const print = await runLegacy<StereoPrint>('synthPreset', { part, preset, midi });
      expectStereo(expect, `synth/${part}-${preset}`, print);
    });
  }
});
```

`tests/reference/sampler.test.ts`:
```ts
import { describe, it } from 'vitest';
import { expectStereo } from './expect.ts';
import type { StereoPrint } from './legacy/scenarios.ts';
import { runLegacy } from './run.ts';

const PADS = [[0, 'Stab'], [1, 'Zap'], [2, 'Riser'], [3, 'Bell']] as const;

describe.concurrent('Referenz: Fabrik-Samples', () => {
  for (const [pad, name] of PADS) {
    it(name, async ({ expect }) => {
      const print = await runLegacy<StereoPrint>('samplerPad', { pad });
      expectStereo(expect, `sampler/${pad}-${name}`, print);
    });
  }
});
```

- [ ] **Step 3: Synth-Fall in der Kalibrierung** – in `tests/reference/calibration.test.ts` ergänzen (Import `StereoPrint` aus `./legacy/scenarios.ts`):

```ts
describe('Kalibrierung: Synth', () => {
  it('BA Acid einen Halbton höher fällt auf', async () => {
    const [base, up] = await Promise.all([
      runLegacy<StereoPrint>('synthPreset', { part: 'BA', preset: 'Acid', midi: 45 }),
      runLegacy<StereoPrint>('synthPreset', { part: 'BA', preset: 'Acid', midi: 46 }),
    ]);
    expect(compareFingerprints(base.L, up.L, TOLERANCE).length).toBeGreaterThan(0);
  });
});
```
(`expect` zusätzlich aus `vitest` importieren.)

- [ ] **Step 4: Laufen lassen, Referenzen erzeugen, erneut prüfen**

```bash
[n] npx vitest run --project reference tests/reference/calibration.test.ts
[n] REF_UPDATE=1 npx vitest run --project reference tests/reference/synth.test.ts tests/reference/sampler.test.ts
[n] npx vitest run --project reference tests/reference/synth.test.ts tests/reference/sampler.test.ts
```
Expected: Kalibrierung 4 PASS. Synth und Sampler 10 PASS, 10 Referenzdateien. Scheitert der Synth-Kalibrierfall, gilt die Regel aus Task 8, Step 4.

- [ ] **Step 5: Plausibilität**

```bash
node -e "for (const f of ['synth/BA-Acid','synth/LD-Saw','sampler/2-Riser']) { const g=require('./tests/reference/golden/'+f+'.json'); console.log(f, g.L.peak, g.L.centroidHz, g.L.nonFinite, g.R.peak) }"
```
Expected: Spitzen > 0,01, `nonFinite` 0, L und R gleich laut (Pan in der Mitte).

- [ ] **Step 6: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck
git add tests/reference
[n] git commit -m "Referenz: Synth-Presets und Fabrik-Samples

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Referenz Mix-Szenarien und Master-Pegel

**Files:**
- Modify: `tests/reference/legacy/scenarios.ts` (Szenario `mixScenario`, Tabelle `MIX`)
- Create: `tests/reference/mix.test.ts`
- Create (erzeugt): `tests/reference/golden/mix/*.json`

**Interfaces:**
- Consumes: `loadLegacy`, `renderStereo`, `row`, `LegacyHooks`, `runLegacy`, `expectStereo`.
- Produces: `mixScenario(args: { name: string; seed?: number }): Promise<StereoPrint>`, `MIX_NAMES: readonly string[]`.

- [ ] **Step 1: Szenarien ergänzen** – in `tests/reference/legacy/scenarios.ts`

```ts
import { row, type DrumParams, type LegacyHooks, type Part } from './types.ts';

/** Leert alle Patterns und stellt einen neutralen Ausgangszustand her (wie mixlib.clearAll). */
function isolate(t: LegacyHooks): void {
  for (const pat of Object.values(t.state.patterns)) {
    for (const v of t.VOICES) row(pat, v.id).fill(0);
    pat.notes.BA.fill(null);
    pat.notes.LD.fill(null);
    for (const r of pat.smp) r.fill(0);
    pat.sub = {};
  }
  t.state.mode = 'pattern';
  t.state.cur = 'A';
  const a = t.state.patterns.A;
  if (!a) throw new Error('Pattern A fehlt');
  t.state.pat = a;
  t.state.tempo = 120;
}

function hits(t: LegacyHooks, steps: Record<string, number[]>): void {
  const a = t.state.patterns.A;
  if (!a) throw new Error('Pattern A fehlt');
  for (const [id, list] of Object.entries(steps)) for (const s of list) row(a, id)[s] = 1;
}

const mixOf = (t: LegacyHooks, id: string) => {
  const ch = t.state.mix[id];
  if (!ch) throw new Error(`Kanal ${id} fehlt`);
  return ch;
};

interface MixCase {
  seconds: number;
  setup: (t: LegacyHooks) => void;
  events?: { at: number; run: (t: LegacyHooks) => void }[];
}

const MIX: Record<string, MixCase> = {
  // Startzustand der App: Hip-Hop-Pattern A mit Bass, Lead und Sampler, Tempo 90, Swing
  demo: { seconds: 4, setup: () => undefined },
  reverbWet: {
    seconds: 2.4,
    setup: (t) => {
      isolate(t);
      hits(t, { SD: [0] });
      mixOf(t, 'SD').r = 1;
      t.state.fx.ret = 1;
      t.state.fx.size = 0.8;
    },
  },
  djLowpass: {
    seconds: 1.4,
    setup: (t) => {
      isolate(t);
      hits(t, { CH: [0, 2, 4], CY: [0] });
      t.state.fx.dj = 0.05;
    },
  },
  djHighpass: {
    seconds: 1.4,
    setup: (t) => {
      isolate(t);
      hits(t, { BD: [0] });
      t.state.fx.dj = 0.95;
    },
  },
  panRight: {
    seconds: 1,
    setup: (t) => {
      isolate(t);
      hits(t, { BD: [0] });
      mixOf(t, 'BD').p = 1;
      mixOf(t, 'BD').r = 0;
    },
  },
  stutter: {
    seconds: 1.7,
    setup: (t) => {
      isolate(t);
      hits(t, { BD: [0] });
      mixOf(t, 'BD').r = 0;
    },
    events: [{ at: 0.1, run: (t) => t.stutterOn(0.125) }],
  },
};

export const MIX_NAMES = Object.keys(MIX);

/** Spielt ein Pattern über den Legacy-Scheduler (pump im 25-ms-Takt) und rendert den Master. */
export async function mixScenario(args: { name: string; seed?: number }): Promise<StereoPrint> {
  const sc = MIX[args.name];
  if (!sc) throw new Error(`Unbekanntes Mix-Szenario ${args.name}`);
  const p = loadLegacy({ seed: args.seed ?? 1, audio: { seconds: sc.seconds } });
  try {
    const { t } = p;
    sc.setup(t);
    if (!t.ensureAudio()) throw new Error('Audio-Kontext fehlt');
    await t.prerenderAll();
    p.setNow(0.001);
    t.applyMixAll();
    p.setNow(0);
    t.begin();
    const pending = [...(sc.events ?? [])];
    for (let now = 0; now < sc.seconds; now += 0.025) {
      p.setNow(now);
      while (pending[0] && pending[0].at <= now) pending.shift()?.run(t);
      t.pump();
    }
    return await renderStereo(p);
  } finally {
    p.close();
  }
}
```
`SCENARIOS` um `mixScenario` ergänzen. Den Typ-Import zur obigen Form zusammenführen.

- [ ] **Step 2: Test** – `tests/reference/mix.test.ts`

```ts
import { describe, it } from 'vitest';
import { expectStereo } from './expect.ts';
import { MIX_NAMES, type StereoPrint } from './legacy/scenarios.ts';
import { runLegacy } from './run.ts';

describe.concurrent('Referenz: Mix und FX', () => {
  for (const name of MIX_NAMES) {
    it(name, async ({ expect }) => {
      const print = await runLegacy<StereoPrint>('mixScenario', { name });
      expectStereo(expect, `mix/${name}`, print);
      if (name === 'demo') {
        // CLAUDE.md: Master-Pegel ist auf Spitze ≈ 0,77 abgestimmt
        const peak = Math.max(print.L.peak, print.R.peak);
        expect(peak, `Master-Spitze ${peak}`).toBeGreaterThan(0.72);
        expect(peak, `Master-Spitze ${peak}`).toBeLessThan(0.82);
      }
      if (name === 'panRight') {
        expect(Math.max(...print.R.rmsDb)).toBeGreaterThan(Math.max(...print.L.rmsDb) + 6);
      }
    });
  }
});
```

- [ ] **Step 3: Referenzen erzeugen und prüfen**

```bash
[n] REF_UPDATE=1 npx vitest run --project reference tests/reference/mix.test.ts
[n] npx vitest run --project reference tests/reference/mix.test.ts
```
Expected: 6 PASS, 6 Referenzdateien. Scheitert die Master-Spitze (0,72–0,82), ist das ein Befund: gemessenen Wert dem User melden und die Spanne **nicht** eigenmächtig verschieben.

- [ ] **Step 4: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck
git add tests/reference
[n] git commit -m "Referenz: Mix-Szenarien und Master-Pegel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Performance-Budget (Bench)

**Files:**
- Modify: `tests/reference/legacy/scenarios.ts` (Szenario `bench`)
- Create: `tests/reference/bench.test.ts`
- Modify: `vitest.config.ts` (Projekt `bench`), `package.json` (Skript `bench`)
- Create (erzeugt): `tests/reference/golden/bench/demo.json`, `…/worst.json`

**Interfaces:**
- Consumes: `loadLegacy` mit `instrument`, `runLegacy`, `readGolden`.
- Produces: `bench(args: { load: 'demo' | 'worst' }): Promise<BenchResult>`, `interface BenchResult { renderMs: number; nodesPerSecond: number; counts: Record<string, number> }`. npm-Skript `bench`.

- [ ] **Step 1: Szenario ergänzen** – in `tests/reference/legacy/scenarios.ts`

```ts
export interface BenchResult {
  renderMs: number;
  /** pro Sekunde Musik erzeugte Audio-Knoten (deterministisch) */
  nodesPerSecond: number;
  counts: Record<string, number>;
}

const COUNTED = [
  'createOscillator',
  'createBufferSource',
  'createGain',
  'createBiquadFilter',
  'createWaveShaper',
  'createDelay',
  'createDynamicsCompressor',
] as const;

/** Port von legacy/tests/bench.cjs: 7 s spielen, 8 s rendern, Knoten zählen. */
export async function bench(args: { load: 'demo' | 'worst' }): Promise<BenchResult> {
  const counts: Record<string, number> = Object.fromEntries(COUNTED.map((n) => [n, 0]));
  const p = loadLegacy({
    audio: { seconds: 8 },
    instrument: (c) => {
      const target = c as unknown as Record<string, (...a: unknown[]) => unknown>;
      for (const name of COUNTED) {
        const orig = target[name]!.bind(c);
        target[name] = (...a: unknown[]) => {
          counts[name] = (counts[name] ?? 0) + 1;
          return orig(...a);
        };
      }
    },
  });
  try {
    const { t } = p;
    if (args.load === 'worst') {
      // jede laute Drum-Spur mit Sub-Roll auf jedem zweiten Step
      const a = t.state.patterns.A!;
      for (const id of ['BD', 'SD', 'CH', 'OH', 'CP', 'CY']) {
        const sub: Record<number, number[]> = {};
        for (let s = 0; s < 16; s += 2) sub[s] = Array.from({ length: 16 }, (_, k) => (k % 2 === 0 ? 1 : 0));
        a.sub[id] = sub;
      }
    }
    t.state.tempo = 120;
    t.state.mode = 'pattern';
    t.state.cur = 'A';
    t.state.pat = t.state.patterns.A!;
    if (!t.ensureAudio()) throw new Error('Audio-Kontext fehlt');
    await t.prerenderAll();
    for (const k of Object.keys(counts)) counts[k] = 0;
    t.begin();
    for (let now = 0; now < 7; now += 0.025) {
      p.setNow(now);
      t.pump();
    }
    const t0 = performance.now();
    await p.ctx().startRendering();
    const renderMs = Math.round(performance.now() - t0);
    const total = Object.values(counts).reduce((x, y) => x + y, 0);
    return { renderMs, nodesPerSecond: Math.round(total / 7), counts };
  } finally {
    p.close();
  }
}
```
`SCENARIOS` um `bench` ergänzen.

- [ ] **Step 2: Test** – `tests/reference/bench.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { readGolden } from './golden.ts';
import type { BenchResult } from './legacy/scenarios.ts';
import { runLegacy } from './run.ts';

// Renderzeit schwankt je nach Rechnerlast; Knotenzahl ist deterministisch und wird streng geprüft.
const RENDER_SLACK = 1.5;

describe('Performance-Budget', () => {
  for (const load of ['demo', 'worst'] as const) {
    it(load, async () => {
      const r = await runLegacy<BenchResult>('bench', { load });
      const g = readGolden(`bench/${load}`, r);
      expect(r.nodesPerSecond, 'Audio-Knoten pro Sekunde').toBeLessThanOrEqual(g.nodesPerSecond);
      expect(r.renderMs, 'Renderzeit 8 s Audio').toBeLessThanOrEqual(g.renderMs * RENDER_SLACK);
    });
  }
});
```

- [ ] **Step 3: Projekt und Skript**

In `vitest.config.ts` ein drittes Projekt ergänzen:
```ts
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
```
In `package.json`: `"bench": "vitest run --project bench"` und `"bench:update": "REF_UPDATE=1 vitest run --project bench"`.

- [ ] **Step 4: Ausgangswerte erzeugen und prüfen**

```bash
[n] npm run bench:update && cat tests/reference/golden/bench/demo.json tests/reference/golden/bench/worst.json
[n] npm run bench
```
Expected: zweiter Lauf 2 PASS. `nodesPerSecond` und Größenordnung von `renderMs` mit den Werten aus Task 1, Step 9 vergleichen (alter Bench) und beides im Abschlussbericht nennen. Deutlich andere Knotenzahlen als im alten Bench (> 10 %) sind ein Hinweis auf einen Fehler im Port: Ursache klären, bevor committet wird.

- [ ] **Step 5: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck
git add -A
[n] git commit -m "Referenz: Performance-Budget für Render-Last

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Gesamtlauf, Git-Hook vervollständigen, Doku, Abschluss

**Files:**
- Modify: `package.json` (Skript `test`, Hook)
- Modify: `CLAUDE.md`, `README.md` (Abschnitt Entwickeln/Entwicklung)

**Interfaces:**
- Produces: `npm test` führt alle Ebenen aus.

- [ ] **Step 1: Gesamtskript** – in `package.json`:

```json
"test": "npm run test:unit && npm run test:ref && npm run test:e2e && npm run test:legacy"
```

- [ ] **Step 2: Gesamtlauf mit Zeitmessung**

```bash
[n] time npm run test:unit && time npm run test:ref && npm run test:e2e && npm run test:legacy
```
Expected: alles grün. Dauer von `test:unit` und `test:ref` notieren.

- [ ] **Step 3: Hook um Referenztests ergänzen** (Spezifikation: Ebenen 1–2 vor jedem Commit)

```json
"simple-git-hooks": {
  "pre-commit": "npm run lint && npm run typecheck && npm run test:unit && npm run test:ref"
}
```
```bash
[n] npx simple-git-hooks
```
Dauert `test:ref` länger als 60 Sekunden: dem User die gemessene Zeit nennen und fragen, ob die Audio-Referenzen im Hook bleiben oder nur `merge.test.ts` dort läuft.

- [ ] **Step 4: Doku aktualisieren**

In `CLAUDE.md` den Codeblock unter „## Entwickeln und testen“ ersetzen durch:

````markdown
```sh
nvm use               # Node 24 laut .nvmrc
npm install
npm test              # alles: Unit, Referenz, E2E, alte Tests
npm run test:unit     # schnell: Unit- und Werkzeugtests
npm run test:ref      # Referenz: Klang-Fingerabdrücke und Speicherstände gegen legacy/
npm run test:e2e      # Playwright auf Mobile, Tablet, Desktop
npm run bench         # Performance-Budget (Knoten/s, Renderzeit)
npm run lint && npm run typecheck
npm run dev           # Vite-Dev-Server
npm run build         # dist/index.html (eine Datei)
```

- Referenzen neu erzeugen nur bewusst: `npm run ref:update`, `npm run bench:update`, `AXE_UPDATE=1 npx playwright test a11y`, `npx playwright test layout --update-snapshots`. Danach den Diff prüfen.
- Klang-Toleranzen stehen in `tests/reference/tolerance.ts` und sind kalibriert (`tests/reference/calibration.test.ts`).
- Audio-Tests laufen je Szenario in einem eigenen Kindprozess (`tests/reference/run.ts`).
````

Die Zeile „Übergangsphase (Branch `fundament`) …“ aus Task 1 bleibt darunter stehen. Die veralteten Hinweise „Nach Engine-Änderungen `npm run bench` ausführen“ (Abschnitt Performance) bleiben gültig, weil `npm run bench` jetzt das neue Budget prüft. Den Hinweis unter „Architektur“ zu `tests/synth-test.js` ersetzen durch „(`tests/reference/mix.test.ts`, Szenario `demo`)“.

`README.md` Abschnitt „## Entwicklung“: dieselben Befehle übernehmen (ohne die Hinweis-Liste).

- [ ] **Step 5: Commit**

```bash
git add -A
[n] git commit -m "Gerüst: Gesamt-Testlauf, Hook mit Referenztests, Doku

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Abschlussbericht an den User** (Checkpoint: Freigabe für Schritt 2 einholen)

Inhalt:
- Liste der Commits (`git log --oneline main..fundament`).
- Testzahlen je Ebene und Laufzeiten.
- Kalibrierte Toleranzwerte (falls geändert: was und warum).
- Gemessene Master-Spitze im Demo-Szenario.
- Bench: alter Wert (Task 1) vs. neue Referenz (Task 11).
- Inhalt der axe-Baseline (bekannte Barrierefreiheits-Verstöße).
- Befunde über die Legacy-App (z. B. horizontaler Scroll, merkwürdige Migrationen), falls aufgetreten.
- Nächster Schritt: Plan für Schritt 2 (`core`). Dort kommen auch `@vitest/coverage-v8` und die 90-%-Abdeckungsschwelle dazu. Vitest Browser Mode folgt mit Schritt 5 (UI).
