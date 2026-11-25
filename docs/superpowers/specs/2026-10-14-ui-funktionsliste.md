# Funktionsliste der Oberfläche („Ein Gerät“)

Stand: 2026-11-25 (App 0.29.0). Ursprünglich aus der alten App abgeleitet (`build*`-Funktionen, Listener in `init`, Markup), seither nachgeführt; mit dem Umbau „Ein Gerät“ (`2026-11-25-ui-ein-geraet-design.md`) hat jede Zeile einen Ort in der neuen Oberfläche bekommen und wurde gegen die laufende App und die Tests geprüft. Jede Bedienhandlung steht in einer Zeile: Nichts davon darf verloren gehen, und jede Zeile verweist auf ihren Test. Gehört zu `2026-10-14-ui-layouts-design.md`.

Legende: ✅ umgesetzt und getestet

**Ort:** „Modus › Seite“ (Modusleiste: Spur, Sound, Mixer, Song, Punch) oder ein fester Teil des Rahmens (Display, Modusleiste, Spurwahl, Step-Bereich, Transport) bzw. eine der Flächen Pad-Feld, Pattern, Tempo. Die Seite gilt für alle Layouts; Tablet und Desktop zeigen mehrere Seiten nebeneinander (Reiter nennen dann alle, z. B. „Klang · Filter“). „Spur (Drum, Synth, Sampler)“ meint die Art der gewählten Spur.

Die UI-Tests liegen in `src/ui/`, die E2E-Tests (`*.spec.ts`) in `tests/e2e/`, `next-*` in `tests/reference/`.

## Rahmen und Navigation

| Handlung | Wirkung | Ort | Stand | Test |
|---|---|---|---|---|
| Modus wählen (Reiter „Bereich“) | genau eine Arbeitsfläche; offene Flächen schließen | Modusleiste | ✅ | `frame-head.test.ts` „Reiter „Bereich“ wählen den Modus und folgen ihm“; `shell.test.ts` „Moduswechsel zeigt genau eine Arbeitsfläche“; `nav.test.ts` „setMode schließt offene Flächen“ |
| Seite wählen (Reiter) | zeigt die Seiten der Ansicht; ohne zweite Ansicht keine Reiter | Spur, Mixer, Sound (Telefon) › Reiter | ✅ | `track-work.test.ts` „zeigt genau die Seiten der Ansicht, Reiter wechseln“; `mixer/mixer.test.ts` „mobile eine Seite, tablet zwei Ansichten, desktop alles ohne Reiter“ |
| Spur wechseln | die Seite bleibt, wenn es sie für die neue Art gibt, sonst die erste | Spur | ✅ | `track-work.test.ts` „Spurwechsel behält die Seite“; `nav.test.ts` „Seite bleibt beim Spurwechsel, sonst erste der Art“ |
| ← / → auf Reitern | Reiter wählen (ein Tab-Stopp), läuft um | überall, wo Reiter stehen | ✅ | `frame-controls.test.ts` „Klick und Pfeiltasten schreiben, Pfeile fokussieren und laufen um“ |
| Step-Bereich und Spurwahl je Modus | Telefon: Mixer und Song ohne beides, Spur mit Noten oder Tasten ohne Steps; Tablet: Noten ohne Steps; Desktop: immer Steps | Rahmen | ✅ | `nav.test.ts` „Sichtbarkeit von Step-Bereich und Spurwahl“; `shell.test.ts` „Mixer und Song mobile: Spurwahl und Steps hidden; in Sound und Punch bleiben sie“ |
| Fläche schließen („Schließen“, Escape) | Pad-Feld, Pattern und Tempo schließen; der Fokus kehrt zurück | Flächen | ✅ | `frame-controls.test.ts` „nicht modaler Dialog mit Namen, Inhalt und Knopf „Schließen“; zu = hidden“, „offen fokussiert den ersten Knopf, beim Schließen kehrt der Fokus zurück“, „Escape und Schließen rufen close“ |
| Layout-Wechsel (Drehen, Fenstergröße) | die Seite mit dem Fokus bleibt sichtbar; die eine Piano-Roll wandert mit; gehaltene Tasten verschwindender Seiten lösen | Rahmen | ✅ | `shell.test.ts` „mobile→desktop→mobile: Seite bleibt, Rolle liegt in steps bzw. in der Noten-Seite, genau eine“, „Fokus auf einer Seite: tablet→mobile behält SM Klang sichtbar und fokussiert“, „Layoutwechsel löst gehaltenen Stutter, wenn seine Seite verschwindet“ |
| Passt ins Fenster | das Dokument scrollt nie; die Mitte passt ohne Scrollen (Ausnahmen: Telefon quer, Sampler-Opt bei 390 × 660 um 24 px, Song-Kette, „Alle Spuren“, Plattenkiste scrollen in sich) | alle | ✅ | `fit.spec.ts` „Dokument scrollt nie“, „Mitte passt ohne Scrollen“, „Alles Sichtbare liegt im Bild“, „Touch-Ziele“ |

## Display und Tempo-Fläche

| Handlung | Wirkung | Ort | Stand | Test |
|---|---|---|---|---|
| BPM im Display tippen | Tempo-Fläche auf bzw. zu (Telefon: über Mitte und Steps; Tablet und Desktop: Karte) | Display | ✅ | `frame-head.test.ts` „BPM-Knopf öffnet Tempo, ein zweiter Tipp schließt“, „zeigt Tempo dreistellig und das Pattern“ |
| Tempo-Regler ziehen / Tasten | 60–200 BPM, Anzeige dreistellig, Meldung „Tempo … BPM“ | Fläche Tempo | ✅ | `frame-head.test.ts` „Tempo-, Swing- und Master-Regler schreiben in den Store“ |
| Tempo Doppeltipp | 90 BPM | Fläche Tempo | ✅ | `frame-head.test.ts` „Doppeltipp: Tempo 90, Swing 0, Master 0,8“ |
| Swing-Regler | 0–100 %, Doppeltipp 0 | Fläche Tempo | ✅ | `frame-head.test.ts` „Tempo-, Swing- und Master-Regler schreiben in den Store“, „Doppeltipp: Tempo 90, Swing 0, Master 0,8“ |
| Master-Regler | 0–100, Doppeltipp 80 | Fläche Tempo | ✅ | `frame-head.test.ts` „Tempo-, Swing- und Master-Regler schreiben in den Store“, „Doppeltipp: Tempo 90, Swing 0, Master 0,8“ |
| Anzeigezeile | gewählte Spur bzw. Pad, in Sound „SOUND FÜR BASS“ / „… LEAD“; 1,4 s lang eine Meldung | Display | ✅ | `frame-head.test.ts` „nennt die gewählte Spur, auch das Pad“, „Display nennt Ziel in Sound“; `readout.test.ts` „zeigt eine Meldung 1,4 s und kehrt dann zur Grundzeile zurück“ |
| Ohne Web Audio | Zeile „Kein Audio in diesem Browser“, Bearbeiten bleibt möglich | Display | ✅ | `frame-head.test.ts` „ohne Audio der Hinweis, in jedem Modus“ |

## Pattern-Fläche

| Handlung | Wirkung | Ort | Stand | Test |
|---|---|---|---|---|
| Pattern-Taste („A ▾“) | Fläche auf bzw. zu, der Modus bleibt | Modusleiste | ✅ | `frame-head.test.ts` „Pattern-Taste nennt das Pattern und öffnet bzw. schließt die Fläche“; `shell.test.ts` „Pattern-Taste und BPM öffnen ihre Flächen, Modus bleibt“ |
| Slot A–H tippen | Pattern wählen (Vorlagen-Merker wird abgewählt), Fläche schließt | Fläche Pattern | ✅ | `frame-head.test.ts` „wählt Pattern, markiert Auswahl und Inhalt“, „Slot-Tipp schließt, Kopieren nicht“; `core/pattern.test.ts`; `app.spec.ts` „Pattern wählen und Spur wählen“ |
| Inhaltspunkt | Punkt, wenn das Pattern Inhalt hat | Fläche Pattern | ✅ | `frame-head.test.ts` „wählt Pattern, markiert Auswahl und Inhalt“ |
| Kopieren, Einfügen | Pattern-Zwischenablage, Meldung; die Fläche bleibt offen | Fläche Pattern | ✅ | `frame-head.test.ts` „Kopieren, Einfügen, Leeren mit Zurück; die Fläche bleibt offen“; `mix-song.spec.ts` „Vorlage laden und zurück; Kopieren und Einfügen“; `keys.test.ts` „Cmd+Z macht rückgängig, Strg+C/V kopiert und fügt ein“ |
| Pattern leeren | mit Zurück | Fläche Pattern | ✅ | `frame-head.test.ts` „Kopieren, Einfügen, Leeren mit Zurück; die Fläche bleibt offen“ |
| Würfeln | Variation von BD, SD, CH, OH, mit Zurück und Meldung | Fläche Pattern | ✅ | `core/vary.test.ts`; `frame-head.test.ts` „„Variation würfeln“ ändert das Pattern mit Zurück und Meldung“; `spielspass.spec.ts` „Würfeln verändert das Pattern; Zurück stellt es wieder her“ |

