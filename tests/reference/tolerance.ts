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
  lowCentroidRel: 0.03,
};
