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
