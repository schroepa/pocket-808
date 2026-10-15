# Schritt 5d: Mixer, FX, Song, Vorlagen und Werkzeuge – Implementierungsplan (kompakt)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Testgetrieben umsetzen: Test zuerst, rot sehen, dann Code. Die Muster aus 5a–5c gelten.

**Goal:** Die letzten Abschnitte der Funktionsliste („Mixer (5d)“, „FX (5d)“, „Song (5d)“, „Vorlagen und Pattern-Werkzeuge (5d)“) kommen in die neue Oberfläche. Danach ist die Funktionsliste vollständig.

**Architecture:**
- **Reine Logik:** `core/mixer.ts` (Kanalwert, Solo, FX-Wert). Mute nutzt `toggleMute` aus `core/synth.ts`.
- **Mixer und FX:** Geräte drei und vier im Geräte-Halter (`ui/panels/mixer/`).
- **Song und Pattern-Werkzeuge:** eigene Bereiche `song` und `patterns` in der Shell (`ui/panels/song.ts`, `ui/panels/patterns.ts`).
- **Knob:** bekommt die Option `snap` (Legacy: beim Ziehen fängt der Wert bei ±0,03 um den Rastpunkt).
- **UiAudio:** bekommt `stutterOn(fraction)` und `stutterOff()`.

**Spec:** `docs/superpowers/specs/2026-10-14-ui-layouts-design.md` (5d) und die Funktionsliste. Verhaltensreferenz ist `legacy/index.html`, die Funktionen `buildMixFx`, `renderMixFx`, `toggleMute`, `toggleSolo`, `buildSong`, `renderChain`, `bump`, `moveBlk`, `delBlk`, `buildPresets`, `copyPattern`, `pastePattern`, `clearAll` und `undoLast`.

## Global Constraints

Wie in 5a–5c. Branch `ui-5d`, Commits über `bash $D/commit.sh`.

Verhalten wie Legacy:

- **Mixer:**
  - 13 Kanalzüge mit Name (wählt den Kanal; Standard BD, Auswahl nur in der Oberfläche), M, S und Fader (natives `input[type=range]` 0–100).
  - Der Fader wählt den Kanal beim Antippen. Ein Doppelklick setzt 80. Die Meldung lautet „<Name> Fader n“.
  - Pan des gewählten Kanals: Rastpunkt 0,5, Anzeige „Mitte“, „L n“ oder „R n“.
  - Reverb-Send: Standard aus `mixDefaults()`, Anzeige „n%“.
  - Beschriftung „Kanal: <Name>“.
  - Zusammenfassung: „13 Kanäle“, sonst „n stumm · Solo X|n“.
- **FX:**
  - Return (Standard 0,5, „n%“), Size (0,4, „x.x s“ = 0,3 + v·2,2), Damp (0,5, „n%“), alle mit Tag „REVERB“.
  - Filter (Rastpunkt 0,5, „aus“, „Tiefpass n%“ oder „Hochpass n%“) und Reso (0,2), beide mit Tag „DJ“.
  - Stutter 1/4, 1/8, 1/16, 1/32 (`aria-label` „Stutter x halten“): Zeiger runter schaltet ein, Zeiger hoch, Abbruch oder Verlust des Zeigers schaltet aus.
  - Zusammenfassung „Reverb n% · Filter aus|LP n%|HP n%“.
- **Song:**
  - Kette als Blöcke („X ×n“, `aria-label` „Position i: Pattern X, n mal“).
  - Ein Tipp wählt den Block (Auswahl nur in der Oberfläche) und zeigt das Pattern, außer während der Song-Wiedergabe.
  - Leerer Song: „Noch leer. Wähle ein Pattern und tippe auf „anhängen“.“
  - Werkzeuge:
    - „+ X anhängen“ (gesperrt ab 32 Positionen)
    - −/+ (Grenzen 1–16)
    - ←/→ (Grenzen)
    - „Entfernen“
    - „Leeren“
  - Gespielte Position: Klasse `play`, aus `playhead.songIndex`.
- **Vorlagen:** House, Electro, Hip-Hop, Trap. `store.loadPreset` (mit Zurück), aktive Markierung `state.preset`.
- **Pattern-Werkzeuge:**
  - Kopieren (Meldung „PATTERN X KOPIERT“).
  - Einfügen (gesperrt ohne Zwischenablage, Meldung „EINGEFÜGT IN X“).
  - Pattern leeren.
  - Zurück (gesperrt ohne Zurück-Schritt).
- **Layouts:**
  - Mobile: Song, Vorlagen und Werkzeuge unter den Geräten.
  - Tablet hochkant: zweispaltig unter den Geräten.
  - Tablet quer: linke Spalte.
  - Desktop: Song und Werkzeuge in Spalte 1, Mixer und FX in Spalte 3.

## Review Focus

1. **Solo und Mute zusammen:** Hörbarkeit wie Legacy (`audibleChannels`), Zusammenfassung korrekt, M/S mit `aria-pressed`.
2. **Song-Grenzen:** Die Knöpfe sind an den Grenzen gesperrt. Die Auswahl folgt Verschieben und Entfernen (nach dem Entfernen `min(i, n-1)`). Leeren hebt die Auswahl auf.
3. **Stutter:** Loslassen außerhalb des Knopfs, Zeigerabbruch und Verlust des Zeigers schalten immer aus. Es darf nie ein hängender Stutter bleiben.
4. **Rastpunkt:** Pan und Filter rasten nur beim Ziehen. Tasten bewegen frei.
5. **Desktop 1440 × 900:**
  - Die Spezifikation verlangt „ohne Scrollen“. Mit allen Geräten in touchtauglicher Größe passt das nicht in 900 px Höhe.
  - Ruling: Die Kopfleiste (Tempo, Slots, Start) bleibt beim Scrollen stehen (sticky). Nach unten scrollt der Inhalt, nie seitlich. Das wird dem Besitzer gemeldet.

## Aufgaben

1. **Knob-Rastpunkt und Mixer-Logik:**
   - `knob({ snap })`.
   - `core/mixer.ts`: `setChannelValue(s, id, key: 'v' | 'p' | 'r', v)`, `toggleSolo(s, id)`, `setFxValue(s, key, v)`.
   - Formatierer (`ui/panels/mixer/format.ts`): `panText`, `djText`, `sizeText`, `mixSummary`, `fxSummary`.
2. **Mixer- und FX-Gerät:**
   - `UiAudio.stutterOn/stutterOff` (main, Test-Hilfen).
   - `ui/panels/mixer/mixer.ts`, `fx.ts`, `device.ts` (`mixerDevice`, `fxDevice`).
   - In der Shell als Geräte drei und vier registrieren.
3. **Song und Pattern-Werkzeuge:**
   - `ui/panels/song.ts` (Bereich `song`) und `ui/panels/patterns.ts` (Bereich `patterns`: Vorlagen und Werkzeuge).
   - Shell-Reihenfolge: … `devices`, `song`, `patterns`, `transport`.
   - `layout.css`: alle vier Layouts, Desktop mit stehender Kopfleiste.
4. **E2E und Doku:**
   - `tests/e2e-next/mix-song.spec.ts`: Mute/Solo, Fader, FX-Regler, Stutter halten und loslassen, Song anhängen/±/verschieben/entfernen/leeren, Vorlage laden und zurück, Kopieren/Einfügen. Dazu Touch-Ziele und „Geräte im Fenster“ für Mixer/FX.
   - axe mit offenem Mixer und FX, Screenshots, Budget.
   - Funktionsliste vollständig ✅, README (Projektstand 5 abgeschlossen), CLAUDE.md.