## Spurwahl

| Handlung | Wirkung | Ort | Stand | Test |
|---|---|---|---|---|
| ‹ / › (Telefon) | vorige bzw. nächste Spur in Kanal-Reihenfolge, hält an den Enden; ohne Ton und Aufnahme | Spurwahl | ✅ | `track-select.test.ts` „läuft in der Reihenfolge der Kanäle und hält an BD und SM“, „‹ und › wählen nur: kein Ton, keine Aufnahme“ |
| Spurname tippen (Telefon) | Pad-Feld auf bzw. zu; Titel nennt Spur bzw. Pad | Spurwahl | ✅ | `track-select.test.ts` „Titel folgt Spur und Pad“, „Titelknopf öffnet und schließt das Pad-Feld“ |
| Spur-Pad bzw. Sampler-Pad im Pad-Feld | 12 Spuren und 8 Pads: wählen und anspielen; die Fläche schließt, bleibt bei scharfem Rec offen | Fläche Pad-Feld | ✅ | `track-select.test.ts` „zeigt 12 Spur-Pads und 8 Sampler-Pads“, „Pad-Feld schließt ohne Rec, bleibt bei scharfem Rec offen“, „Sampler-Pad im Feld wählt Pad und Spur SM“; `shell.test.ts` „Spurtaste öffnet das Pad-Feld; ein Pad wählt, schließt und Display folgt“ |
| Spurtaste tippen (Tablet, Desktop) | 13 Tasten: Spur wählen und anspielen | Spurwahl | ✅ | `track-select.test.ts` „13 Tasten in Kanal-Reihenfolge, die gewählte ist markiert“, „Drum: Tipp wählt und spielt an“, „Sampler: Tipp wählt und spielt das gewählte Pad, falls belegt“ |
| Eigenes Sample | Markierung an Spurtaste und Zeilen-Beschriftung | Spurwahl, Step-Bereich › Alle Spuren | ✅ | `track-select.test.ts` „eigenes Sample markiert die Taste (Klasse cust)“; `all-tracks.test.ts` „eigenes Drum-Sample markiert die Beschriftung (Klasse cust)“ |

## Step-Bereich

| Handlung | Wirkung | Ort | Stand | Test |
|---|---|---|---|---|
| Ansicht wählen | Telefon: die 16 Steps der Spurart; Tablet: „Steps“ oder „Alle Spuren“; Desktop: „Alle Spuren“, bei Bass und Lead dazu „Noten“ | Step-Bereich | ✅ | `shell.test.ts` „mobile: Steps der Spurart, ohne Umschalter; Noten nimmt den Step-Bereich mit“, „tablet: Umschalter „Steps \| Alle Spuren““, „desktop: „Alle Spuren“, bei Bass und Lead dazu „Noten““; `step-area.test.ts` „zeigt genau das Raster der Spurart“ |
| Drum-Step tippen | schalten; nur beim Einschalten im Stand vorhören | Step-Bereich › Steps | ✅ | `step-area.test.ts` „Tipp schaltet die gewählte Drum und hört nur beim Einschalten im Stand vor“ |
| Step mit Sub-Steps tippen | Sub-Steps löschen, Step aus, kein Vorhören | Step-Bereich | ✅ | `core/pattern.test.ts`; `step-area.test.ts` „Tipp auf einen Step mit Sub-Steps löscht sie und schaltet ihn aus“ |
| Sampler-Step tippen | schaltet den Step des gewählten Pads | Step-Bereich › Steps | ✅ | `step-area.test.ts` „16 Knöpfe „Sampler Step n“ für das gewählte Pad; Vorhören nur beim Einschalten im Stand“; `sampler.spec.ts` „Pad wählen, Step setzen, Datei laden; bleibt nach Neuladen“ |
| Noten-Step tippen (Bass, Lead) | zeigt Anfang und Ausklang; Tipp öffnet Spur › Noten in der passenden Takthälfte | Step-Bereich › Steps | ✅ | `step-area.test.ts` „Noten Step zeigt Anfang und Ausklang; Tipp ruft openNotes“; `nav.test.ts` „openNotes zeigt die richtige Takthälfte“ |
| Zelle in „Alle Spuren“ tippen | Spur wählen und Step schalten (Vorhören wie bei den Steps); Bass und Lead: Noten öffnen | Step-Bereich › Alle Spuren | ✅ | `all-tracks.test.ts` „Zellen schalten und wählen: Drum“, „Zellen schalten und wählen: Pad“, „Bass-Zelle öffnet Noten“ |
| Zeilen-Beschriftung tippen | Spur bzw. Pad wählen und anspielen (Tablet: ersetzt dort die Spurtasten) | Step-Bereich › Alle Spuren | ✅ | `all-tracks.test.ts` „Drum, Bass und Lead: wählt und spielt an“, „Pad: Tipp wählt dieses Pad und die Spur SM und spielt es an“ |
| Zeilen in „Alle Spuren“ | 10 Drums, Bass, Lead, dazu Pads mit Inhalt und das gewählte | Step-Bereich › Alle Spuren | ✅ | `all-tracks.test.ts` „Abschnitt „Alle Spuren“: Drums, Bass, Lead und das gewählte Pad zu je 16 Zellen“, „leeres, nicht gewähltes Pad hat keine Zeile; Inhalt gibt ihm eine, in Pad-Reihenfolge“ |
| Lauflicht | aktueller Step in Steps, Alle Spuren und Piano-Roll (rechnet die Ausgabelatenz ein) | Step-Bereich | ✅ | `step-area.test.ts` „Velocity und Marke am Step; Lauflicht markiert genau den laufenden“; `all-tracks.test.ts` „Lauflicht markiert die Spalte in allen Zeilen, auch in neu hinzugekommenen“; `engine.test.ts` „tick und nearestStep rechnen die Ausgabelatenz ein“; `app.spec.ts` „Start lässt das Lauflicht laufen, Stopp beendet es“ |
| Sub-Step-Marke | Steps mit Sub-Steps sind in allen Rastern markiert | Step-Bereich | ✅ | `step-area.test.ts` „Sub-Steps zeigen den Step an und markieren ihn“; `all-tracks.test.ts` „Zellen zeigen Sub-Steps, Velocity und Step-Optionen“; `controls.test.ts` „on, sub und gesperrt als Klassen und ARIA“ |

## Drum-Spur

| Handlung | Wirkung | Ort | Stand | Test |
|---|---|---|---|---|
| „Sub“ | Sub-Modus: Step-Tipp wählt den Step, Sub-Editor sichtbar | Spur (Drum) › Trig | ✅ | `step-area.test.ts` „Sub: Knopf schaltet den Modus, Auswahl bleibt, Sub-Editor bearbeitet den Step“, „Sub-Modus: Tipp wählt statt umzuschalten“; `sub-editor.test.ts` „nur im Sub-Modus sichtbar; bearbeitet die gewählte Spur am gewählten Step“ |
| Sub oder Opt offen | die Seitenreiter (beim Sampler auch die Pad-Reihe samt Meldungszeile) treten zurück; verlässt man Trig, gehen Sub und Opt aus | Spur › Trig | ✅ | `track-work.test.ts` „Sub oder Opt offen: Reiter und Pad-Reihe treten zurück, danach kommen sie wieder“, „der Fokus bleibt nie auf einem zurückgetretenen Reiter“; `nav.test.ts` „Sub und Opt gehen aus, wenn Trig nicht mehr sichtbar ist“ |
| Sub-Step tippen | schalten, beim Einschalten im Stand vorhören | Spur (Drum, Sampler) › Trig | ✅ | `sub-editor.test.ts` „Sub-Step umschalten, Vorhören nur beim Einschalten im Stand“ |
| Roll / ÷2 / ÷4 / Leeren | Vorlagen für die Sub-Steps (mit Zurück) | Spur (Drum, Sampler) › Trig | ✅ | `sub-editor.test.ts` „Vorlage %s setzt %i Sub-Steps“, „Leeren entfernt die Sub-Steps“; `store.test.ts` „weitere Befehle mit Schnappschuss: Sub-Vorlage, Noten leeren, Spur leeren“ |
| „Leeren“ (Name „Spur leeren“) | Spur samt Sub-Steps leeren (mit Zurück) | Spur (Drum) › Trig | ✅ | `step-area.test.ts` „Spur leeren löscht die gewählte Drum (mit Zurück)“ |
| Level / Tune / Decay | Werte der gewählten Stimme; Tune ±; nach dem Loslassen im Stand vorhören; Doppeltipp = Werkseinstellung | Spur (Drum) › Klang | ✅ | `step-area.test.ts` „Level, Tune, Decay der gewählten Stimme; Tune zeigt ±“, „Regler: nach dem Loslassen vorhören (nur im Stand), Doppeltipp = Werkseinstellung“ |
| „Eigenes Sample“ / „Sample ersetzen“ | Datei wählen, dekodieren, Stille abschneiden, speichern, vorhören, Meldung | Spur (Drum) › Klang | ✅ | `drum-sample.test.ts` „lädt, speichert, hört vor und meldet“, „schneidet lange Stille am Anfang ab (40 Samples Vorlauf)“ |
| „Original“ | eigenes Sample entfernen, vorhören, Meldung | Spur (Drum) › Klang | ✅ | `drum-sample.test.ts` „Original stellt den synthetischen Klang wieder her“ |
| Unlesbare Datei / Abbrechen | „NICHT LESBAR“ bzw. nichts | Spur (Drum) › Klang | ✅ | `drum-sample.test.ts` „unlesbare Datei: Meldung, nichts gespeichert“, „Abbrechen ändert nichts“ |
| Name der Spur und des Samples | Kürzel und Name im Display; Sample-Name (10 Zeichen) auf der Seite | Display, Spur (Drum) › Klang | ✅ | `frame-head.test.ts` „nennt die gewählte Spur, auch das Pad“; `step-area.test.ts` „nennt das eigene Sample (10 Zeichen) nur für Stimmen, die eines haben“ |
| Mute, Solo, Level, Pan, Reverb | Kanalzug der gewählten Spur (Drums, Bass, Lead, Sampler); Level Doppeltipp 80, Pan Mitte | Spur › Mix | ✅ | `track-work.test.ts` „channelPage schreibt den Kanal der Spur, beim Sampler SM“, „Level, Pan, Reverb, Mute und Solo folgen dem Kanal“ |

