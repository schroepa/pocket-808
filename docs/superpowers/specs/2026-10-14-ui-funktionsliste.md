# Funktionsliste der Oberfläche (Legacy → neue UI)

Stand: 2026-11-25 (App 0.28.0), vollständig. Ursprünglich aus der alten App abgeleitet (`build*`-Funktionen, Listener in `init`, Markup), seither nachgeführt und gegen `src/ui/panels/` abgeglichen. Maßstab für den Umbau „Ein Gerät“ (`2026-11-25-ui-ein-geraet-design.md`): Nichts davon darf verloren gehen. Jede Bedienhandlung steht in einer Zeile. Pro Teilschritt (5a–5d) wird abgehakt, und jede Zeile verweist auf ihren Test. Gehört zu `2026-10-14-ui-layouts-design.md`.

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
| „?“ (Kopfzeile) | Dialog mit den Kürzeln, „Schließen“ | ✅ | `keys.test.ts` |
| Eingabefeld oder offener Dialog | Kürzel ruhen; gehaltene Leertaste und Ziffern wiederholen nicht | ✅ | `keys.test.ts` |

## Plattform (5a)

| Handlung | Wirkung | Stand | Test |
|---|---|---|---|
| Erster Tipp auf iOS | Stumm-Schalter ignorieren (audioSession bzw. stilles Audio-Element) | ✅ | `ios.test.ts` |
| Tippen nach Anruf/Alarm | Kontext wecken (`resume`) | ✅ | `lifecycle.test.ts`, `engine.test.ts` |
| App in den Hintergrund | Wiedergabe stoppt | ✅ | `lifecycle.test.ts` |
| Wiedergabe | Bildschirm bleibt an (Wake Lock) | ✅ | `wake.test.ts` |
| Artifact | Zustand über `window.claude.hot` hin und zurück | ✅ | `host.test.ts`, `host.spec.ts` |
| Alter Speicherstand | lädt unverändert | ✅ | `core-*`, `compat.spec.ts` |
| Jede Änderung | Zustand wird entprellt (250 ms) selbst gespeichert, ein voller Speicher stört nicht | ✅ | `store/persist.test.ts`, `compat.spec.ts` |

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
| Presets | Liste je Part; Patch laden, Markierung, vorhören | ✅ | `synth.test.ts`, `synth.spec.ts` |
| „Stimme leeren“ | Noten der Stimme löschen (mit Zurück) | ✅ | `synth.test.ts` |
| Wellenform, Oktave, Sound-Regler | nach der Wahl bzw. dem Loslassen vorhören; Doppeltipp = Werkseinstellung des Parts | ✅ | `synth.test.ts` |

## Sampler (5c)

| Handlung | Wirkung | Stand | Test |
|---|---|---|---|
| Pad tippen | wählen und vorhören; Name bzw. „leer“, Inhaltspunkt | ✅ | `sampler.test.ts`, `sampler.spec.ts` |
| Wellenform | Start- und Endmarke ziehen (nach dem Loslassen vorhören), Lauflicht; Hinweis bei leerem Pad | ✅ | `sampler.test.ts` |
| Laden | Datei dekodieren (`engine.decode`), Meldung bei Fehler | ✅ | `sampler.test.ts`, `sampler.spec.ts` |
| Rec / Stopp | mit dem Mikrofon aufnehmen (höchstens 3 s, zweiter Tipp stoppt; Rückfall Dateiauswahl mit capture) | ✅ | `sampler.test.ts` |
| Leeren | Pad leeren | ✅ | `sampler.test.ts`, `sampler.spec.ts` |
| Rev | rückwärts abspielen, dabei vorhören | ✅ | `sampler.test.ts`, `sampler.spec.ts` |
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
| Block antippen | Position wählen und ihr Pattern zeigen (nicht bei laufendem Song) | ✅ | `song-patterns.test.ts`, `mix-song.spec.ts` |
| Leerer Song | Hinweis zum Anhängen; Knöpfe ohne Auswahl gesperrt | ✅ | `song-patterns.test.ts` |

## Vorlagen und Pattern-Werkzeuge (5d)

