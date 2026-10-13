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