## Transport

| Handlung | Wirkung | Ort | Stand | Test |
|---|---|---|---|---|
| Pattern / Song | Modus wechseln; Song beginnt vorn | Transport | ✅ | `transport.test.ts` „Pattern/Song schaltet den Modus“; `engine.test.ts` „Moduswechsel während der Wiedergabe: der Song beginnt wieder vorn“ |
| Start / Stopp | Wiedergabe, Symbol und Beschriftung (am Desktop, bis 460 px Breite und am Telefon quer nur das Symbol) | Transport | ✅ | `transport.test.ts` „Start/Stopp mit Beschriftung, Symbol und aria-pressed“; `app.spec.ts` „Transport bleibt auf allen Telefonbreiten im Fenster, gestoppt und spielend“; `fit.spec.ts` „Start und Stopp bleiben lesbar oder nur Symbol“ |

## Tastaturkürzel, nur Desktop

| Handlung | Wirkung | Ort | Stand | Test |
|---|---|---|---|---|
| Leertaste | Start / Stopp | Tastatur | ✅ | `keys.test.ts` „Leertaste startet und stoppt“; `keys.spec.ts` „Leertaste, Ziffern, Pfeile, Zurück und Kürzel-Dialog“ |
| 1–8 | Pattern A–H | Tastatur | ✅ | `keys.test.ts` „1–8 wählt das Pattern, mit Modifikator nicht“ |
| ↑ / ↓ | Spur wählen, alle 13 von BD bis Sampler (nicht auf Reglern und Umschaltern, auch auf Reitern) | Tastatur | ✅ | `keys.test.ts` „↑/↓ wählen unter allen Spuren BD…SM, halten an den Enden; auf einem Regler nicht“, „↑/↓ wählen die Spur auch auf einem Reiter (Reiter nutzen nur ←/→)“ |
| ⌘/Strg+Z | Zurück | Tastatur | ✅ | `keys.test.ts` „Cmd+Z macht rückgängig, Strg+C/V kopiert und fügt ein“ |
| ⌘/Strg+C / V | Pattern kopieren / einfügen | Tastatur | ✅ | `keys.test.ts` „Cmd+Z macht rückgängig, Strg+C/V kopiert und fügt ein“, „Kopieren mit markiertem Text bleibt beim Text; Einfügen ohne Zwischenablage tut nichts“ |
| „?“ (nur Desktop) | Dialog mit den Kürzeln | Display | ✅ | `keys.test.ts` „öffnet den Dialog mit der Liste“, „die Hilfe nennt die neuen Kürzel“; `keys.spec.ts` „Leertaste, Ziffern, Pfeile, Zurück und Kürzel-Dialog“ |
| „Schließen“ im Kürzel-Dialog | Dialog zu | Dialog „Tastaturkürzel“ | ✅ | `keys.spec.ts` „Leertaste, Ziffern, Pfeile, Zurück und Kürzel-Dialog“ |
| Eingabefeld oder offener Dialog | Kürzel ruhen; gehaltene Leertaste und Ziffern wiederholen nicht | Tastatur | ✅ | `keys.test.ts` „bei offenem Dialog wirken keine Kürzel“, „gehaltene Leertaste und Ziffern wiederholen nicht“ |

## Plattform

Ohne eigene Bedienelemente; Ort „—“ heißt: wirkt im Hintergrund.

| Handlung | Wirkung | Ort | Stand | Test |
|---|---|---|---|---|
| Erster Tipp auf iOS | Stumm-Schalter ignorieren (audioSession bzw. stilles Audio-Element) | überall | ✅ | `ios.test.ts` „setzt audioSession auf playback und braucht dann kein Audio-Element“, „iOS ohne audioSession: stilles Element, leise, endlos, nur einmal“ |
| Tippen nach Anruf/Alarm | Kontext wecken (`resume`) | überall | ✅ | `lifecycle.test.ts` „stoppt beim Verbergen und weckt beim Tippen“; `engine.test.ts` „resume weckt nur einen nicht laufenden Kontext und legt keinen an“ |
| App in den Hintergrund | Wiedergabe stoppt | — | ✅ | `lifecycle.test.ts` „stoppt beim Verbergen und weckt beim Tippen“ |
| Wiedergabe | Bildschirm bleibt an (Wake Lock) | — | ✅ | `wake.test.ts` „hält und gibt frei“ |
| Artifact | Zustand über `window.claude.hot` hin und zurück | — | ✅ | `host.test.ts` „mit ready: init über den Host, snapshot registriert“; `host.spec.ts` „window.claude.hot: Startzustand vom Host, Schnappschuss zurück“ |
| Alter Speicherstand | lädt unverändert | — | ✅ | `core-persist.test.ts`; `compat.spec.ts` „alter Speicherstand lädt (Tempo, Auswahl, Steps)“ |
| Jede Änderung | Zustand wird entprellt (250 ms) selbst gespeichert, ein voller Speicher stört nicht | — | ✅ | `store/persist.test.ts` „speichert nicht beim Start, sondern 250 ms nach der letzten Änderung, einmal pro Folge“, „übersteht einen vollen Speicher“; `app.spec.ts` „Änderung wird beim Wechsel in den Hintergrund sofort gespeichert“ |

## Synth (Bass, Lead)