| Handlung | Wirkung | Stand | Test |
|---|---|---|---|
| Basis-Muster House, Electro, Hip-Hop, Trap | ersetzt die Drum-Spuren des aktuellen Patterns, dazu Tempo und Swing (mit Zurück), Markierung | ✅ | `song-patterns.test.ts`, `mix-song.spec.ts` |
| Kopieren, Einfügen | Pattern-Zwischenablage, Meldung | ✅ | `song-patterns.test.ts`, `mix-song.spec.ts`, `keys.test.ts` |
| Pattern leeren | mit Zurück | ✅ | `song-patterns.test.ts` |
| Zurück | letzten Schritt zurücknehmen (bis zu 20, siehe Etappe 8a); ohne Verlauf gesperrt | ✅ | `song-patterns.test.ts`, `mix-song.spec.ts`, `keys.test.ts` |

## Projekt und Export (Roadmap-Etappe 2)

| Handlung | Wirkung | Stand | Test |
|---|---|---|---|
| Datei (Kopfzeile) | Dialog „Projekt und Export“ | ✅ | `project.test.ts`, `project.spec.ts`, `a11y.spec.ts` |
| Projekt sichern, ⌘/Strg+S | `.pocket808.json` mit Zustand und Samples; Teilen-Menü bzw. Download | ✅ | `core/project.test.ts`, `share.test.ts`, `project.spec.ts` |
| Projekt öffnen, ⌘/Strg+O | prüfen, fragen, ersetzen; Zurück stellt Zustand und Samples wieder her | ✅ | `project.test.ts`, `store.test.ts`, `project.spec.ts` |
| Fremde oder kaputte Datei | Meldung „Keine Pocket-808-Datei“, nichts ändert sich | ✅ | `core/project.test.ts`, `project.spec.ts` |
| Umfang Pattern / Song, 1× / 2× / 4× / 8× | wählt den Export; Song ist leer gesperrt, ohne Wiederholungen; eine Änderung verwirft das fertige WAV | ✅ | `core/export.test.ts`, `project.test.ts` |
| WAV erzeugen | Länge, Fortschritt, Abbrechen, Fehlermeldung; höchstens 5 min | ✅ | `core/export.test.ts`, `project.test.ts`, `next-mix.test.ts` |
| WAV sichern | 44,1 kHz, 16 Bit, Stereo | ✅ | `wav.test.ts`, `project.spec.ts` |

## Step-Optionen (Roadmap-Etappe 3)

| Handlung | Wirkung | Stand | Test |
|---|---|---|---|
| Opt (Step-Editor, Sampler-Steps) | Opt-Modus, schließt Sub aus; Tipp wählt, schaltet ausgeschaltete Steps ein | ✅ | `step-opts.test.ts`, `stepopts.spec.ts` |
| Velocity, Leise/Mittel/Voll | Pegel v², Helligkeit des Steps | ✅ | `core/stepopts.test.ts`, `next-stepopts.test.ts`, `step-opts.test.ts` |
| Chance | Wahrscheinlichkeit pro Step, einmal gewürfelt | ✅ | `next-stepopts.test.ts`, `step-opts.test.ts` |
| Bedingung | 1:2 … 4:4, Erster, Nicht erster; Zählung je Slot ab Start | ✅ | `core/stepopts.test.ts`, `next-stepopts.test.ts` |
| Zurücksetzen | Standard (mit Zurück) | ✅ | `step-opts.test.ts` |
| Marke am Step | Chance, Bedingung, Lock, Pitch oder Slice markieren den Step (Editor, Spuren, Sampler) | ✅ | `step-opts.test.ts` |
| Speichern | optionales `opt` im Pattern, alte Stände bytegleich | ✅ | `core/stepopts.test.ts`, `core-persist.test.ts`, `stepopts.spec.ts` |

## Fill und Parameter-Locks (Roadmap-Etappe 4a)

| Handlung | Wirkung | Stand | Test |
|---|---|---|---|
| Fill (Transport) halten, F halten | Bedingungen „Fill“/„Nicht Fill“; Loslassen, Abbruch, Fokusverlust lösen | ✅ | `transport.test.ts`, `keys.test.ts`, `next-locks.test.ts`, `stepopts.spec.ts` |
| Lock Tune/Decay (Drums) | eigene vorgerenderte Variante pro Step | ✅ | `core/stepopts.test.ts`, `next-locks.test.ts`, `step-opts.test.ts` |
| Lock Tune/Decay/Start (Pads) | live pro Treffer | ✅ | `next-locks.test.ts`, `step-opts.test.ts` |
| Locks lösen | mit Zurück, übrige Optionen bleiben | ✅ | `step-opts.test.ts` |

