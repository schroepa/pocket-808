import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Verbietet Importe aus den genannten Schichten (Schichtregel aus der Spezifikation). */
const forbid = (files, layers, message, extraPatterns = []) => ({
  files,
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          { regex: `(^|/)(${layers.filter((l) => l !== 'main').join('|')})(/|$)`, message },
          ...(layers.includes('main') ? [{ regex: '(^|/)main(\\.[cm]?[jt]s)?$', message }] : []),
          ...extraPatterns,
        ],
      },
    ],
  },
});

/** core hängt von nichts ab: keine Pakete, keine Node-Module, keine Browser-APIs außer diesen. */
const CORE_ALLOWED_GLOBALS = new Set(['atob', 'btoa', 'structuredClone']);
const coreForbiddenGlobals = Object.keys(globals.browser).filter(
  (name) => !CORE_ALLOWED_GLOBALS.has(name),
);

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
    rules: {
      // Zahlen in Template-Strings sind unbedenklich (Messwerte in Meldungen)
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  { files: ['**/*.js'], extends: [tseslint.configs.disableTypeChecked] },
  {
    // DSP- und Test-Hilfscode indiziert Typed Arrays in engen Schleifen
    files: ['tests/**/*.ts', 'src/**/*.test.ts', 'src/core/test-utils.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression',
          message: 'Keine dynamischen Importe: Schichtgrenzen wären nicht prüfbar.',
        },
      ],
    },
  },
  {
    ...forbid(
      ['src/core/**/*.ts'],
      ['store', 'audio', 'ui', 'platform', 'main'],
      'core ist reine Logik und importiert keine anderen Schichten.',
      [{ regex: '^[^.]', message: 'core importiert keine Pakete oder Node-Module.' }],
    ),
    ignores: ['src/core/**/*.test.ts', 'src/core/test-utils.ts'],
  },
  {
    files: ['src/core/**/*.ts'],
    ignores: ['src/core/**/*.test.ts', 'src/core/test-utils.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...coreForbiddenGlobals.map((name) => ({
          name,
          message: 'core ist frei von Browser-APIs (nur atob, btoa, structuredClone).',
        })),
      ],
    },
  },
  forbid(
    ['src/store/**/*.ts'],
    ['audio', 'ui', 'platform', 'main'],
    'store darf nur core importieren.',
  ),
  forbid(
    ['src/audio/**/*.ts'],
    ['ui', 'main'],
    'audio und ui kennen einander nicht. Verbindung nur über main.ts.',
  ),
  forbid(
    ['src/ui/**/*.ts'],
    ['audio', 'main'],
    'audio und ui kennen einander nicht. Verbindung nur über main.ts.',
  ),
  forbid(
    ['src/platform/**/*.ts'],
    ['store', 'audio', 'ui', 'main'],
    'platform importiert nur core.',
  ),
);