| Handlung | Wirkung | Ort | Stand | Test |
|---|---|---|---|---|
| Bass / Lead wählen | Spur BA bzw. LD wählen; alle Seiten zeigen deren Werte | Spurwahl | ✅ | `synth/synth.test.ts` „Part-Wechsel zeigt die Werte des anderen Parts“; `synth.spec.ts` „Note setzen, Preset laden, Part wechseln; bleibt nach Neuladen“ |
| Mute (Name „Bass stumm“ / „Lead stumm“), Solo | Stimme stumm bzw. solo (Mixer) | Spur (Synth) › Mix | ✅ | `track-work.test.ts` „channelPage schreibt den Kanal der Spur, beim Sampler SM“, „Level, Pan, Reverb, Mute und Solo folgen dem Kanal“ |
| Tonart, Skala | Auswahl | Spur (Synth) › Noten | ✅ | `synth/synth.test.ts` „synthNotesPage: Tonart, Skala, Bedienung, „Stimme leeren“ und leerer Platz für die Rolle“, „schreiben in den Store (Seite Noten)“; `synth.spec.ts` „Auswahllisten mit mindestens 16 px Schrift (iOS zoomt sonst beim Antippen)“ |
| Takthälfte 1–8 / 9–16 | Hälfte der Piano-Roll | Spur (Synth) › Noten | ✅ | `synth/synth.test.ts` „Takthälfte 9–16, Lauflicht nur auf der sichtbaren Hälfte“, „rollControls und rollGrid teilen Takthälfte und Werkzeug“ |
| Notenlänge 1/16, 1/8, 1/4 | Länge neuer Noten | Spur (Synth) › Noten | ✅ | `synth/synth.test.ts` „Notenlänge wählen“ |
| Roll-Zelle tippen | Note setzen bzw. löschen, im Stand vorhören | Spur (Synth) › Noten; Desktop: Step-Bereich › Noten | ✅ | `synth/synth.test.ts` „Note setzen hört im Stand vor; Ausklang tippt die Note weg; während der Wiedergabe still“, „andere Stufe im Ausklang setzt eine neue Note und kürzt die alte“; `synth.spec.ts` „Note setzen, Preset laden, Part wechseln; bleibt nach Neuladen“ |
| Roll-Label tippen | Ton vorhören | Spur (Synth) › Noten; Desktop: Step-Bereich › Noten | ✅ | `synth/synth.test.ts` „Label hört die Stufe vor, auch während der Wiedergabe“ |
| Lauflicht in der Roll | aktueller Step | Spur (Synth) › Noten; Desktop: Step-Bereich › Noten | ✅ | `synth/synth.test.ts` „Takthälfte 9–16, Lauflicht nur auf der sichtbaren Hälfte“; `synth.spec.ts` „Lauflicht in der Roll beim Spielen“ |
| Wellenform (Saw, Square, Tri, Sine) | Oszillator, dabei vorhören | Spur (Synth) › Klang | ✅ | `synth/synth.test.ts` „Wellenform und Oktave hören vor; Oktave begrenzt, Preset bleibt bei Oktave“ |
| Oktave − / + | Oktave, begrenzt, dabei vorhören | Spur (Synth) › Klang | ✅ | `synth/synth.test.ts` „Wellenform und Oktave hören vor; Oktave begrenzt, Preset bleibt bei Oktave“ |
| Detune, Sub, Delay, Level | Regler | Spur (Synth) › Klang | ✅ | `synth/synth.test.ts` „jeder Knob schreibt seinen Schlüssel“, „Regler schreiben den Patch des gewählten Parts und heben die Preset-Markierung auf“ |
| Cutoff, Reso, Env | Filter-Regler | Spur (Synth) › Filter | ✅ | `synth/synth.test.ts` „jeder Knob schreibt seinen Schlüssel“, „jede Synth-Seite hat genau ihre Regler“ |
| Filter-Env (Attack, Decay, Sustain, Release) | Schieberegler mit Zeiten und Hüllkurvenanzeige | Spur (Synth) › Filter | ✅ | `synth/synth.test.ts` „Schieberegler mit Zeitformat; Hüllkurve folgt; alle acht ADSR-Regler“ |
| Amp-Env (Attack, Decay, Sustain, Release) | Schieberegler mit Zeiten und Hüllkurvenanzeige | Spur (Synth) › Amp | ✅ | `synth/synth.test.ts` „Schieberegler mit Zeitformat; Hüllkurve folgt; alle acht ADSR-Regler“ |
| Presets | Liste je Part (Umschalter „Stimme“ Bass/Lead); Patch laden mit Zurück, Markierung, vorhören, Meldung | Sound › Synth-Sound | ✅ | `library.test.ts` „Synth-Sound auf Lead“, „der Umschalter folgt state.part; Bass meldet sich als BASS“, „Laden hat Zurück; dasselbe Preset noch einmal legt keinen Schritt an“; `synth/synth.test.ts` „zeigt die Presets des Parts, lädt und markiert; Wechsel des Parts baut neu“; `store.test.ts` „laden mit Zurück: nur der Patch des Parts, spätere Änderungen bleiben“; `synth.spec.ts` „Note setzen, Preset laden, Part wechseln; bleibt nach Neuladen“ |
| „Leeren“ (Name „Stimme leeren“) | Noten der Stimme löschen (mit Zurück) | Spur (Synth) › Noten | ✅ | `synth/synth.test.ts` „„Stimme leeren“ leert die Noten des Parts mit Zurück“ |
| Sound-Regler loslassen, Doppeltipp | Detune, Sub, Delay, Level, Filter und beide Hüllkurven: nach dem Loslassen vorhören; Doppeltipp = Werkseinstellung des Parts | Spur (Synth) › Klang, Filter, Amp | ✅ | `synth/synth.test.ts` „Loslassen hört vor; Doppeltipp: Werkseinstellung des Parts (Knob und Schieberegler)“ |

## Sampler

| Handlung | Wirkung | Ort | Stand | Test |
|---|---|---|---|---|
| Pad tippen | wählen und vorhören; Name bzw. „leer“, Inhaltspunkt | Spur (Sampler) › Pad-Reihe über den Seiten | ✅ | `sampler/sampler.test.ts` „Pad antippen wählt; mit Sample hört es vor, ohne nicht“, „Name, Inhaltspunkt aus den Steps“; `sampler.spec.ts` „Pad wählen, Step setzen, Datei laden; bleibt nach Neuladen“ |
| Wellenform | Start- und Endmarke ziehen (nach dem Loslassen vorhören); Hinweis bei leerem Pad. Das Lauflicht des Pads liegt auf seinen Steps | Spur (Sampler) › Klang | ✅ | `sampler/sampler.test.ts` „mit Sample: näherer Griff folgt dem Zeiger, Loslassen hört vor“, „ohne Sample: Hinweis sichtbar, Ziehen wirkungslos“ |
| Laden | Datei dekodieren (`engine.decode`), Meldung bei Fehler | Spur (Sampler) › Klang | ✅ | `sampler/sampler.test.ts` „Laden: dekodiert, setzt Bereich und Namen, speichert, hört vor, meldet“, „Laden abgebrochen, Datei unlesbar, Lesefehler“; `sampler.spec.ts` „Pad wählen, Step setzen, Datei laden; bleibt nach Neuladen“ |
| Rec / Stopp | mit dem Mikrofon aufnehmen (höchstens 3 s, zweiter Tipp stoppt; Rückfall Dateiauswahl mit capture) | Spur (Sampler) › Klang | ✅ | `sampler/sampler.test.ts` „Rec: Aufnahme starten, Stopp beendet, Ergebnis landet im Pad“, „Rec ohne Daten, ohne Mikrofon, gesperrt (Rückfall Dateiauswahl mit capture)“; `recorder.test.ts` „stoppt nach der Höchstdauer; ohne Daten null“ |
| Leeren | Pad leeren | Spur (Sampler) › Klang | ✅ | `sampler/sampler.test.ts` „Rev schaltet um und hört vor; Leeren setzt das Pad zurück“; `sampler.spec.ts` „Rev und Leeren“ |
| Rev | rückwärts abspielen, dabei vorhören | Spur (Sampler) › Klang | ✅ | `sampler/sampler.test.ts` „Rev schaltet um und hört vor; Leeren setzt das Pad zurück“; `sampler.spec.ts` „Rev und Leeren“ |
| Tune, Attack, Decay, Level | Regler je Pad; nach dem Loslassen vorhören, Doppeltipp = Standard | Spur (Sampler) › Klang | ✅ | `sampler/sampler.test.ts` „Werte des gewählten Pads, Tune in Halbtönen, Tag „PAD n“, Doppeltipp Standard“ |
| Sampler-Steps, Sub-Steps | wie Drums, je Pad | Spur (Sampler) › Trig, Step-Bereich | ✅ | `step-area.test.ts` „pressPadStep: Sub wählt nur, Opt wählt und schaltet ein“, „Sub und Opt des gewählten Pads; Sub-Editor hört das Pad vor“; `sampler.spec.ts` „Pad wählen, Step setzen, Datei laden; bleibt nach Neuladen“ |
| „Leeren“ (Name „Spur leeren“) | nur die Spur des gewählten Pads leeren (mit Zurück) | Spur (Sampler) › Trig | ✅ | `step-area.test.ts` „Spur leeren löscht nur das gewählte Pad (mit Zurück)“; `store.test.ts` „clearPadTrack leert die Pad-Spur mit Zurück“ |
| Meldungen | `role=status`, über den Seiten (auf jeder Sampler-Seite; verborgen, solange Sub oder Opt offen sind) | Spur (Sampler) | ✅ | `sampler/sampler.test.ts` „zeigt eine Meldung 4,5 s, dauerhafte bleiben, Aufräumen bricht ab“, „Meldungen der Werkzeuge landen ebenfalls in head“ |

## Mixer

| Handlung | Wirkung | Ort | Stand | Test |
|---|---|---|---|---|
| Kanal wählen | 13 Kanäle, Auswahl markiert | Mixer › Kanäle | ✅ | `mixer/mixer.test.ts` „13 Züge mit Namensknopf und senkrechtem Regler“, „Name wählt den Kanal; Pan und Reverb melden ihn, Doppeltipp = Werkseinstellung“; `mix-song.spec.ts` „Mixer: Mute, Solo, Fader; Marken am Kanalzug“ |
| Lautstärke-Fader (senkrecht) | je Kanal, wählt ihn; Doppeltipp 80 | Mixer › Kanäle | ✅ | `mixer/mixer.test.ts` „Fader schreibt, wählt den Kanal, Doppeltipp 80, folgt dem Zustand“; `mix-song.spec.ts` „Mixer: Mute, Solo, Fader; Marken am Kanalzug“ |
| Mute / Solo | für den gewählten Kanal (`aria-pressed`); der Kanalzug zeigt stumm und solo | Mixer › Kanäle | ✅ | `mixer/mixer.test.ts` „Zug zeigt Stumm und Solo, M/S/Pan/Reverb wirken auf den gewählten Kanal“; `mix-song.spec.ts` „Mixer: Mute, Solo, Fader; Marken am Kanalzug“; `core/mixer.test.ts` |
| Pan, Reverb-Send | Regler des gewählten Kanals, Pan rastet beim Ziehen in der Mitte | Mixer › Kanäle | ✅ | `mixer/mixer.test.ts` „Name wählt den Kanal; Pan und Reverb melden ihn, Doppeltipp = Werkseinstellung“; `format.test.ts` „panText“; `knob.test.ts` „Rastpunkt: beim Ziehen fängt der Wert nahe snap, Tasten bewegen frei“ |