## Punch-in und Bounce (Roadmap-Etappe 4b)

| Handlung | Wirkung | Stand | Test |
|---|---|---|---|
| Punch (Gerät) | acht Haltetasten, Zusammenfassung der gehaltenen | ✅ | `punch.test.ts`, `punch.spec.ts`, `a11y.spec.ts` |
| Loop 1/8, Loop 1/16, Tape, Crush | ersetzen das trockene Signal, schließen sich gegenseitig aus | ✅ | `engine.test.ts`, `next-punch.test.ts` |
| Half, Tief, Hoch, Echo | Takt bzw. Filter bzw. Zusatz, frei kombinierbar | ✅ | `next-punch.test.ts` |
| Bounce (Sampler) | Pattern auf das Pad, volles Pad nach Rückfrage, höchstens 3 s | ✅ | `bounce.test.ts`, `punch.spec.ts` |

## Spielspaß (Roadmap-Etappe 5)

| Handlung | Wirkung | Stand | Test |
|---|---|---|---|
| LCD-Streifen | Oszilloskop beim Spielen, Step-Punkte, ruhig im Stand bzw. bei „weniger Bewegung“ | ✅ | `lcd-scope.test.ts`, `engine.test.ts`, `spielspass.spec.ts` |
| Würfeln | Variation von BD, SD, CH, OH, mit Zurück und Meldung | ✅ | `core/vary.test.ts`, `song-patterns.test.ts`, `spielspass.spec.ts` |
| Szenen 1–8, Sichern | leer sichern, belegt abrufen (mit Zurück), Überschreiben im Sichern-Modus | ✅ | `core/scenes.test.ts`, `mixer.test.ts`, `spielspass.spec.ts` |

## Synth-Noten (Roadmap-Etappe 6a)

| Handlung | Wirkung | Stand | Test |
|---|---|---|---|
| Werkzeug Note / Akzent / Slide / Akkord | Tipp-Verhalten der Piano-Roll, Wahl bleibt nur in der Oberfläche | ✅ | `synth.test.ts`, `synth.spec.ts` |
| Akzent | Note lauter (× 1,35) und mit mehr Filter-Env, hellere Füllung | ✅ | `core/notes.test.ts`, `next-synth-attrs.test.ts`, `synth.test.ts` |
| Slide | gleitet in 60 ms von der klingenden Vorgängerin, ohne neuen Attack; Marke links | ✅ | `next-synth-attrs.test.ts`, `synth.test.ts` |
| Akkord | kein → Dreiklang → Vierklang → Quinte → Oktave, in der Tonart gestapelt, paraphon; Kürzel 3/4/5/8 und LCD-Meldung | ✅ | `core/notes.test.ts`, `next-synth-attrs.test.ts`, `synth.test.ts`, `synth.spec.ts` |
| Speichern | optionale Felder `a`, `s`, `ch` in der Note, alte Stände bytegleich, kaputte Werte fallen weg | ✅ | `core/notes.test.ts`, `core-persist.test.ts` |

## Arpeggiator und LFO (Roadmap-Etappe 6b)

| Handlung | Wirkung | Stand | Test |
|---|---|---|---|
| Arp: Aus / Auf / Ab / Auf-Ab / Zufall | Note bzw. Akkord als Folge einzelner Töne | ✅ | `core/arp.test.ts`, `next-synth-attrs.test.ts`, `engine.test.ts`, `synth.test.ts`, `synth.spec.ts` |
| Arp-Rate 1/16 / 1/32, Oktaven 1 / 2 | Abstand und Tonvorrat, im Aus vorwählbar | ✅ | `core/arp.test.ts`, `synth.test.ts` |
| LFO Rate, Depth (Doppeltipp: 0,5 bzw. aus) | 0,1–19 Hz, Hub bis ±2 Oktaven (Cutoff) bzw. ±1 Halbton (Pitch) | ✅ | `engine.test.ts`, `next-synth-attrs.test.ts`, `synth.test.ts` |
| LFO-Ziel Cutoff / Pitch | gilt ab der nächsten Note | ✅ | `engine.test.ts`, `synth.test.ts`, `synth.spec.ts` |
| Speichern | optionale Felder `arp`, `lfo` im Patch, alte Stände bytegleich, Presets lassen sie stehen | ✅ | `core/arp.test.ts`, `core-persist.test.ts` |

