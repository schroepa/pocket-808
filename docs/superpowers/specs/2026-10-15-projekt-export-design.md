# Projekt sichern/öffnen und WAV-Export – Spezifikation

Stand: 2026-10-15. Roadmap-Etappe 2 aus `CLAUDE.md`. Vom Besitzer im Gespräch bestätigt. Gewählt wurden nur WAV, Pattern und Song, Samples in der Datei und ein Datei-Knopf in der Kopfzeile.

## Ziel

- Ein Projekt soll vollständig als Datei gesichert werden: Zustand und eigene Samples.
- Auf jedem Gerät soll es sich wieder öffnen lassen.
- Der Beat soll sich als WAV herausgeben lassen, zum Anhören, Teilen oder für eine DAW.
- Das Ganze muss auf dem iPhone bequem funktionieren.

## Nicht enthalten

- MP3 und andere komprimierte Formate
- Einzelspuren (Stems)
- Cloud-Speicher
- Mehrere Projekte in der App verwalten

## 1. Projektdatei

- Dateiname: `pocket808-<JJJJ-MM-TT>.pocket808.json`.
- MIME-Typ: `application/json`.
- Aufbau:

```json
{
  "format": "pocket808",
  "version": 1,
  "app": "0.17.0",
  "saved": "2026-10-15T12:00:00.000Z",
  "state": { "…": "Zustand wie unter pocket808.v1 (serialize)" },
  "samples": {
    "pads": { "0": "<base64>", "3": "" },
    "drums": { "BD": { "d": "<base64>", "n": "Kick" } }
  }
}
```

- **Zustand:** `serialize(state)` aus `core/persist.ts`. Das ist dasselbe Format wie im Browserspeicher.
- **Samples:**
  - Sie liegen im bestehenden Format von `encodePcm`: 16 Bit, little-endian, Base64, 22,05 kHz mono.
  - Jeder Pad-Eintrag 0–7 wird geschrieben. Ein leeres Pad ist `""`, damit beim Öffnen keine Werks-Samples zurückkehren.
  - Drum-Samples werden nur geschrieben, wenn welche vorhanden sind.
- **Öffnen:** Die Datei wird geprüft (`format === "pocket808"`, `version` ist eine ganze Zahl ≥ 1, `state` ist ein Objekt). Danach durchläuft der Zustand `loadState(state, initialState())`, mit Grenzen und Migrationen.
  - Eine höhere `version` als bekannt wird trotzdem geladen, weil unbekannte Felder ignoriert werden.
  - Ungültiges JSON, ein falsches `format` oder ein fehlender `state` ergeben den Fehler `'invalid'`. In diesem Fall wird nichts verändert.
  - Ungültiges Base64 bei einem Sample: Dieses Sample entfällt (Pad leer), der Rest wird geladen. So verhält sich auch `applySampleStore`.
- **Ersetzen:** Vor dem Laden fragt der Dialog „Aktuelles Projekt ersetzen?“ mit „Ersetzen“ und „Abbrechen“.
  - Danach werden Zustand und alle Samples ersetzt. Die Ersetzung wird gespeichert, auch im Browserspeicher.
  - „Zurück“ (ein Schritt) stellt den vorherigen Zustand und die Samples wieder her.
- Reine Logik in `core/project.ts`:
  - `encodeProject(state, pads, drums, meta) → string`
  - `decodeProject(text) → { state, pads, drums } | { error: 'invalid' }`

## 2. WAV-Export

- **Umfang:**
  - **Pattern:** das aktuelle Pattern 1×, 2×, 4× oder 8×.
  - **Song:** die Song-Kette einmal komplett, mit Wiederholungen.
  - Bei einem leeren Song ist „Song“ gesperrt.
- **Ausklang:** Es kommen 2 s für Reverb, Delay und ausklingende Noten dazu.
- **Länge:** Takte × 16 Steps × Step-Dauer (`core/timing.ts`) plus Ausklang.
  - Höchstens 300 s. Darüber ist der Knopf gesperrt, mit dem Hinweis „Zu lang für den Export (max. 5 min)“.
  - Die Rechnung `exportDuration(state, scope, repeats)` liegt in `core/export.ts`, rein und getestet.
- **Rendern:**
  - Eine eigene Engine-Instanz mit `OfflineAudioContext(2, länge, 44100)`, eigenem Store-Abbild, eigenen Samples, eigener Uhr und manuellem Scheduler-Takt. Das ist dasselbe Verfahren wie die Referenztests.
  - Die laufende Wiedergabe bleibt unberührt.
  - Im Song-Modus startet der Export vorn im Song, im Pattern-Modus wird das aktuelle Pattern wiederholt. Der Modus wird nur in der Kopie gesetzt.
  - Zufall: Die Engine nutzt ihren normalen Zufall. Der Export muss nicht bitgleich wiederholbar sein.
- **Fortschritt:**
  - Das Planen läuft in Häppchen, sodass die Oberfläche bedienbar bleibt.
  - Danach folgt `startRendering()`.
  - Die Anzeige lautet „Rendere … n %“ (während des Planens) bzw. „Rendere …“. Dazu gibt es „Abbrechen“.
  - Abbrechen verwirft das Ergebnis.