## FX

| Handlung | Wirkung | Ort | Stand | Test |
|---|---|---|---|---|
| Size, Damp, Return | Reverb | Mixer › FX | ✅ | `mixer/mixer.test.ts` „Reverb- und DJ-Regler mit Texten“; `format.test.ts` „djText und sizeText“ |
| Filter, Reso | DJ-Filter, Filter rastet beim Ziehen in der Mitte | Mixer › FX | ✅ | `mixer/mixer.test.ts` „Reverb- und DJ-Regler mit Texten“; `mix-song.spec.ts` „FX: Stutter halten und loslassen; Filter-Regler“ |
| Stutter 1/4, 1/8, 1/16, 1/32 halten | Stutter an, solange gehalten; Loslassen, Abbruch, Zeigerverlust und Seitenwechsel schalten aus | Mixer › FX | ✅ | `mixer/mixer.test.ts` „Stutter halten: an beim Drücken, aus bei Loslassen, Abbruch und Zeigerverlust“, „Seitenwechsel weg von FX löst Stutter“; `mix-song.spec.ts` „FX: Stutter halten und loslassen; Filter-Regler“ |

## Song

| Handlung | Wirkung | Ort | Stand | Test |
|---|---|---|---|---|
| „+ X anhängen“ | aktuelles Pattern anhängen (höchstens 32) | Song | ✅ | `panels/song.test.ts` „leer: Hinweis; anhängen wählt die neue Position“, „bei 32 Positionen gesperrt“; `mix-song.spec.ts` „Song: anhängen, Wiederholung, verschieben, entfernen, leeren; bleibt nach Neuladen“ |
| − / + | Wiederholungen (1–16) | Song | ✅ | `panels/song.test.ts` „Wiederholungen, Verschieben, Entfernen mit Grenzen und Auswahl“ |
| ← / → | Position verschieben, Auswahl folgt | Song | ✅ | `panels/song.test.ts` „Wiederholungen, Verschieben, Entfernen mit Grenzen und Auswahl“ |
| Entfernen, Leeren | Position bzw. Song löschen | Song | ✅ | `panels/song.test.ts` „Wiederholungen, Verschieben, Entfernen mit Grenzen und Auswahl“, „gespielte Position leuchtet; Leeren hebt die Auswahl auf“; `mix-song.spec.ts` „Song: anhängen, Wiederholung, verschieben, entfernen, leeren; bleibt nach Neuladen“ |
| Wiedergabe-Markierung | gespielte Position, bleibt in der scrollenden Kette sichtbar | Song | ✅ | `panels/song.test.ts` „gespielte Position leuchtet; Leeren hebt die Auswahl auf“, „die gespielte Position bleibt in der scrollenden Kette sichtbar“ |
| Block antippen | Position wählen und ihr Pattern zeigen (nicht bei laufendem Song) | Song | ✅ | `panels/song.test.ts` „Block antippen wählt und zeigt das Pattern, außer bei laufendem Song“ |
| Leerer Song | Hinweis zum Anhängen; Knöpfe ohne Auswahl gesperrt | Song | ✅ | `panels/song.test.ts` „leer: Hinweis; anhängen wählt die neue Position“ |

## Plattenkiste: Basis-Muster und Zurück

Sound zeigt die Plattenkiste: auf dem Telefon mit Reitern (Start bei „Vorlagen“), auf Tablet und Desktop alle Abschnitte nebeneinander (`library.test.ts` „mobile: Reiter „Plattenkiste“, Start bei Vorlagen, ein Abschnitt zur Zeit“, „tablet und desktop: alle nebeneinander mit Überschrift; zurück bleibt der Reiter“).

| Handlung | Wirkung | Ort | Stand | Test |
|---|---|---|---|---|
| Basis-Muster House, Electro, Hip-Hop, Trap | ersetzt die Drum-Spuren des aktuellen Patterns, dazu Tempo und Swing (mit Zurück), Markierung | Sound › Basis-Muster | ✅ | `library.test.ts` „lädt die Drum-Muster mit Markierung und Zurück“; `core/pattern.test.ts` |
| Zurück | letzten Schritt zurücknehmen (bis zu 20); ohne Verlauf gesperrt | Display | ✅ | `frame-head.test.ts` „Zurück gesperrt/aktiv“; `store.test.ts` „mehrstufig: jeder Schritt zurück, in umgekehrter Reihenfolge, danach leer“, „Tiefe 20: der älteste Schritt fällt heraus“; `app.spec.ts` „Tap-Tempo setzt das Tempo, mehrstufiges Zurück nimmt zwei Änderungen nacheinander zurück“ |

## Projekt und Export

| Handlung | Wirkung | Ort | Stand | Test |
|---|---|---|---|---|
| Datei | Dialog „Projekt und Export“ | Display | ✅ | `project/project.test.ts` „Datei-Knopf öffnet den Dialog“; `project.spec.ts` „Datei-Dialog: im Fenster, Touch-Ziele ≥ 44 px“; `a11y.spec.ts` „keine schweren Verstöße mit offenem Datei-Dialog (axe)“ |
| „Schließen“ im Datei-Dialog | Dialog zu | Dialog „Projekt und Export“ | ✅ | `project.spec.ts` „Projekt sichern, ändern, öffnen und ersetzen; bleibt nach Neuladen“ |
| Projekt sichern, ⌘/Strg+S | `.pocket808.json` mit Zustand und Samples; Teilen-Menü bzw. Download | Display › Datei | ✅ | `core/project.test.ts`; `project/project.test.ts` „Projekt sichern gibt eine gültige Projektdatei mit Namen aus“; `share.test.ts` „teilt die Datei, wenn der Browser Dateien teilen kann (iPhone)“, „ohne Teilen von Dateien: Download, URL wird danach freigegeben“; `keys.test.ts` „⌘/Strg+S sichert, ⌘/Strg+O öffnet; nicht bei offenem Dialog“ |
| Sichern im Claude-Artifact | über die Download-Freigabe; nicht erlaubte Endungen (WAV) kommen als ZIP; Ablehnen ist kein Fehler | Display › Datei | ✅ | `share.test.ts` „JSON geht direkt über die Download-Freigabe, kein Teilen, kein Link“, „WAV ist dort nicht erlaubt: kommt als ZIP mit der unveränderten WAV darin“, „abgelehnt: cancelled; andere Fehler: failed“; `zip.test.ts` „eine Datei: lokaler Kopf, Daten unverändert, Verzeichnis und Abschluss“ |
| Projekt öffnen, ⌘/Strg+O | prüfen, fragen, ersetzen; Zurück stellt Zustand und Samples wieder her | Display › Datei | ✅ | `project/project.test.ts` „gültige Datei: Frage, Abbrechen lässt alles wie es ist“, „Ersetzen übernimmt Zustand und Samples; Zurück stellt beides wieder her“; `store.test.ts` „replaceState: Zurück stellt den vorherigen Zustand komplett her und ruft revert“; `project.spec.ts` „Projekt sichern, ändern, öffnen und ersetzen; bleibt nach Neuladen“ |
| Fremde oder kaputte Datei | Meldung „Keine Pocket-808-Datei“, nichts ändert sich | Display › Datei | ✅ | `core/project.test.ts`; `project.spec.ts` „fremde Datei: Meldung, nichts ändert sich“ |
| Umfang Pattern / Song, 1× / 2× / 4× / 8× | wählt den Export; Song ist leer gesperrt, ohne Wiederholungen; eine andere Wahl verwirft das fertige WAV | Display › Datei | ✅ | `core/export.test.ts`; `project/project.test.ts` „zeigt die Länge; leerer Song ist gesperrt“, „erzeugt mit Fortschritt, dann WAV sichern“ |
| WAV erzeugen | Länge, Fortschritt, Abbrechen, Fehlermeldung; höchstens 5 min | Display › Datei | ✅ | `core/export.test.ts`; `project/project.test.ts` „erzeugt mit Fortschritt, dann WAV sichern“, „Abbrechen bricht ab und meldet es; danach geht ein neuer Export“, „zu lang: gesperrt mit Hinweis“; `next-mix.test.ts` |
| WAV sichern | 44,1 kHz, 16 Bit, Stereo | Display › Datei | ✅ | `wav.test.ts`; `project.spec.ts` „Pattern 1× als WAV: gültiger Kopf und passende Länge“ |

## Step-Optionen