## Sampler: Chop, Pitch und Tastatur (Roadmap-Etappe 7)

| Handlung | Wirkung | Stand | Test |
|---|---|---|---|
| Chop Aus / 2 / 4 / 8 | Pad in gleich große Slices zwischen den Griffen, Linien in der Wellenform | ✅ | `core/chop.test.ts`, `sampler.test.ts`, `sampler.spec.ts` |
| Verteilen | Slices der Reihe nach auf die gesetzten Steps, mit Zurück, Meldungen ohne Chop bzw. Steps | ✅ | `core/chop.test.ts`, `sampler.test.ts` |
| Pitch pro Step (− / Wert / +) | −12…+12 Halbtöne, Wert tippen setzt zurück | ✅ | `next-locks.test.ts`, `step-opts.test.ts`, `sampler.spec.ts` |
| Slice pro Step | Auswahl Ganz / 1–8, ein k über der Slice-Zahl spielt das letzte | ✅ | `core/chop.test.ts`, `next-locks.test.ts`, `step-opts.test.ts` |
| Tastatur | zwölf Tasten spielen das Pad (C = eigene Stimmung), Oktave −1…+1 | ✅ | `sampler.test.ts`, `sampler.spec.ts` |
| Speichern | optional `sl`, `n`, `k`; alte Stände bleiben bytegleich | ✅ | `core/chop.test.ts`, `core-persist.test.ts` |

## Undo-Stapel und Tap-Tempo (Roadmap-Etappe 8a)

| Handlung | Wirkung | Stand | Test |
|---|---|---|---|
| Zurück (Knopf, ⌘/Strg+Z) | bis zu 20 Schritte nacheinander, älteste fallen heraus | ✅ | `store.test.ts`, `core-pattern.test.ts`, `app.spec.ts` |
| Tap (Deck), Taste T | Tempo aus dem Mittel der letzten Tipps (60–200 BPM), neue Folge nach 2 s Pause, ohne Zurück | ✅ | `core/tap.test.ts`, `panels-head.test.ts`, `keys.test.ts`, `app.spec.ts` |

## Live-Aufnahme (Roadmap-Etappe 8b)

| Handlung | Wirkung | Stand | Test |
|---|---|---|---|
| Rec (Transport) | Aufnahme scharf; ein Start zählt einen Takt vor | ✅ | `transport` in `record.test.ts`, `engine.test.ts`, `app.spec.ts` |
| Spurname, Pad, Tastatur, Tonname der Roll | Schlag rastet auf den nächsten Step und wird gesetzt (Overdub, Song: laufendes Pattern) | ✅ | `core/record.test.ts`, `record.test.ts`, `engine.test.ts` |
| Take | alle Schläge bis Stopp = ein Zurück-Schritt | ✅ | `store.test.ts`, `record.test.ts`, `app.spec.ts` |

## Drive und Chorus (Etappe 10a)

| Funktion | Verhalten | Stand | Tests |
|---|---|---|---|
| Drive je Part (Doppeltipp: aus) | Sättigung, Lautheit etwa gleich | ✅ | `partfx.test.ts`, `next-partfx.test.ts`, `synth.test.ts` |
| Chorus je Part (Doppeltipp: aus) | Stereo-Breite, unter 250 Hz mittig | ✅ | `partfx.test.ts`, `next-partfx.test.ts`, `synth.test.ts`, `synth.spec.ts` |
| Presets und Vorlagen | setzen Drive und Chorus passend zum Sound | ✅ | `templates.test.ts`, `synth.test.ts` |

## Vorlagen-Browser (Etappe 9)

