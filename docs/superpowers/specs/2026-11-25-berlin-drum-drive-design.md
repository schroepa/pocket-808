# Berlin-Paket und Drum Drive (Teilprojekt 4)

Stand: 2026-11-25 · freigegeben am 2026-11-25 · Zielversion 0.30.0 · umgesetzt und live (0.30.0); Hörprobe auf dem iPhone bestanden am 2026-11-26

## Absicht

Der Besitzer will den Klang der Berliner Elektro- und Techno-Szene der frühen 2000er in der App
spielen können: ein neuer Stil **Berlin** mit eigenen Mustern „im Stil von“, eigenen Kits und
Synth-Sounds. Damit die harten Nummern nicht zu brav klingen, bekommen die Drums einen gemeinsamen
Verzerrer, **Drum Drive**.

Teilprojekt 4 wird vor Teilprojekt 3 (mehr Synth-Klang) gebaut. Nach dem Synth-Ausbau dürfen
einzelne Berlin-Sounds nachgeschärft werden.

## Ziele, Nicht-Ziele, Anti-Ziele

Ziele: neun spielbare Vorlagen, die sich deutlich voneinander unterscheiden; Drum Drive als
Regler, der auch zu allen anderen Mustern passt; alles läuft knackfrei auf dem iPhone.

Nicht-Ziele: Gesang, mitgelieferte Samples, Vorhören vor dem Laden, neue Synth-Parameter,
längere Patterns, Änderungen an den 21 vorhandenen Vorlagen.

Anti-Ziele: keine Künstlernamen in der App, in der README oder in Namen im Code; keine
nachgebauten Melodien, Riffs oder Beats vorhandener Titel. Auch wenn alles technisch stimmt, ist
es misslungen, wenn die neun Vorlagen wie Varianten der vorhandenen Techno-Muster klingen.

## Wege

- **A, nur Inhalte:** Vorlagen, Kits, Sounds mit der vorhandenen Engine. Schnell, aber ohne
  Eingriff in den Klang bleiben die harten Stile zu sauber.
- **B, Inhalte und Drum Drive (gewählt):** zusätzlich ein Verzerrer für die Drum-Summe. Eingriff in
  die Audio-Kette, dafür Biss, und der Regler nützt allen Mustern.
- Verworfen: Teilprojekt 3 vorab hineinziehen; Berlin wäre erst viel später zu hören.

Gewählt hat der Besitzer B.

## Drum Drive

**Bedienung:** Knob „Drum Drive“ im Mixer, Seite FX, Abschnitt „Klang“ neben Warm und Tape.
0–100 %, Anzeige in Prozent und im Display („DRUM DRIVE“), Doppeltipp schaltet aus. Tastatur und
ARIA wie bei den anderen Knobs.

**Signalweg:** Die zehn Drum-Kanäle (nach Fader und Panorama) laufen gemeinsam durch die
Sättigung in den Bus. Bass, Lead und Sampler bleiben außen vor. Der Reverb-Send bleibt am
Kanal-Fader, der Hall wird also aus dem unverzerrten Signal gespeist. DJ-Filter, Punch, Stutter,
Warm und Tape wirken dahinter wie bisher.

**Verhalten:**
- Bei 0 liegt nichts im Signalweg: kein zusätzlicher Knoten, Klang und Knotenzahl wie heute, die
  vorhandenen Referenzen bleiben gültig.
- Die Knoten entstehen erst bei Bedarf, einmal für alle Drums (nie pro Treffer), und werden nach
  dem Ausschalten abgebaut. Ein, Aus und Drehen während der Wiedergabe sind knackfrei
  (verankerte Rampen, `rampFrom`).
- Die Lautheit bleibt über den Regelweg etwa gleich; die Spitze am Ausgang hält die Grenze der
  Vorlagen-Pegeltests ein.
- Der WAV-Export klingt wie die Wiedergabe.

**Daten:** optionales Feld `State.drumDrive` (0..1), fehlt bei 0, damit alte Speicherstände und
Projektdateien bytegleich bleiben. Laden prüft und begrenzt den Wert. Wie Warm und Tape: Der Knob
selbst erzeugt keinen Zurück-Schritt, das Laden einer Vorlage schon.

