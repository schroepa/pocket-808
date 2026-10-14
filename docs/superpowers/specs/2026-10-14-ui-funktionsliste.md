# Funktionsliste der Oberfläche (Legacy → neue UI)

Stand: 2026-10-14. Abgeleitet aus `legacy/index.html`: `build*`-Funktionen, Listener in `init` und Markup. Jede Bedienhandlung steht in einer Zeile. Pro Teilschritt (5a–5d) wird abgehakt, und jede Zeile verweist auf ihren Test. Gehört zu `2026-10-14-ui-layouts-design.md`.

Legende: ✅ umgesetzt und getestet · ⏳ offen (Teilschritt in Klammern)

## Deck (5a)

| Handlung | Wirkung | Stand | Test |
|---|---|---|---|
| Tempo-Regler ziehen / Tasten | 60–200 BPM, LCD dreistellig, Meldung „Tempo … BPM“ | ✅ | `panels-head.test.ts` |
| Tempo Doppeltipp | 90 BPM | ✅ | `panels-head.test.ts` |
| Swing-Regler | 0–100 %, Doppeltipp 0 | ✅ | `panels-head.test.ts` |
| Master-Regler | 0–100, Doppeltipp 80 | ✅ | `panels-head.test.ts` |
| LCD-Zeile | gewählte Stimme bzw. 1,4 s lang eine Meldung | ✅ | `readout.test.ts` |
| Ohne Web Audio | Zeile „Kein Audio in diesem Browser“, Bearbeiten bleibt möglich | ✅ | `readout.test.ts` |

## Pattern-Slots (5a)

| Handlung | Wirkung | Stand | Test |
|---|---|---|---|
| Slot A–H tippen | Pattern wählen (Vorlage wird abgewählt) | ✅ | `panels-head.test.ts`, `app.spec.ts` |
| Inhaltspunkt | Punkt, wenn das Pattern Inhalt hat | ✅ | `panels-head.test.ts` |

## Step-Editor (5a)

| Handlung | Wirkung | Stand | Test |
|---|---|---|---|
| Step tippen | schalten; nur beim Einschalten im Stand vorhören | ✅ | `step-editor.test.ts` |
| Step mit Sub-Steps tippen | Sub-Steps löschen, Step aus, kein Vorhören | ✅ | `core/pattern` + `step-editor.test.ts` |
| Lauflicht | aktueller Step markiert (Ausgabelatenz berücksichtigt) | ✅ | `step-editor.test.ts`, `app.spec.ts` |
| „Sub“ | Sub-Modus: Step-Tipp wählt den Step, Sub-Editor sichtbar | ✅ | `step-editor.test.ts`, `sub-editor.test.ts` |
| Sub-Step tippen | schalten, beim Einschalten im Stand vorhören | ✅ | `sub-editor.test.ts` |
| Roll / ÷2 / ÷4 / Leeren | Vorlagen für die Sub-Steps (mit Zurück) | ✅ | `sub-editor.test.ts` |
| „Leeren“ (Spur) | Spur samt Sub-Steps leeren (mit Zurück) | ✅ | `step-editor.test.ts` |
| Level / Tune / Decay | Werte der gewählten Stimme; Tune ±; nach dem Loslassen im Stand vorhören; Doppeltipp = Werkseinstellung | ✅ | `step-editor.test.ts` |
| „Eigenes Sample“ / „Sample ersetzen“ | Datei wählen, dekodieren, Stille abschneiden, speichern, vorhören, Meldung | ✅ | `drum-sample.test.ts` |
| „Original“ | eigenes Sample entfernen, vorhören, Meldung | ✅ | `drum-sample.test.ts` |
| Unlesbare Datei / Abbrechen | „NICHT LESBAR“ bzw. nichts | ✅ | `drum-sample.test.ts` |
| Titel | Kürzel, Name, ggf. Sample-Name (10 Zeichen) | ✅ | `step-editor.test.ts` |

## Spuren (5a)

| Handlung | Wirkung | Stand | Test |
|---|---|---|---|
| Label tippen | Spur wählen und vorhören | ✅ | `tracks.test.ts` |
| Zelle tippen | Spur wählen, Step schalten (Vorhören wie Step-Editor) | ✅ | `tracks.test.ts` |
| Lauflicht | Spalte in allen Spuren | ✅ | `tracks.test.ts` |
| Eigenes Sample | Markierung am Label | ✅ | `tracks.test.ts` |

## Transport (5a)

| Handlung | Wirkung | Stand | Test |
|---|---|---|---|
| Pattern / Song | Modus wechseln; Song beginnt vorn | ✅ | `transport.test.ts`, `engine.test.ts` |
| Start / Stopp | Wiedergabe, Symbol und Beschriftung | ✅ | `transport.test.ts`, `app.spec.ts` |

## Tastaturkürzel, nur Desktop (5a, neu)

| Handlung | Wirkung | Stand | Test |
|---|---|---|---|
| Leertaste | Start / Stopp | ✅ | `keys.test.ts`, `keys.spec.ts` |
| 1–8 | Pattern A–H | ✅ | `keys.test.ts` |
| ↑ / ↓ | Spur wählen (nicht auf Reglern) | ✅ | `keys.test.ts` |
| ⌘/Strg+Z | Zurück | ✅ | `keys.test.ts` |
| ⌘/Strg+C / V | Pattern kopieren / einfügen | ✅ | `keys.test.ts` |
| „?“ | Dialog mit den Kürzeln | ✅ | `keys.test.ts` |

