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