| Handlung | Wirkung | Ort | Stand | Test |
|---|---|---|---|---|
| Opt | Opt-Modus, schließt Sub aus; Tipp wählt, schaltet ausgeschaltete Steps ein | Spur (Drum, Sampler) › Trig | ✅ | `step-opts.test.ts` „Opt-Modus: Panel erscheint, Tipp auf einen ausgeschalteten Step schaltet ihn ein und wählt ihn“, „Opt und Sub schließen sich aus; ausgeschalteter gewählter Step blendet die Regler aus“; `stepopts.spec.ts` „Opt-Modus: Step einschalten, Leise, Bedingung 1:2; bleibt nach Neuladen“ |
| Velocity, Leise/Mittel/Voll | Pegel v², Helligkeit des Steps | Spur › Trig › Opt | ✅ | `core/stepopts.test.ts`; `next-stepopts.test.ts`; `step-opts.test.ts` „Velocity per Knob und Schnellwahl, Chance, Bedingung, Zurücksetzen (mit Zurück)“ |
| Chance | Wahrscheinlichkeit pro Step, einmal gewürfelt | Spur › Trig › Opt | ✅ | `next-stepopts.test.ts`; `step-opts.test.ts` „Velocity per Knob und Schnellwahl, Chance, Bedingung, Zurücksetzen (mit Zurück)“ |
| Bedingung | 1:2 … 4:4, Erster, Nicht erster; Zählung je Slot ab Start | Spur › Trig › Opt | ✅ | `core/stepopts.test.ts` „Bedingungen mit Beschriftungen, Velocity als Pegel v²“; `next-stepopts.test.ts` „Bedingungen zählen die Durchläufe ab Start“ |
| Zurücksetzen | Standard (mit Zurück) | Spur › Trig › Opt | ✅ | `step-opts.test.ts` „Velocity per Knob und Schnellwahl, Chance, Bedingung, Zurücksetzen (mit Zurück)“ |
| Marke am Step | Chance, Bedingung, Lock, Pitch oder Slice markieren den Step (Steps und Alle Spuren) | Step-Bereich | ✅ | `step-opts.test.ts` „Spurzellen zeigen Velocity und Marke“; `step-area.test.ts` „Velocity und Marke am Step; Lauflicht markiert genau den laufenden“ |
| Speichern | optionales `opt` im Pattern, alte Stände bytegleich | — | ✅ | `core/stepopts.test.ts`; `core-persist.test.ts`; `stepopts.spec.ts` „Opt-Modus: Step einschalten, Leise, Bedingung 1:2; bleibt nach Neuladen“ |

## Fill und Parameter-Locks

| Handlung | Wirkung | Ort | Stand | Test |
|---|---|---|---|---|
| Fill halten, F halten | Bedingungen „Fill“/„Nicht Fill“; Loslassen, Abbruch, Fokusverlust lösen | Transport | ✅ | `transport.test.ts` „halten schaltet Fill an, Loslassen, Abbruch und Fokusverlust aus“; `keys.test.ts` „keydown an, keyup aus, Wiederholungen zählen nicht“; `next-locks.test.ts`; `stepopts.spec.ts` „Fill-Taste: im Fenster, Touch-Ziel, halten und loslassen“ |
| Lock Tune/Decay (Drums) | eigene vorgerenderte Variante pro Step | Spur (Drum) › Trig › Opt | ✅ | `core/stepopts.test.ts`; `next-locks.test.ts`; `step-opts.test.ts` „Drums: Tune und Decay zeigen den Spurwert, Drehen lockt, „Locks lösen“ mit Zurück“ |
| Lock Tune/Decay/Start (Pads) | live pro Treffer | Spur (Sampler) › Trig › Opt | ✅ | `next-locks.test.ts`; `step-opts.test.ts` „Pads: zusätzlich Start; Velocity bleibt beim Lösen der Locks“ |
| Locks lösen | mit Zurück, übrige Optionen bleiben | Spur › Trig › Opt | ✅ | `step-opts.test.ts` „Drums: Tune und Decay zeigen den Spurwert, Drehen lockt, „Locks lösen“ mit Zurück“, „Pads: zusätzlich Start; Velocity bleibt beim Lösen der Locks“ |

## Punch-in und Bounce

| Handlung | Wirkung | Ort | Stand | Test |
|---|---|---|---|---|
| Punch-Pads halten | acht Haltetasten, mehrere zugleich; Moduswechsel löst alle | Punch | ✅ | `punch/punch.test.ts` „8 Haltetasten; mehrere zugleich halten, einzeln loslassen; Abbau löst alle“, „acht Haltetasten ohne Gerät; Ausblenden löst“; `shell.test.ts` „Punch gehalten, Moduswechsel → punchOff“; `punch.spec.ts` „Punch: acht Haltetasten im Fenster, halten und loslassen“; `a11y.spec.ts` „keine schweren Verstöße mit offenem Punch (axe)“ |
| Loop 1/8, Loop 1/16, Tape, Crush | ersetzen das trockene Signal, schließen sich gegenseitig aus | Punch | ✅ | `engine.test.ts` „Punch: ersetzende Effekte lösen sich ab, andere kombinieren; Stopp löst alles“; `next-punch.test.ts` |
| Half, Tief, Hoch, Echo | Takt bzw. Filter bzw. Zusatz, frei kombinierbar | Punch | ✅ | `next-punch.test.ts` „Half-Time verdoppelt den Step-Abstand nur solange gehalten“, „Tiefpass und Hochpass verschieben den Schwerpunkt, danach zurück“, „Echo klingt nach dem Loslassen aus“ |
| Bounce | Pattern auf das Pad, volles Pad nach Rückfrage, höchstens 3 s | Spur (Sampler) › Klang | ✅ | `bounce.test.ts` „leeres Pad: rendert das Pattern im Pattern-Modus und legt es als „Bounce“ ab“, „volles Pad: erst fragen; Abbrechen tut nichts, Ersetzen bounct“; `punch.spec.ts` „Bounce ins leere Pad 5: Name „Bounce“, bleibt nach Neuladen“ |

## Spielspaß

Würfeln steht unter „Pattern-Fläche“.

| Handlung | Wirkung | Ort | Stand | Test |
|---|---|---|---|---|
| LCD-Streifen | Oszilloskop beim Spielen, Step-Punkte, ruhig im Stand bzw. bei „weniger Bewegung“ | Display | ✅ | `lcd-scope.test.ts` „beim Spielen: Animationslauf mit Oszilloskop; Stopp beendet ihn“, „weniger Bewegung: kein Animationslauf, Neuzeichnen nur beim Step-Wechsel“; `engine.test.ts` „scope: ohne Kontext false; Analyser erst bei der ersten Anforderung“; `spielspass.spec.ts` „LCD-Streifen im Fenster“ |
| Szenen 1–8, Sichern | leer sichern, belegt abrufen (mit Zurück), Überschreiben im Sichern-Modus | Mixer › Szenen | ✅ | `core/scenes.test.ts`; `mixer/mixer.test.ts` „leer sichern, belegt abrufen, Sichern-Modus überschreibt, Markierung und Zurück“, „steht für sich: acht Szenen und Sichern“; `spielspass.spec.ts` „Szene sichern und abrufen; bleibt nach Neuladen“ |

## Synth-Noten

| Handlung | Wirkung | Ort | Stand | Test |
|---|---|---|---|---|
| Werkzeug Note / Akzent / Slide / Akkord | Tipp-Verhalten der Piano-Roll, Wahl bleibt nur in der Oberfläche | Spur (Synth) › Noten | ✅ | `synth/synth.test.ts` „Werkzeug Akzent und Slide schalten die Note unter dem Tipp um, leere Zellen bleiben leer“, „rollControls und rollGrid teilen Takthälfte und Werkzeug“; `synth.spec.ts` „Werkzeug: Akkord und Akzent setzen, bleibt nach Neuladen“ |
| Akzent | Note lauter (× 1,35) und mit mehr Filter-Env, hellere Füllung | Spur (Synth) › Noten | ✅ | `core/notes.test.ts`; `next-synth-attrs.test.ts`; `synth/synth.test.ts` „Werkzeug Akzent und Slide schalten die Note unter dem Tipp um, leere Zellen bleiben leer“ |
| Slide | gleitet in 60 ms von der klingenden Vorgängerin, ohne neuen Attack; Marke links | Spur (Synth) › Noten | ✅ | `next-synth-attrs.test.ts`; `synth/synth.test.ts` „Werkzeug Akzent und Slide schalten die Note unter dem Tipp um, leere Zellen bleiben leer“ |
| Akkord | kein → Dreiklang → Vierklang → Quinte → Oktave, in der Tonart gestapelt, paraphon; Kürzel 3/4/5/8 und Meldung | Spur (Synth) › Noten | ✅ | `core/notes.test.ts`; `next-synth-attrs.test.ts`; `synth/synth.test.ts` „Werkzeug Akkord schaltet weiter, zeigt das Kürzel und meldet im LCD“; `synth.spec.ts` „Werkzeug: Akkord und Akzent setzen, bleibt nach Neuladen“ |
| Speichern | optionale Felder `a`, `s`, `ch` in der Note, alte Stände bytegleich, kaputte Werte fallen weg | — | ✅ | `core/notes.test.ts` „Speicherformat: Rundreise, kaputte Werte fallen weg, alte Noten bleiben schlank“; `core-persist.test.ts` |

## Arpeggiator und LFO