## Plattform (5a)

| Handlung | Wirkung | Stand | Test |
|---|---|---|---|
| Erster Tipp auf iOS | Stumm-Schalter ignorieren (audioSession bzw. stilles Audio-Element) | ✅ | `ios.test.ts` |
| Tippen nach Anruf/Alarm | Kontext wecken (`resume`) | ✅ | `lifecycle.test.ts`, `engine.test.ts` |
| App in den Hintergrund | Wiedergabe stoppt | ✅ | `lifecycle.test.ts` |
| Wiedergabe | Bildschirm bleibt an (Wake Lock) | ✅ | `wake.test.ts` |
| Artifact | Zustand über `window.claude.hot` hin und zurück | ✅ | `host.test.ts`, `host.spec.ts` |
| Alter Speicherstand | lädt unverändert | ✅ | `core-*`, `compat.spec.ts` |

## Synth (5b)

| Handlung | Wirkung | Stand |
|---|---|---|
| Rack auf/zu (Mobile) bzw. Tab (Tablet) | Synth zeigen, Zusammenfassung „Bass · A Moll · 4 Noten“ | ⏳ (5b) |
| Bass / Lead | Stimme wählen | ⏳ (5b) |
| Stumm | Stimme stumm (Mixer) | ⏳ (5b) |
| Tonart, Skala | Auswahl | ⏳ (5b) |
| Takthälfte 1–8 / 9–16 | Seite der Piano-Roll | ⏳ (5b) |
| Notenlänge 1/16, 1/8, 1/4 | Länge neuer Noten | ⏳ (5b) |
| Roll-Zelle tippen | Note setzen bzw. löschen, vorhören | ⏳ (5b) |
| Roll-Label tippen | Ton vorhören | ⏳ (5b) |
| Lauflicht in der Roll | aktueller Step | ⏳ (5b) |
| Wellenform (Saw, Square, Tri, Sine) | Oszillator | ⏳ (5b) |
| Oktave − / + | Oktave | ⏳ (5b) |
| Detune, Sub, Cutoff, Reso, Env, Delay, Level | Regler | ⏳ (5b) |
| Filter-Env und Amp-Env (Attack, Decay, Sustain, Release) | Schieberegler mit Hüllkurvenanzeige | ⏳ (5b) |
| Presets | Patch laden, Markierung | ⏳ (5b) |
| „Stimme leeren“ | Noten der Stimme löschen (mit Zurück) | ⏳ (5b) |

## Sampler (5c)

| Handlung | Wirkung | Stand |
|---|---|---|
| Pad tippen | wählen und vorhören; Inhaltspunkt | ⏳ (5c) |
| Wellenform | Start- und Endmarke ziehen, Lauflicht | ⏳ (5c) |
| Laden | Datei dekodieren (`engine.decode`), Meldung bei Fehler | ⏳ (5c) |
| Rec | mit dem Mikrofon aufnehmen (Rückfall Dateiauswahl mit capture) | ⏳ (5c) |
| Leeren | Pad leeren | ⏳ (5c) |
| Rev | rückwärts abspielen | ⏳ (5c) |
| Tune, Attack, Decay, Level | Regler je Pad | ⏳ (5c) |
| Sampler-Steps, Sub-Steps | wie Drums, je Pad | ⏳ (5c) |
| Meldungen | `role=status` | ⏳ (5c) |

## Mixer (5d)

| Handlung | Wirkung | Stand |
|---|---|---|
| Kanal wählen | 13 Kanäle, Auswahl markiert | ⏳ (5d) |
| Lautstärke-Fader | je Kanal | ⏳ (5d) |
| M / S | Mute / Solo | ⏳ (5d) |
| Pan, Reverb-Send | Regler des gewählten Kanals | ⏳ (5d) |

## FX (5d)

| Handlung | Wirkung | Stand |
|---|---|---|
| Size, Damp, Return | Reverb | ⏳ (5d) |
| Filter, Reso | DJ-Filter | ⏳ (5d) |
| Stutter 1/4, 1/8, 1/16, 1/32 halten | Stutter an, solange gehalten | ⏳ (5d) |

## Song (5d)

| Handlung | Wirkung | Stand |
|---|---|---|
| „+ X anhängen“ | aktuelles Pattern anhängen (höchstens 32) | ⏳ (5d) |
| − / + | Wiederholungen | ⏳ (5d) |
| ← / → | Position verschieben | ⏳ (5d) |
| Entfernen, Leeren | Position bzw. Song löschen | ⏳ (5d) |
| Wiedergabe-Markierung | gespielte Position | ⏳ (5d) |

## Vorlagen und Pattern-Werkzeuge (5d)

| Handlung | Wirkung | Stand |
|---|---|---|
| House, Electro, Hip-Hop, Trap | Vorlage laden (mit Zurück), Markierung | ⏳ (5d) |
| Kopieren, Einfügen | Pattern-Zwischenablage, Meldung | ⏳ (5d), als Kürzel schon da |
| Pattern leeren | mit Zurück | ⏳ (5d) |
| Zurück | einstufig | ⏳ (5d), als Kürzel schon da |