- **Kodieren:**
  - `encodeWav(channels: Float32Array[], sampleRate) → Uint8Array` in `core/wav.ts`.
  - PCM 16 Bit, Stereo, RIFF/WAVE. Werte werden auf ±1 begrenzt.
- **Dateiname:** `pocket808-pattern-A-4x-<JJJJ-MM-TT>.wav` bzw. `pocket808-song-<JJJJ-MM-TT>.wav`.

## 3. Dateien hinaus und herein (`platform`)

- **`saveFile(blob, name)`:**
  - Wenn `navigator.canShare?.({ files: [file] })` zutrifft, öffnet `navigator.share({ files: [file] })`. Auf dem iPhone heißt das: „In Dateien sichern“, AirDrop, Nachrichten.
  - Bricht der Nutzer ab (`AbortError`), passiert nichts.
  - Sonst gibt es einen Download über `<a download>` mit `URL.createObjectURL`. Die URL wird danach freigegeben.
  - Teilen braucht eine Nutzergeste. Bei WAV ist die Geste nach dem Rendern verbraucht. Deshalb erscheint nach dem Rendern ein Knopf „WAV sichern“, der das Teilen auslöst.
- **`pickFile({ accept })`:** Das ist die Verallgemeinerung von `pickAudioFile`. Für Projekte gilt `accept: '.json,application/json'`. Der Rückgabewert ist Text plus Name.
- `UiFiles` bekommt `pickProject()` und `save(blob, name)`.
- `UiAudio` bekommt `exportWav(scope, repeats, onProgress, signal)`, mit dem Ergebnis `Promise<Blob | null>`.

## 4. Oberfläche

- **Datei-Knopf in der Kopfzeile** (Bereich `brand`, neben „?“):
  - Symbol und Beschriftung „Datei“.
  - Auf allen Layouts gleich.
  - Mindestens 44 px groß.
- **Dialog** (`<dialog>`, modal, „Schließen“). Auf dem Telefon füllt er den Bildschirm, sonst steht er mittig mit höchstens 480 px Breite. Er hat drei Abschnitte:
  1. **Projekt:** „Projekt sichern“ und „Projekt öffnen“. Die Ersetzen-Frage erscheint im Dialog selbst, nicht über `confirm()`.
  2. **Audio exportieren:**
     - Segment „Pattern | Song“.
     - Bei „Pattern“ das Segment „1× 2× 4× 8×“.
     - Anzeige der Länge („0:32“).
     - „WAV erzeugen“, nach dem Rendern „WAV sichern“.
  3. **Meldungen** (`role="status"`):
     - „Projekt gesichert“
     - „Projekt geöffnet“
     - „Keine Pocket-808-Datei“
     - „Export fertig · 0:32“
     - „Export abgebrochen“
- **Tastaturkürzel (Desktop):**
  - ⌘/Strg+S öffnet „Projekt sichern“ (ohne Browser-Speichern).
  - ⌘/Strg+O öffnet die Projekt-Auswahl.
  - Beide wirken nicht, solange ein Dialog offen ist. Der Kürzel-Dialog „?“ wird ergänzt.
- **Design-Regeln:**
  - Palette, Glow und `z-index:1` gelten wie gewohnt.
  - Keine neuen Farben.
  - Touch-Ziele mindestens 44 px.

## 5. Tests

- **Unit:**
  - `core/project`: Eigenschaftstest für die Rundreise (fast-check). Zustand und Samples gehen hinein und kommen gleich wieder heraus, Samples innerhalb der 16-Bit-Quantisierung.
  - Kaputte Dateien: kein JSON, falsches Format, fehlender Zustand, fremde Felder, kaputtes Base64.
  - Alte Speicherstände als `state`.
  - `core/wav`: Kopf bytegenau, Begrenzung, Stereo-Verschränkung.
  - `core/export`: Dauer für Pattern, Song mit Wiederholungen, leeren Song und die Grenze.
  - `platform`: Teilen bzw. Download, Abbruch beim Teilen, `pickFile` mit Abbrechen.
  - UI: Dialog, Ersetzen-Frage, Sperren, Fortschritt, Abbrechen, Meldungen, Kürzel.
- **Referenz:** Der Export eines Mix-Szenarios über den neuen Export-Weg liegt innerhalb der Toleranz des bestehenden Fingerabdrucks.
- **E2E** auf allen fünf Ansichten:
  - Sichern über den Download-Weg abfangen, Zustand ändern, Datei öffnen und ersetzen: Der alte Stand ist zurück, auch nach dem Neuladen.
  - Eine fremde Datei ergibt die Meldung, und nichts ändert sich.
  - Pattern 1× als WAV: gültiger RIFF-Kopf, Länge im erwarteten Rahmen.
  - axe mit offenem Dialog, Touch-Ziele, kein horizontaler Scroll.
- **Budget:** Die gebaute Datei bleibt unter 113 360 B. Wenn das nicht reicht, wird das Budget per Ruling angehoben, mit Begründung.

## Abnahme

- Alle Tests sind grün.
- README, CLAUDE.md und die Funktionsliste sind ergänzt.
- Auf dem iPhone des Besitzers funktioniert:
  - sichern über „In Dateien sichern“
  - öffnen aus Dateien
  - WAV exportieren und anhören
