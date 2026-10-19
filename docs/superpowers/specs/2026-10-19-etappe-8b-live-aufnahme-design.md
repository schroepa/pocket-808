# Etappe 8b: Live-Aufnahme mit Count-in – Spezifikation

Stand: 2026-10-19. Zweiter Teil der Roadmap-Etappe 8. Der Auftrag lautet „ohne Rückfragen“, deshalb sind die Entscheidungen hier begründet.

## Ziel

Während das Pattern läuft, spielst du Drums, Pads und Noten ein, und sie landen im Pattern, auf den nächsten Step gerastet (Quantize), wie bei den Pocket Operators und dem EP-133.

## Entscheidungen

- **Overdub:** Aufnehmen fügt nur hinzu und löscht nie. Schläge auf schon gesetzte Steps ändern nichts.
- **Quantize:** immer auf den **nächsten Step** (nicht nur nach vorn). Liegt der nächste geplante Step weiter als einen Step entfernt, wird nichts aufgenommen.
- **Ein Take = ein Zurück-Schritt:** Das erste aufgenommene Ereignis eines Takes legt einen Zurück-Schritt an. Alle weiteren Schläge bis zum Stopp (oder bis Aufnahme aus) gehören dazu. So füllt eine Aufnahme den Stapel nicht.
- **Count-in:** Wird mit *Rec* scharf gestartet, zählt ein Takt aus vier Klicks (der erste höher) vor, dann beginnt das Pattern. Läuft die Wiedergabe schon, schaltet *Rec* sofort ohne Vorzähler auf Aufnahme. Der Vorzähler ist fest (1 Takt) und hat keinen Schalter. Während des Vorzählers bleiben Aufnahmen auf die letzten 0,2 s begrenzt (sie rasten auf Step 1).
- **Song-Modus:** Aufgenommen wird in das Pattern, das an dieser Stelle läuft (nicht in das gewählte).
- **Metronom:** Nur der Vorzähler klingt. Der Export hört ihn nie.
- **Was sich aufnehmen lässt (Tippflächen):**
  - **Drums:** die Spurnamen in „Spuren“ (BD, SD, …).
  - **Sampler:** die acht Pads (ohne Tonhöhe) und die melodische Tastatur (die Halbtöne landen als Pitch `n` des Steps).
  - **Synth:** die Tonnamen am linken Rand der Piano-Roll (Länge = gewählte Notenlänge) für den gewählten Part.

## Technik

- **Engine:** `setRecording(on)` und das Signal `recording`; `takeId` zählt hoch, wenn eine neue Aufnahme beginnt (Start, Rec an). `nearestStep()` liefert `{ step, slot }` zum nächsten geplanten Step (Vorlauf und die letzten gespielten). Der Vorzähler plant vier Klicks (je ein Oszillator mit Gain, nur während des Vorzählers) und verschiebt den Beginn um einen Takt.
- **core/record.ts:** `recordHit(state, hit)` mit `hit` = Drum (voice, step, slot), Pad (pad, step, slot, semis) oder Note (part, degree, step, slot, length). Reine Funktion, setzt nur, löscht nie.
- **Store:** `beginTake()` (Zurück-Schritt) und `recordHit(hit)`.
- **UI:** Knopf **Rec** in der Transportleiste (Glow, wenn scharf), `ui/record.ts` verbindet Tippflächen, Engine und Store; das LCD meldet jeden aufgenommenen Schlag („REC · SD · Step 5“).

## Tests

- **core:** Drum, Pad (mit Pitch), Note in beliebigen Slots, Overdub löscht nichts, Sub-Steps und Optionen bleiben.
- **Engine:** `nearestStep` (nächster Step, außerhalb nichts, Song-Slot), Vorzähler (vier Klicks, Start verschoben, nur bei scharf), `takeId`.
- **Store:** Take = ein Zurück-Schritt.
- **UI:** Rec-Knopf, Tippflächen nehmen nur bei laufender Wiedergabe und Rec auf, Meldung.
- **E2E:** Rec scharf, Start, Spurname tippen: Step erscheint; Zurück nimmt den Take zurück.
