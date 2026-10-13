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
