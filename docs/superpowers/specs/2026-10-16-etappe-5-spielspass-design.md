# Etappe 5: Spielspaß (OP–1 LCD, Tombola, Mute-Szenen) — Spezifikation

Stand: 2026-10-16. Entscheidungen vom Besitzer bestätigt; Tombola-Tiefe vom Reviewer festgelegt.

Bezug: [OP–1 field](https://teenage.engineering/products/op-1), Roadmap 5, Plan `docs/etappe-5-op1-spielspass-plan.md`.

## Festgelegte Entscheidungen

| # | Frage | Beschluss |
|---|---|---|
| 1 | vs. 4b | **5a starten** auf `main`, nicht auf 4b warten. Punch-Glyphs im LCD erst, wenn 4b da ist. |
| 2 | Peak | **Ja** — gedrosselter Master-Peak im LCD. |
| 3 | Tombola | **Drei Modi** (Chance · Ghost · Streuen); siehe unten. Keine Locks, keine Synth-Spuren, kein Song. |
| 4 | Szenen | **8** Mute-/Solo-Snapshots. |

## Ziel

Mehr Spielspaß ohne die Kiste umzubauen: lebendiges LCD wie beim OP–1, kontrollierter Zufall (Tombola), acht abrufbare Mute-Szenen wie bei OP-XY. Weiterhin eine HTML-Datei, iPhone-tauglich, gleiche Design-Tokens.

## 5a — Animiertes LCD

### Inhalt

- **Oben:** Tempo dreistellig (wie heute).
- **Unten:** Statuszeile (Stimme · Slot A–H · bei Song die Kettenposition) oder Flash-Meldung (1,4 s).
- **Step-Punkt:** 16er-Raster-Indikator, der beim Play den aktuellen Step pulst (`prefers-reduced-motion`: nur Springen, kein Pulse).
- **Mode-Glyphs:** Pattern/Song, Fill, Stutter (aktiv = Akzent-Glow). Punch später.
- **Peak:** horizontaler Balken, Master-Pegel.

### Peak (Technik)

- Ein `AnalyserNode` **nach** dem Master-Gain, vor Limiter/Ausgang (ein Knoten, dauerhaft, kein Graph pro Hit).
- `fftSize` klein (256); Ablesen von Zeitdomäne → RMS oder einfache Peak-Hülle.
- UI-Update **gedrosselt ~20 Hz** (nicht jedes rAF ohne Throttle). Gestoppt wenn `ctx` suspended / Engine dispose.
- Offline-Export und Referenztests: Analyser abgeklemmt oder Peak = 0 (kein Einfluss auf Render-Audio).

### UI / Layout

- Neues Modul `ui/panels/lcd.ts` (+ CSS), eingebunden im Deck; `readout.ts` bleibt für Text/Flash.
- Höhe der Kopfleiste auf 390×844 stabil; kein Drag auf dem LCD.
- Nur bestehende Farben / `color-mix`.

### Tests

Unit (Zustände, Reduced Motion, Peak-Drossel-Mock), E2E Mobile (LCD sichtbar, axe), Bench unverändert oder Peak-Pfad als „kein Mehrknoten pro Note“.

## 5b — Tombola (Würfel)

Ein Chip **Würfel** (Werkzeuge oder Transport). Vor dem Tippen Modus wählen (drei Chips oder Segment):

| Modus | Wirkung | Grenzen |
|---|---|---|
| **Chance** | Auf allen **aktiven** Drum- und Pad-Steps: `opt.c` auf 0,4…1,0 setzen/ändern | Locks `t/d/s`, Bedingungen `cond`, leere Steps unberührt |
| **Ghost** | Auf ca. ⅓ der aktiven Drum-/Pad-Steps: `opt.v` auf 0,25…0,55 | Synth BA/LD nie; Locks/Bedingungen unberührt |
| **Streuen** | Nur die **aktuell gewählte** Drum- oder Pad-Spur: bis zu 4 Steps an/aus kippen | Keine Sub-Steps ändern; keine Synth-Spur; max. 4 Flips |

- Jeder Wurf = **ein** Undo-Schritt (`store` Zurück).
- LCD-Flash z. B. „Würfel · Chance“.
- Zufall über injizierbaren RNG (`core`), damit Tests deterministisch sind.
- Leere Patterns bleiben ohne `opt`-Feld, wo nichts gesetzt wurde (Bytegleichheit wo möglich).

**Nicht in 5b:** Accel, Physik-Tombola, Chance auf Synth, Lock-Zufall, globales „alles random“.

## 5c — Acht Mute-Szenen

- State: `scenes: Array<Scene>` Länge **8**; jede Scene: Mute/Solo-Flags für alle `ChannelId` (wie Mixer).
- UI: acht Chips/Slots im Mixer oder Transport; Tippen lädt Szene; langer Druck oder „Szene sichern“ speichert den aktuellen Mute/Solo-Stand in den Slot.
- Default: Szene 1 = alles hörbar (keine Mutes); 2–8 leer (= gleiches wie „keine Änderung“ oder Kopie von 1 — in Implementierung: leere Szene = alles unmuted, kein Solo).
- Persistenz + Migration in `loadState`/`merge` (fehlendes Feld → 8 Defaults).
- **Export / Offline-Render:** aktuelle Mute/Solo aus dem State (wie heute); Szenenwechsel ist nur State. Kein separates „Export ohne Szene“.
- Haltetaste nicht nötig, wenn Tippen reicht; wenn Hold für „Momentan-Szene“ später gewünscht, gleiches `holdButton`-Muster wie Fill.

## Reihenfolge der Umsetzung

1. **5a** sofort (Branch z. B. `etappe-5a`), unabhängig von 4b.
2. **5b** Tombola.
3. **5c** acht Szenen.

Version: nach Merge von `main` weiterzählen (aktuell 0.19.0; 4b lokal ggf. parallel).

## Review-Fokus

1. Peak: ein Analyser, Drossel, dispose, kein Einfluss auf Offline-Fingerabdrücke.
2. Tombola: Undo; Locks/Synth sicher; `opt` sparsam.
3. Szenen: 8 Slots, Migration, Touch ≥ 44 px, Screenreader-Namen („Szene 1“ …).
4. LCD: Reduced Motion, Mobile-Höhe, Glow-Clipping (`z-index`).
