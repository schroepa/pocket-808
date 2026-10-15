# Funktionsliste der Oberfläche (Legacy → neue UI)

Stand: 2026-10-15, vollständig. Abgeleitet aus `legacy/index.html`: `build*`-Funktionen, Listener in `init` und Markup. Jede Bedienhandlung steht in einer Zeile. Pro Teilschritt (5a–5d) wird abgehakt, und jede Zeile verweist auf ihren Test. Gehört zu `2026-10-14-ui-layouts-design.md`.

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

| Handlung | Wirkung | Stand | Test |
|---|---|---|---|
| Rack auf/zu (Mobile) bzw. Tab (Tablet) | Synth zeigen, Zusammenfassung „Bass · A Moll · 4 Noten“ | ✅ | `synth.test.ts`, `synth.spec.ts` |
| Bass / Lead | Stimme wählen | ✅ | `synth.test.ts`, `synth.spec.ts` |
| Stumm | Stimme stumm (Mixer) | ✅ | `synth.test.ts` |
| Tonart, Skala | Auswahl | ✅ | `synth.test.ts` |
| Takthälfte 1–8 / 9–16 | Seite der Piano-Roll | ✅ | `synth.test.ts` |
| Notenlänge 1/16, 1/8, 1/4 | Länge neuer Noten | ✅ | `synth.test.ts` |
| Roll-Zelle tippen | Note setzen bzw. löschen, vorhören | ✅ | `synth.test.ts`, `synth.spec.ts` |
| Roll-Label tippen | Ton vorhören | ✅ | `synth.test.ts` |
| Lauflicht in der Roll | aktueller Step | ✅ | `synth.test.ts`, `synth.spec.ts` |
| Wellenform (Saw, Square, Tri, Sine) | Oszillator | ✅ | `synth.test.ts` |
| Oktave − / + | Oktave | ✅ | `synth.test.ts` |
| Detune, Sub, Cutoff, Reso, Env, Delay, Level | Regler | ✅ | `synth.test.ts` |
| Filter-Env und Amp-Env (Attack, Decay, Sustain, Release) | Schieberegler mit Hüllkurvenanzeige | ✅ | `synth.test.ts` |
| Presets | Patch laden, Markierung | ✅ | `synth.test.ts`, `synth.spec.ts` |
| „Stimme leeren“ | Noten der Stimme löschen (mit Zurück) | ✅ | `synth.test.ts` |

## Sampler (5c)

| Handlung | Wirkung | Stand | Test |
|---|---|---|---|
| Pad tippen | wählen und vorhören; Inhaltspunkt | ✅ | `sampler.test.ts`, `sampler.spec.ts` |
| Wellenform | Start- und Endmarke ziehen, Lauflicht | ✅ | `sampler.test.ts` |
| Laden | Datei dekodieren (`engine.decode`), Meldung bei Fehler | ✅ | `sampler.test.ts`, `sampler.spec.ts` |
| Rec | mit dem Mikrofon aufnehmen (Rückfall Dateiauswahl mit capture) | ✅ | `sampler.test.ts` |
| Leeren | Pad leeren | ✅ | `sampler.test.ts`, `sampler.spec.ts` |
| Rev | rückwärts abspielen | ✅ | `sampler.test.ts`, `sampler.spec.ts` |
| Tune, Attack, Decay, Level | Regler je Pad | ✅ | `sampler.test.ts` |
| Sampler-Steps, Sub-Steps | wie Drums, je Pad | ✅ | `sampler.test.ts`, `sampler.spec.ts` |
| Meldungen | `role=status` | ✅ | `sampler.test.ts` |

## Mixer (5d)

| Handlung | Wirkung | Stand | Test |
|---|---|---|---|
| Kanal wählen | 13 Kanäle, Auswahl markiert | ✅ | `mixer.test.ts`, `mix-song.spec.ts` |
| Lautstärke-Fader | je Kanal, Doppelklick 80 | ✅ | `mixer.test.ts`, `mix-song.spec.ts` |
| M / S | Mute / Solo (`aria-pressed`), Zusammenfassung | ✅ | `mixer.test.ts`, `mix-song.spec.ts`, `core/mixer.test.ts` |
| Pan, Reverb-Send | Regler des gewählten Kanals, Pan rastet beim Ziehen in der Mitte | ✅ | `mixer.test.ts`, `format.test.ts`, `mix-song.spec.ts`, `knob.test.ts` |

## FX (5d)

