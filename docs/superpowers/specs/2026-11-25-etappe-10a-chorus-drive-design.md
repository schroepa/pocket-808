# Etappe 10a: Chorus und Drive pro Part – Entwurf (kurz)

Stand: 2026-11-25. Erster von drei Schritten, um den Synth reicher zu machen. Freigegeben am 2026-11-25, mit der Änderung, dass die Presets die Effekte gleich nutzen.

## Absicht

Der Synth klingt dem Besitzer zu „einfach“. Gewünscht sind **breitere Flächen, fettere Bässe und lebendige Leads**. Schritt 1 liefert mit dem kleinsten Aufwand den größten hörbaren Gewinn bei Breite und Druck.

## Wege

| Weg | Gewinn | Preis |
|---|---|---|
| **A) Jetzige Stimme ausbauen** (gewählt) | schrittweise hörbar, alte Stände unverändert | Grenzen der Browser-Bausteine |
| B) Eigener Synth-Kern (AudioWorklet) | klanglich am freiesten | Neubau, Risiko für Knackser und Akku, Klangtests neu, Artifact ungeprüft |
| C) OP-1-Engines | neue Klangfarben | macht vorhandene Bässe und Flächen nicht fetter oder breiter |

Gewählt am 2026-11-25: **A, nacheinander**; C später daraufsetzen. Folgeschritte (eigene Entwürfe): 10b Unisono, Pulsbreite, Rauschen, mehr Sub; 10c zweiter LFO, Mod-Hüllkurve, Anschlag aufs Filter.

## Ziele

- Je Part (Bass, Lead) zwei Regler: **Drive** (Sättigung) und **Chorus** (Breite), 0 bis 100 %.
- **Drive** macht Töne obertonreich und dicht. Die Lautheit bleibt etwa gleich, und die Stärke hängt nicht vom Level-Regler ab.
- **Chorus** macht den Klang stereo-breit. Die tiefen Anteile (unter etwa 250 Hz) bleiben mittig, damit Bässe nicht verschwimmen. In Mono darf nichts wegbrechen.
- Wirkt in Wiedergabe, Vorhören, WAV-Export und Bounce; das Delay erhält das bearbeitete Signal.

## Nicht-Ziele

- Keine Effekte für Drums oder Sampler.
- Die Vorlagen werden nicht einzeln neu abgestimmt; sie erben die Effekte ihrer Presets.
- Kein Unisono, keine neuen Wellenformen (10b).

## Bedienung

- Neues Synth-Modul **„Effekt“** mit den Knobs Drive und Chorus. Doppeltipp setzt auf 0. Das LCD zeigt Prozent.
- Touch-Ziele ≥ 44 px, Design-Regeln aus CLAUDE.md.
- **Synth-Presets setzen Drive und Chorus** passend zu ihrem Charakter (auch zurück auf 0): Bässe vor allem Drive, Flächen und Leads vor allem Chorus. Arp und LFO bleiben wie bisher unberührt.
- Geladene Vorlagen („Alles“ oder „Sound“) übernehmen die Werte ihrer Presets.
- Wer an Drive oder Chorus dreht, hebt die Preset-Markierung auf (wie bei den anderen Klang-Reglern).
- Der Startzustand und gespeicherte Stände bleiben unverändert: Die neuen Werte wirken erst, wenn ein Preset oder eine Vorlage geladen wird.

## Speicherformat

`SynthPatch.drive?` und `SynthPatch.chorus?` (0..1). Bei 0 fehlt das Feld; alte Stände bleiben bytegleich. Lesen nur gültiger Zahlen, begrenzt auf 0..1.

## Rahmen

- Feste Knoten je Part, **kein zusätzlicher Knoten pro Note**.
- Die Knoten entstehen erst, wenn ein Regler über 0 steht, und verschwinden wieder bei 0. Dauerhaft laufende Oszillatoren nur, solange Chorus an ist.
- Kein Knacksen beim Drehen, Ein- und Ausschalten (verankerte Automation, `rampFrom`).
- Bei beiden Reglern auf 0 klingt alles wie bisher; die Referenztests gelten unverändert.

## Fertig, wenn

- Referenztests und `npm run bench` unverändert grün sind.
- Beide Regler auf Maximum nicht übersteuern und die Lautheit höchstens 3 dB vom trockenen Klang abweicht.
- Der Chorus links und rechts hörbar verschieden ist, die Bässe mittig bleiben.
- Der Besitzer auf dem iPhone breitere Flächen und fettere Bässe hört, ohne Knackser.

## Dem Umsetzer überlassen

Kennlinie und Oversampling der Sättigung, Verzögerungszeiten und Modulationsraten des Chorus, genaue Pegel-Kompensation, Platz des Moduls im Raster.