| Handlung | Wirkung | Stand | Test |
|---|---|---|---|
| Stil wählen (Basis, Lo-Fi, Hip-Hop, Trap, House, Techno) | zeigt dessen Vorlagen; Start bei „Basis“ bzw. beim Stil der geladenen Vorlage | ✅ | `song-patterns.test.ts`, `mix-song.spec.ts` |
| Vorlage tippen (21 in fünf Stilen) | laden (mit Zurück) | ✅ | `song-patterns.test.ts`, `templates.test.ts`, `next-templates.test.ts`, `mix-song.spec.ts` |
| Laden: Alles | Tempo, Swing, Tonart, Patterns A bis höchstens D, Kit, Sounds, Mixer, FX, Warm, Tape, Song; übrige Plätze und Sampler bleiben | ✅ | `templates.test.ts`, `song-patterns.test.ts` |
| Laden: Drums | nur Drum-Spuren dieser Patterns, Kit, Tempo, Swing | ✅ | `templates.test.ts`, `song-patterns.test.ts` |
| Laden: Sound | nur Kit, Sounds, Mixer, FX, Warm, Tape | ✅ | `templates.test.ts`, `song-patterns.test.ts` |
| Hinweiszeile | Basis: was ersetzt wird; geladene Vorlage: Beschreibung und BPM; sonst Anzahl und Wirkung (bei „Basis“ ohne Lade-Auswahl) | ✅ | `song-patterns.test.ts`, `mix-song.spec.ts` |
| Markierung | geladene Vorlage markiert, auch nach dem Neuladen | ✅ | `song-patterns.test.ts`, `mix-song.spec.ts` |
| Meldung | LCD „NAME · … BPM“ | ✅ | `song-patterns.test.ts` |

## Kits (Etappe 9)

| Handlung | Wirkung | Stand | Test |
|---|---|---|---|
| Kit tippen (Classic, Boom, Tight, Lo-Fi, Hard, Trap) | Level, Tune, Decay aller Drum-Stimmen laden (mit Zurück) | ✅ | `song-patterns.test.ts`, `templates.test.ts` |
| Markierung | nur solange alle Werte genau zum Kit passen | ✅ | `song-patterns.test.ts` |
| Meldung | LCD „KIT NAME“ | ✅ | `song-patterns.test.ts` |

## Klang: Warm und Tape (Etappe 9)

| Handlung | Wirkung | Stand | Test |
|---|---|---|---|
| Warm (FX) | warmer, analoger Klang an / aus, Meldung „WARM AN“ / „WARM AUS“; Drums werden neu gerendert | ✅ | `mixer.test.ts`, `core/tone.test.ts`, `audio/tone.test.ts` |
| Tape (FX, Doppeltipp: aus) | Bandmaschine 0–100 % | ✅ | `mixer.test.ts`, `core/tone.test.ts`, `audio/tone.test.ts` |
| Speichern | optionale Felder `warm`, `tape`; fehlen, solange aus | ✅ | `core/tone.test.ts`, `mix-song.spec.ts` |

## Geräte (Synth, Sampler, Mixer, FX, Punch)

| Handlung | Wirkung | Stand | Test |
|---|---|---|---|
| Gerätekopf tippen | Mobile: auf- bzw. zuklappen (gespeichert); Tablet: Tab wählen; Desktop: alle offen, ohne Köpfe | ✅ | `devices.test.ts`, `shell.test.ts` |
| ← / → auf einem Tab (Tablet) | Gerät wechseln | ✅ | `devices.test.ts` |
| Zusammenfassung im Gerätekopf | Stand des Geräts ohne Aufklappen | ✅ | `synth.test.ts`, `sampler.test.ts`, `mixer.test.ts`, `punch.test.ts` |
| Layout-Wechsel (Drehen) | das Gerät mit dem Fokus bleibt sichtbar | ✅ | `devices.test.ts` |

## Regler und Umschalter (überall)

| Handlung | Wirkung | Stand | Test |
|---|---|---|---|
| Drehregler ziehen | Wert ändern, Meldung im LCD | ✅ | `knob.test.ts` |
| Schieberegler ziehen oder antippen | Wert an der Zeigerhöhe, Meldung im LCD | ✅ | `controls-synth.test.ts` |
| Doppeltipp auf einen Regler | Standardwert | ✅ | `knob.test.ts`, `controls-synth.test.ts` |
| Pfeile, Pos1, Ende auf einem Regler | 2 % (mit Umschalt 10 %), Minimum, Maximum | ✅ | `knob.test.ts`, `controls-synth.test.ts` |
| Pfeile auf einem Umschalter | Option wählen (ein Tab-Stopp) | ✅ | `controls.test.ts` |