| Handlung | Wirkung | Ort | Stand | Test |
|---|---|---|---|---|
| Arp: Aus / Auf / Ab / Auf-Ab / Zufall | Note bzw. Akkord als Folge einzelner Töne | Spur (Synth) › Bewegung | ✅ | `core/arp.test.ts`; `next-synth-attrs.test.ts`; `engine.test.ts` „Arp im Scheduler: ein Dreiklang mit Länge 2 und 1/32 plant vier einzelne Töne“; `synth/synth.test.ts` „Arp: Modus schaltet ein und aus, Rate und Oktaven gelten (auch vorgewählt im Aus)“; `synth.spec.ts` „Arp und LFO setzen, bleibt nach Neuladen“ |
| Arp-Rate 1/16 / 1/32, Oktaven 1 / 2 | Abstand und Tonvorrat, im Aus vorwählbar | Spur (Synth) › Bewegung | ✅ | `core/arp.test.ts`; `synth/synth.test.ts` „Arp: Modus schaltet ein und aus, Rate und Oktaven gelten (auch vorgewählt im Aus)“, „Arp-Rate bleibt vorgewählt, nachdem die Seite ausgeblendet war“ |
| LFO Rate, Depth (Doppeltipp: 0,5 bzw. aus) | 0,1–19 Hz, Hub bis ±2 Oktaven (Cutoff) bzw. ±1 Halbton (Pitch); ohne Vorhören | Spur (Synth) › Bewegung | ✅ | `engine.test.ts` „LFO je Part: erst bei Depth > 0 angelegt, bei 0 gestoppt und verworfen, live geändert“; `next-synth-attrs.test.ts`; `synth/synth.test.ts` „LFO: Depth und Rate als Knobs mit LCD in Hz, Ziel als Segment, Part-Wechsel zeigt den anderen“, „Doppeltipp: Depth auf 0 (aus), Rate auf 0,5“ |
| LFO-Ziel Cutoff / Pitch | gilt ab der nächsten Note | Spur (Synth) › Bewegung | ✅ | `engine.test.ts` „LFO-Zielwechsel ändert den Hub schon verbundener Noten nicht; Depth 0 blendet vor dem Stopp aus“; `synth.spec.ts` „Arp und LFO setzen, bleibt nach Neuladen“ |
| Speichern | optionale Felder `arp`, `lfo` im Patch, alte Stände bytegleich, Presets lassen sie stehen | — | ✅ | `core/arp.test.ts` „Rundreise; ohne Arp/LFO keine Felder; kaputte Werte fallen weg“, „Preset laden lässt Arp und LFO stehen“; `core-persist.test.ts` |

## Sampler: Chop, Pitch und Tastatur

| Handlung | Wirkung | Ort | Stand | Test |
|---|---|---|---|---|
| Chop Aus / 2 / 4 / 8 | Pad in gleich große Slices zwischen den Griffen, Linien in der Wellenform | Spur (Sampler) › Chop | ✅ | `core/chop.test.ts`; `sampler/sampler.test.ts` „Segment setzt und löscht Chop des gewählten Pads“; `sampler.spec.ts` „Chop wählen, Pitch am Step setzen, bleibt nach Neuladen; Tastatur mit großen Zielen“ |
| Verteilen | Slices der Reihe nach auf die gesetzten Steps, mit Zurück, Meldungen ohne Chop bzw. Steps | Spur (Sampler) › Chop | ✅ | `core/chop.test.ts`; `sampler/sampler.test.ts` „Verteilen: Meldungen ohne Chop bzw. ohne Steps, sonst Slices auf die Steps (mit Zurück)“, „Chop-Meldung steht in head, nicht in der ausgeblendeten Wellenform-Seite“ |
| Pitch pro Step (− / Wert / +) | −12…+12 Halbtöne, Wert tippen setzt zurück | Spur (Sampler) › Trig › Opt | ✅ | `next-locks.test.ts`; `step-opts.test.ts` „Pitch in Halbtönen mit − / + und Zurücksetzen, Slice-Auswahl, Marke am Step; nicht bei Drums“; `sampler.spec.ts` „Chop wählen, Pitch am Step setzen, bleibt nach Neuladen; Tastatur mit großen Zielen“ |
| Slice pro Step | Auswahl Ganz / 1–8, ein k über der Slice-Zahl spielt das letzte | Spur (Sampler) › Trig › Opt | ✅ | `core/chop.test.ts`; `next-locks.test.ts`; `step-opts.test.ts` „Pitch in Halbtönen mit − / + und Zurücksetzen, Slice-Auswahl, Marke am Step; nicht bei Drums“ |
| Tastatur | zwölf Tasten spielen das Pad (C = eigene Stimmung), Oktave −1…+1 | Spur (Sampler) › Tasten | ✅ | `sampler/sampler.test.ts` „zwölf Tasten, Tipp spielt das Pad verstimmt, Oktave ±1, leeres Pad bleibt still“; `sampler.spec.ts` „Chop wählen, Pitch am Step setzen, bleibt nach Neuladen; Tastatur mit großen Zielen“ |
| Speichern | optional `sl`, `n`, `k`; alte Stände bleiben bytegleich | — | ✅ | `core/chop.test.ts` „Speicher: Rundreise, nur bei Pads, Chop am Pad, kaputte Werte fallen weg, alte Stände schlank“; `core-persist.test.ts` |

## Undo-Stapel und Tap-Tempo

| Handlung | Wirkung | Ort | Stand | Test |
|---|---|---|---|---|
| Zurück (Knopf, ⌘/Strg+Z) | bis zu 20 Schritte nacheinander, älteste fallen heraus | Display | ✅ | `store.test.ts` „mehrstufig: jeder Schritt zurück, in umgekehrter Reihenfolge, danach leer“, „Tiefe 20: der älteste Schritt fällt heraus“; `core-pattern.test.ts`; `app.spec.ts` „Tap-Tempo setzt das Tempo, mehrstufiges Zurück nimmt zwei Änderungen nacheinander zurück“ |
| Tap, Taste T | Tempo aus dem Mittel der letzten Tipps (60–200 BPM), neue Folge nach 2 s Pause, ohne Zurück | Fläche Tempo | ✅ | `core/tap.test.ts`; `frame-head.test.ts` „Tap-Knopf: erster Tipp meldet, zweiter setzt das Tempo (ohne Zurück)“; `keys.test.ts` „zwei Tipps im Takt setzen das Tempo; Wiederholung und ⌘ zählen nicht“; `app.spec.ts` „Tap-Tempo setzt das Tempo, mehrstufiges Zurück nimmt zwei Änderungen nacheinander zurück“ |

## Live-Aufnahme

| Handlung | Wirkung | Ort | Stand | Test |
|---|---|---|---|---|
| Rec | Aufnahme scharf; ein Start zählt einen Takt vor | Transport | ✅ | `ui/record.test.ts` „schaltet die Aufnahme scharf und wieder aus (aria-pressed)“; `engine.test.ts` „Stopp im Vorzähler nimmt die ausstehenden Klicks zurück“; `app.spec.ts` „Live-Aufnahme: Rec scharf, Start, Spurname tippen setzt einen Step; Zurück nimmt den Take zurück“ |
| Spurtaste, Pad im Pad-Feld, Zeilen-Beschriftung, Sampler-Pad, Tastatur, Tonname der Roll | Schlag rastet auf den nächsten Step und wird gesetzt (Overdub, Song: laufendes Pattern), beim Antippen statt beim Loslassen | Spurwahl, Pad-Feld, Step-Bereich, Spur › Tasten bzw. Noten | ✅ | `core/record.test.ts`; `ui/record.test.ts` „Spurname: nimmt den gerasteten Step auf, meldet im LCD, ein Take = ein Zurück-Schritt“, „Pads und Tastatur: Pad-Step, Tastatur mit Pitch; leeres Pad wird nicht aufgenommen“, „Notenrolle: Tonname nimmt die Note mit gewählter Länge und Part auf“; `track-select.test.ts` „Drum: bei Rec und Wiedergabe nimmt pointerdown den Schlag auf“, „Sampler-Pad im Feld nimmt einen Schlag genau einmal auf“; `engine.test.ts` „nearestStep: nächster geplanter Step, außerhalb eines Steps nichts, ohne Wiedergabe nichts“ |
| Take | alle Schläge bis Stopp = ein Zurück-Schritt | Display (Zurück) | ✅ | `store.test.ts` „Take: ein Zurück-Schritt für alle aufgenommenen Schläge, auch über mehrere Slots“; `ui/record.test.ts` „Spurname: nimmt den gerasteten Step auf, meldet im LCD, ein Take = ein Zurück-Schritt“ |

## Drive und Chorus

| Handlung | Wirkung | Ort | Stand | Test |
|---|---|---|---|---|
| Drive je Part | Sättigung, Lautheit etwa gleich; nach dem Loslassen vorhören, Doppeltipp: aus | Spur (Synth) › Klang | ✅ | `partfx.test.ts`; `next-partfx.test.ts`; `synth/synth.test.ts` „schreiben den gewählten Part, zeigen Prozent, heben das Preset auf und hören vor“, „Doppeltipp schaltet aus; Preset und Part-Wechsel bewegen die Knobs“ |
| Chorus je Part | Stereo-Breite, unter 250 Hz mittig; nach dem Loslassen vorhören, Doppeltipp: aus | Spur (Synth) › Klang | ✅ | `partfx.test.ts`; `next-partfx.test.ts`; `synth/synth.test.ts` „Doppeltipp schaltet aus; Preset und Part-Wechsel bewegen die Knobs“; `synth.spec.ts` „Drive und Chorus: setzen, Preset laden, bleibt nach Neuladen“ |
| Presets und Vorlagen | setzen Drive und Chorus passend zum Sound | Sound | ✅ | `templates.test.ts`; `synth.spec.ts` „Drive und Chorus: setzen, Preset laden, bleibt nach Neuladen“ |

