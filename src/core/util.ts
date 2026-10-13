/** Wert, der laut Datenmodell vorhanden sein muss (z. B. Index < Länge). Wirft statt still undefined. */
export function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Fehlt: ${what}`);
  return value;
}
