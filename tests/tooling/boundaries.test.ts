import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
// Ohne Typprüfung: Die Dateien existieren nur virtuell, es geht nur um die Import-Regel.
const eslint = new ESLint({ cwd: ROOT, overrideConfig: [tseslint.configs.disableTypeChecked] });

async function importErrors(filePath: string, specifier: string): Promise<string[]> {
  const [result] = await eslint.lintText(
    `import { x } from '${specifier}';\nexport const y = x;\n`,
    {
      filePath,
    },
  );
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
