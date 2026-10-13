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
    rules: {
      // Zahlen in Template-Strings sind unbedenklich (Messwerte in Meldungen)
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  { files: ['**/*.js'], extends: [tseslint.configs.disableTypeChecked] },
  {
    // DSP- und Test-Hilfscode indiziert Typed Arrays in engen Schleifen
    files: ['tests/**/*.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  forbid(
    ['src/core/**/*.ts'],
    ['store', 'audio', 'ui', 'platform', 'main'],
    'core ist reine Logik und importiert keine anderen Schichten.',
  ),
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