## Plattenkiste: Vorlagen

| Handlung | Wirkung | Ort | Stand | Test |
|---|---|---|---|---|
| Stil wählen (Lo-Fi, Hip-Hop, Trap, House, Techno) | zeigt dessen Vorlagen; Start beim Stil der geladenen Vorlage, sonst beim ersten | Sound › Vorlagen | ✅ | `library.test.ts` „nur Genres; ohne geladene Vorlage der erste Stil mit Liste, Hinweis und Lade-Auswahl“, „Stilwechsel tauscht die Liste und räumt die alte auf“, „öffnet beim Stil der zuletzt geladenen Vorlage und markiert sie“; `mix-song.spec.ts` „Vorlagen-Browser: Stil wählen, Vorlage laden, Warm und Tape an; bleibt nach Neuladen“ |
| Vorlage tippen (21 in fünf Stilen) | laden (mit Zurück) | Sound › Vorlagen | ✅ | `library.test.ts` „lädt eine Vorlage komplett, markiert sie, meldet sie; Zurück stellt alles wieder her“, „jede Vorlage aus den Daten ist über ihren Stil erreichbar“; `templates.test.ts`; `next-templates.test.ts`; `mix-song.spec.ts` „Vorlage laden und zurück; Kopieren und Einfügen“ |
| Laden: Alles | Tempo, Swing, Tonart, Patterns A bis höchstens D, Kit, Sounds, Mixer, FX, Warm, Tape, Song; wechselt auf Pattern A. In den ersetzten Patterns werden Sampler-Steps, Pad-Sub-Steps und Pad-Step-Optionen gelöscht (bei „Drums“ bleiben sie). Mixer und FX beginnen bei den Standardwerten. Übrige Pattern-Plätze, Pads, Samples, Szenen und der Kanal Sampler bleiben | Sound › Vorlagen | ✅ | `templates.test.ts` „Alles: Tempo, Tonart, Patterns, Kit, Sounds, Mixer, FX, Klang, Song“; `library.test.ts` „Alles: Auswahl steht danach auf A“ |
| Laden: Drums | nur Drum-Spuren dieser Patterns, Kit, Tempo, Swing; ersetzt die Vorlage das offene Pattern nicht, wechselt sie auf A | Sound › Vorlagen | ✅ | `templates.test.ts`; `library.test.ts` „Drums lädt nur die Drum-Spuren und meldet das“, „Drums auf Pattern F geladen: Auswahl springt auf A, Zurück stellt F und den alten Stand her“, „Drums auf Pattern B geladen: B bleibt offen“ |
| Laden: Sound | nur Kit, Sounds, Mixer, FX, Warm, Tape (Mixer wie bei „Alles“ vom Standard aus) | Sound › Vorlagen | ✅ | `templates.test.ts` „Nur Sound: Patterns, Tempo und Song bleiben“; `library.test.ts` „Sound geladen“ |
| Hinweiszeile | die im Zustand gemerkte Vorlage des gewählten Stils: Beschreibung und BPM; sonst Anzahl und Wirkung | Sound › Vorlagen | ✅ | `library.test.ts` „nur Genres; ohne geladene Vorlage der erste Stil mit Liste, Hinweis und Lade-Auswahl“, „Sound geladen“; `mix-song.spec.ts` „Vorlagen-Browser: Stil wählen, Vorlage laden, Warm und Tape an; bleibt nach Neuladen“ |
| Markierung | die zuletzt angetippte Vorlage, bei jedem Umfang; nach dem Neuladen die im Zustand gemerkte („Sound“ merkt keine) | Sound › Vorlagen | ✅ | `library.test.ts` „Sound geladen“, „die Markierung überlebt den Stilwechsel“, „öffnet beim Stil der zuletzt geladenen Vorlage und markiert sie“; `mix-song.spec.ts` „Vorlagen-Browser: Stil wählen, Vorlage laden, Warm und Tape an; bleibt nach Neuladen“ |
| Meldung | „NAME · … BPM“, „NAME · DRUMS GELADEN“ bzw. „NUR SOUND GELADEN“ | Display | ✅ | `library.test.ts` „lädt eine Vorlage komplett, markiert sie, meldet sie; Zurück stellt alles wieder her“, „Drums lädt nur die Drum-Spuren und meldet das“, „Sound geladen“ |

## Plattenkiste: Kits

| Handlung | Wirkung | Ort | Stand | Test |
|---|---|---|---|---|
| Kit tippen (Classic, Boom, Tight, Lo-Fi, Hard, Trap) | Level, Tune, Decay aller Drum-Stimmen laden (mit Zurück) | Sound › Kits | ✅ | `library.test.ts` „lädt die Drum-Parameter mit Zurück, meldet und markiert das aktive Kit“; `templates.test.ts` |
| Markierung | nur solange alle Werte genau zum Kit passen | Sound › Kits | ✅ | `library.test.ts` „lädt die Drum-Parameter mit Zurück, meldet und markiert das aktive Kit“ |
| Meldung | „KIT NAME“ | Display | ✅ | `library.test.ts` „lädt die Drum-Parameter mit Zurück, meldet und markiert das aktive Kit“ |

## Klang: Warm und Tape

| Handlung | Wirkung | Ort | Stand | Test |
|---|---|---|---|---|
| Warm | warmer, analoger Klang an / aus, Meldung „WARM AN“ / „WARM AUS“; Drums werden neu gerendert | Mixer › FX | ✅ | `mixer/mixer.test.ts` „Warm schaltet um, Tape stellt den Wert und löscht das Feld bei 0“; `core/tone.test.ts`; `audio/tone.test.ts`; `mix-song.spec.ts` „FX: Warm und Tape ein- und ausschalten; bleibt nach Neuladen“ |
| Tape (Doppeltipp: aus) | Bandmaschine 0–100 % | Mixer › FX | ✅ | `mixer/mixer.test.ts` „Warm schaltet um, Tape stellt den Wert und löscht das Feld bei 0“; `core/tone.test.ts`; `audio/tone.test.ts` |
| Speichern | optionale Felder `warm`, `tape`; fehlen, solange aus | — | ✅ | `core/tone.test.ts`; `mix-song.spec.ts` „FX: Warm und Tape ein- und ausschalten; bleibt nach Neuladen“ |

## Regler und Umschalter (überall)

| Handlung | Wirkung | Ort | Stand | Test |
|---|---|---|---|---|
| Drehregler ziehen | Wert ändern, Meldung im Display | überall | ✅ | `knob.test.ts` „Ziehen nach oben erhöht um dy/170, kleine Wackler zählen nicht“, „ohne tag: Meldung nur mit Beschriftung“ |
| Schieberegler ziehen oder antippen | Wert an der Zeigerhöhe, Meldung im Display | Spur (Synth) › Filter, Amp; Mixer › Kanäle | ✅ | `controls-synth.test.ts` „Ziehen setzt den Wert an der Zeigerhöhe; Meldung mit Part“, „Antippen setzt den Wert an der Stelle, Doppeltipp den Standard“ |
| Doppeltipp auf einen Regler | Standardwert | überall | ✅ | `knob.test.ts` „Doppeltipp setzt den Standardwert“; `controls-synth.test.ts` „Antippen setzt den Wert an der Stelle, Doppeltipp den Standard“ |
| Pfeile, Pos1, Ende auf einem Regler | 2 % (mit Umschalt 10 %), Minimum, Maximum | überall | ✅ | `knob.test.ts` „Taste %s (Shift %s) → %f“; `controls-synth.test.ts` „Taste %s (Shift %s) → %f“ |
| Pfeile auf einem Umschalter | Option wählen (ein Tab-Stopp) | überall | ✅ | `controls.test.ts` „radiogroup mit Pfeiltasten und rovingem tabindex“ |
| Haltetasten (Stutter, Fill, Punch) | wirken, solange Zeiger, Enter oder Leertaste halten; Loslassen, Abbruch, Zeigerverlust, Fokusverlust, verstecktes Fenster, Ausblenden und Abbau lösen immer | Mixer › FX, Transport, Punch | ✅ | `mixer/mixer.test.ts` „Stutter halten: an beim Drücken, aus bei Loslassen, Abbruch und Zeigerverlust“, „Stutter per Tastatur (Leertaste/Enter halten)“, „Stutter hängt nie: Fokusverlust, verstecktes Fenster und Abbau schalten aus“; `transport.test.ts` „halten schaltet Fill an, Loslassen, Abbruch und Fokusverlust aus“; `punch/punch.test.ts` „acht Haltetasten ohne Gerät; Ausblenden löst“; `frame-controls.test.ts` „ruft off genau einmal je gehaltener Taste unter root“, „show(el,false) löst ein gehaltenes Punch-Pad“ |