**Vorlagen:** optionales Feld `drumDrive` (Standard 0). Laden mit „Alles“, „Sound“ und „Drums“
setzt den Wert der Vorlage, löscht ihn also bei Vorlagen ohne Drive. Kits und Basis-Muster lassen
ihn unverändert.

## Stil Berlin

Sechster Stil „Berlin“ unter Sound › Vorlagen, hinter Techno. Die Stil-Auswahl und die längeren
Listen passen weiter ohne Scrollen des Dokuments ab 390 × 660; Touch-Ziele bleiben mindestens
44 px.

| Vorlage | Charakter | BPM | Drum Drive |
|---|---|---|---|
| Kajal | kühler Electroclash, trockene Drums, stoischer Achtel-Bass, sparsamer Lead | 124 | aus |
| Königin | sägender Electro-Bass, Pop-Hook | 128 | wenig |
| Westwerk | harter Electro-Techno, gebrochene Kick, viel Hall auf Stabs | 135 | mittel |
| Breitwand | Big Beat: Breakbeat, Acid-Linie, Aufbau über Rolls | 126 | mittel |
| Zimmerlinde | verspielt, minimal, roboterhafter Groove, eingängiges Motiv | 118 | aus |
| Ostkreuz | melodischer Electro-House, Four-on-the-floor, breite Akkorde | 128 | aus |
| Spreeufer | zerschnittene Beats, melancholische Melodie, elegante Basslinie | 126 | aus |
| Presslufthalle | verzerrter Punk-Techno mit Shuffle | 132 | viel |
| Tiefgang | schwerer Bass, gebrochener Beat mit Hip-Hop- und Dub-Einschlag | 130 | wenig |

Charakter und Tempo sind Richtwerte, entschieden wird nach Gehör.

Je Vorlage gelten die Regeln der vorhandenen: drei bis vier Patterns in A–D mit Song-Kette, A mit
Kick, Bass und Lead, nie Closed und Open Hat auf demselben Step, Tempo 115–140, Speicher-Rundlauf,
Pegel im Referenztest.

**Vier Kits** (nur Level, Tune, Decay), auch einzeln wählbar:

| Kit | Charakter |
|---|---|
| Electro | kurz, knackig, trocken |
| Break | volle Snare, lockere Hats für gebrochene Beats |
| Draht | dünn und hell, für minimale Muster |
| Beton | schwere Kick, harte Snare, für Drum Drive |

**Zehn Synth-Sounds** mit Drive und Chorus, auch einzeln wählbar:

| Bass | Charakter | Lead | Charakter |
|---|---|---|---|
| Kreissäge | sägend, offen, angezerrt | Neon | kalter, trockener Rechteck-Lead |
| Roboter | kurz, hohl, stoisch | Orgel | stehender, breiter Ton |
| Wummer | tief, lang, viel Sub | Sirene | resonant, gleitend |
| Knurr | resonant, verzerrt | Glas | zart, mit Delay |
| Beton | hart, gedrückt | Zerre | verzerrter Stab |

Namen und Werte der vorhandenen Presets bleiben unverändert.

## Prüfen

- Logik testgetrieben (Zustand, Laden, Vorlagen); Audio per Unit-Test des Graphen und neuem
  Referenz-Szenario für Drum Drive (Pegel, Spitze, bei 0 unverändert).
- `npm run bench`: Demo und Worst-Case nicht spürbar teurer; zusätzlich ein Szenario mit Drum
  Drive.
- E2E: Knob setzen und nach Neuladen behalten; Stil Berlin wählen und Vorlage laden; Passform.
- Funktionsliste, README, CLAUDE.md und Version nachziehen.

## Ablauf

1. Drum Drive, vollständig mit Tests.
2. Kits, Sounds, Vorlagen.
3. Hörprobe auf dem iPhone, danach Korrekturen. Live (Merge, Push, Artifact) erst nach
   ausdrücklichem Ja. Wie die Hörprobe vor dem Livegang aufs iPhone kommt, wird dann abgestimmt.

## Dem Umsetzer überlassen

Kennlinie und Pegelausgleich des Drive, Aufbau und Abbau der Knoten, die Muster, Tonarten, FX,
Mixer- und Klangwerte der Vorlagen, Kits und Sounds innerhalb der Beschreibungen.