| Handlung | Wirkung | Stand | Test |
|---|---|---|---|
| Size, Damp, Return | Reverb | ✅ | `mixer.test.ts`, `format.test.ts`, `mix-song.spec.ts` |
| Filter, Reso | DJ-Filter, Filter rastet beim Ziehen in der Mitte | ✅ | `mixer.test.ts`, `format.test.ts`, `mix-song.spec.ts` |
| Stutter 1/4, 1/8, 1/16, 1/32 halten | Stutter an, solange gehalten; Loslassen, Abbruch, Zeigerverlust schalten aus | ✅ | `mixer.test.ts`, `mix-song.spec.ts` |

## Song (5d)

| Handlung | Wirkung | Stand | Test |
|---|---|---|---|
| „+ X anhängen“ | aktuelles Pattern anhängen (höchstens 32) | ✅ | `song-patterns.test.ts`, `mix-song.spec.ts` |
| − / + | Wiederholungen (1–16) | ✅ | `song-patterns.test.ts`, `mix-song.spec.ts` |
| ← / → | Position verschieben, Auswahl folgt | ✅ | `song-patterns.test.ts`, `mix-song.spec.ts` |
| Entfernen, Leeren | Position bzw. Song löschen | ✅ | `song-patterns.test.ts`, `mix-song.spec.ts` |
| Wiedergabe-Markierung | gespielte Position | ✅ | `song-patterns.test.ts` |

## Vorlagen und Pattern-Werkzeuge (5d)

| Handlung | Wirkung | Stand | Test |
|---|---|---|---|
| House, Electro, Hip-Hop, Trap | Vorlage laden (mit Zurück), Markierung | ✅ | `song-patterns.test.ts`, `mix-song.spec.ts` |
| Kopieren, Einfügen | Pattern-Zwischenablage, Meldung | ✅ | `song-patterns.test.ts`, `mix-song.spec.ts`, `keys.test.ts` |
| Pattern leeren | mit Zurück | ✅ | `song-patterns.test.ts` |
| Zurück | einstufig | ✅ | `song-patterns.test.ts`, `mix-song.spec.ts`, `keys.test.ts` |

## Projekt und Export (Roadmap-Etappe 2)

| Handlung | Wirkung | Stand | Test |
|---|---|---|---|
| Datei (Kopfzeile) | Dialog „Projekt und Export“ | ✅ | `project.test.ts`, `project.spec.ts`, `a11y.spec.ts` |
| Projekt sichern, ⌘/Strg+S | `.pocket808.json` mit Zustand und Samples; Teilen-Menü bzw. Download | ✅ | `core/project.test.ts`, `share.test.ts`, `project.spec.ts` |
| Projekt öffnen, ⌘/Strg+O | prüfen, fragen, ersetzen; Zurück stellt Zustand und Samples wieder her | ✅ | `project.test.ts`, `store.test.ts`, `project.spec.ts` |
| Fremde oder kaputte Datei | Meldung „Keine Pocket-808-Datei“, nichts ändert sich | ✅ | `core/project.test.ts`, `project.spec.ts` |
| WAV erzeugen | Pattern 1/2/4/8× oder Song, Länge, Fortschritt, Abbrechen, max. 5 min | ✅ | `export.test.ts`, `project.test.ts`, `next-mix.test.ts` |
| WAV sichern | 44,1 kHz, 16 Bit, Stereo | ✅ | `wav.test.ts`, `project.spec.ts` |

## Step-Optionen (Roadmap-Etappe 3)

| Handlung | Wirkung | Stand | Test |
|---|---|---|---|
| Opt (Step-Editor, Sampler-Steps) | Opt-Modus, schließt Sub aus; Tipp wählt, schaltet ausgeschaltete Steps ein | ✅ | `step-opts.test.ts`, `stepopts.spec.ts` |
| Velocity, Leise/Mittel/Voll | Pegel v², Helligkeit des Steps | ✅ | `core/stepopts.test.ts`, `next-stepopts.test.ts`, `step-opts.test.ts` |
| Chance | Wahrscheinlichkeit pro Step, einmal gewürfelt | ✅ | `next-stepopts.test.ts`, `step-opts.test.ts` |
| Bedingung | 1:2 … 4:4, Erster, Nicht erster; Zählung je Slot ab Start | ✅ | `core/stepopts.test.ts`, `next-stepopts.test.ts` |
| Zurücksetzen | Standard (mit Zurück) | ✅ | `step-opts.test.ts` |
| Speichern | optionales `opt` im Pattern, alte Stände bytegleich | ✅ | `core/stepopts.test.ts`, `core-persist.test.ts`, `stepopts.spec.ts` |
