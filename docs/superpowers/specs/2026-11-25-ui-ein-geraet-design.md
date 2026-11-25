# Neue Oberfläche „Ein Gerät“ – Entwurf

Freigegeben 2026-11-25. Teilprojekt 2 von 4 (1 Chorus/Drive, 2 Oberfläche, 3 mehr Synth-Klang, 4 Szene-Sounds). Beginnt, wenn Teilprojekt 1 in `main` ist.

## Absicht

Die App bekommt immer mehr Möglichkeiten. Geplant sind viele Sounds zur Berliner Electro- und Techno-Szene und ein reicherer Synth. Die heutige Oberfläche (lange Seite, Geräte zum Aufklappen) würde dadurch unübersichtlich. Sie soll sich wie **ein Hardware-Gerät** bedienen lassen, nach dem Vorbild des Elektron Digitakt: ein fester Bildschirm, Spur wählen, Seiten mit Reglern an festen Plätzen, Steps immer an derselben Stelle.

Nutzer ist der Besitzer, Hauptgerät iPhone. Tablet und Desktop werden **gleichzeitig** umgebaut.

## Ziele

- Auf allen drei Layouts ohne Seiten-Scrollen bedienbar.
- Die Bedienung ist überall dieselbe: gleiche Modi, gleiche Seitennamen, gleiche Reglerplätze.
- Ein Regler mit gleicher Aufgabe liegt beim Spurwechsel am selben Platz.
- Presets und Vorlagen verlassen die Hauptansicht und ziehen in die **Plattenkiste**.
- **Alles, was die App heute kann, bleibt erreichbar** (Maßstab: `2026-10-14-ui-funktionsliste.md`). Häufiges in höchstens zwei Tipps.

## Nicht-Ziele

- Keine neuen Klangfunktionen und keine neuen Sounds oder Vorlagen (Teilprojekte 3 und 4).
- Kein Vorhören einer Vorlage vor dem Laden.
- Keine Pattern-Länge ungleich 16.

## Fehlschlag wäre

- Ändert sich der Klang oder ein gespeicherter Stand, ist der Umbau gescheitert, auch wenn er gut aussieht.
- Eine Funktion verschwindet oder ist nur noch umständlich erreichbar.
- Kleinere Touch-Ziele als heute, Ruckeln oder Knackser auf dem iPhone.

## Rahmen

- Design-Regeln, Schichten, Performance- und Test-Regeln aus `CLAUDE.md` gelten.
- `State` und Speicherformat bleiben unverändert. Welcher Modus und welche Seite offen sind, merkt sich nur die Oberfläche; die App startet im Modus „Spur“. `State.open` bleibt im Format, wird aber nicht mehr gebraucht.
- Referenztests (Klang, Speicherstände) bleiben unverändert grün. Der Größen-Etat in `build.spec.ts` darf bewusst angepasst werden.
- Touch-Ziele ≥ 44 px (Desktop wie bisher 32 px). Ausnahme wie heute: dichte Raster (Steps, Notenrolle, Alle Spuren).
- Tastaturbedienung, ARIA-Rollen, Fokusring; keine schweren axe-Verstöße.
- Maß fürs iPhone: ohne Scrollen ab 390 × 660 CSS-Pixel (Safari mit Leisten). Auf kleineren Bildschirmen darf nur der mittlere Bereich scrollen; Kopf, Steps und Transport bleiben stehen.

## Wege

| Weg | Gewinn | Preis |
|---|---|---|
| **Digitakt-Prinzip** (gewählt) | passt zum Step-Sequencer, wächst mit neuen Parametern | großer Umbau |
| OP-1: vier Modi, vier große Regler | sehr klar | zu wenig Platz für die Parameter |
| Nur Plattenkiste, Rest bleibt | klein | löst nur die Preset-Flut |

Gewählt: Digitakt-Prinzip **mit** Plattenkiste. iPhone: Spur per Taste (Variante A2, nicht dauerhaft sichtbare Spurtasten). Tablet und Desktop: „Mischung“ aus Gerät und Studio.

## Aufbau

Von oben nach unten:

1. **Display:** BPM, Pattern, letzte Meldung bzw. zuletzt gedrehter Regler, Oszilloskop wo Platz ist; **Zurück** und **Datei**.
2. **Modusleiste:** Spur · Sound · Mixer · Song · Punch, dazu die Pattern-Taste.
3. **Arbeitsfläche** (abhängig vom Modus).
4. **Transport:** Pattern/Song, Fill, Rec, Start/Stopp.

### Je Layout (Modus „Spur“)

| Layout | Spurwahl | Seiten | Unten |
|---|---|---|---|
| iPhone | eine Taste „BA · Bass“, öffnet alle Spuren groß; daneben vorige/nächste Spur | eine zur Zeit, Reiter | 16 Steps in zwei Reihen |
| Tablet | alle Spuren als Tasten | mehrere nebeneinander, soweit Platz; sonst Reiter | 16 Steps, umschaltbar auf „Alle Spuren“ |
| Desktop | alle Spuren als Tasten bzw. über die Raster-Beschriftung | mehrere nebeneinander | Raster „Alle Spuren“, bei Bass/Lead umschaltbar auf „Noten“ |

Telefon quer bleibt Layout „mobile“ und ordnet Seiten und Steps nebeneinander an.

### Spuren und Seiten

Spuren: die 10 Drums, Bass, Lead, Sampler. Beim Sampler wählt eine Reihe das Pad (8).

| Spur | Seiten und Inhalt |
|---|---|
| Drums | **Trig:** Sub-Steps (mit Roll, ÷2, ÷4, Leeren), Step-Optionen (Velocity, Chance, Bedingung, Locks), Spur leeren · **Klang:** Level, Tune, Decay, eigenes Sample, Original · **Mix:** Kanal-Level, Pan, Reverb-Send, Mute, Solo |
| Bass, Lead | **Noten:** Rolle, Tonart, Skala, Takthälfte, Länge, Werkzeug (Note/Akzent/Slide/Akkord), Stimme leeren · **Klang:** Wellenform, Oktave, Detune, Sub, Drive, Chorus, Delay, Level · **Filter:** Cutoff, Reso, Env, Filter-ADSR · **Amp:** Amp-ADSR · **Bewegung:** LFO, Arp · **Mix** |
| Sampler | **Trig:** wie Drums, dazu Pitch und Slice je Step · **Klang:** Wellenform mit Start/Ende, Laden, Rec, Leeren, Rev, Bounce, Tune, Attack, Decay, Level · **Chop:** Aus/2/4/8, Verteilen · **Tasten:** Tastatur mit Oktave · **Mix** |

- **Spur-Übersicht als Pad-Feld (iPhone):** Die Spurtaste zeigt alle Spuren als große Pads, beim Sampler auch die 8 Pads. Ein Tipp wählt die Spur und spielt sie an (wie heute der Spurname). Ohne Aufnahme schließt sich das Feld danach; bei scharfem **Rec** bleibt es offen, nimmt jeden Schlag auf und wird von Hand geschlossen. Transport und Display bleiben dabei sichtbar. Auf Tablet und Desktop tun das die sichtbaren Spurtasten.
- Seite **Noten** (und **Tasten**) nutzt auf dem iPhone Reglerfläche und Step-Bereich zusammen.
- Der Step-Bereich gehört zum Gerät, nicht zum Modus: Er zeigt immer die gewählte Spur und bleibt auch in Sound und Punch stehen. Mixer und Song dürfen ihn mit nutzen, wenn ihr Inhalt den Platz braucht. Bei Bass und Lead zeigt er, wo Noten liegen; ein Tipp öffnet „Noten“ an dieser Stelle.
- Auf dem Desktop liegt die Notenrolle immer unten (Umschaltung „Noten“); die Seite Noten enthält dort nur Tonart, Skala, Takthälfte, Länge, Werkzeug und Stimme leeren.
- Die Hüllkurvenanzeige bleibt auf Filter und Amp sichtbar.
- Wenn „Sub“ oder „Opt“ aktiv ist, wirkt ein Step-Tipp wie heute.

### Übrige Modi

- **Sound (Plattenkiste):** Bereiche *Synth-Sound* (Umschaltung Bass/Lead; vorgewählt ist die gewählte Spur, sonst der zuletzt gewählte Part; das Display nennt das Ziel), *Vorlagen* (erst Stil, dann Vorlage; Laden: Alles/Drums/Sound), *Basis-Muster*, *Kits*. Antippen lädt wie heute, mit Zurück; beim Synth-Sound wird vorgehört. Die Liste darf innerhalb der Arbeitsfläche scrollen. Neue Szenen müssen sich ohne Umbau ergänzen lassen. Die Hinweiszeile zur Vorlage (Beschreibung, BPM, was das Laden ersetzt) bleibt.
  - Nach dem Laden sagt das Display, was passiert ist. Bei „Drums“ springt die Auswahl auf Pattern A, falls das offene Pattern nicht betroffen ist; bei „Sound“ steht „NUR SOUND GELADEN“. Die zuletzt angetippte Vorlage ist markiert.
- **Mixer:** Seiten *Kanäle* (13 Fader, M/S, Pan, Reverb), *Szenen* (1–8, Sichern), *FX* (Reverb Size/Damp/Return, DJ-Filter, Reso, Stutter, Warm, Tape).
- **Song:** Song-Kette (anhängen, Wiederholungen, verschieben, entfernen, leeren, Wiedergabemarke).
- **Punch:** die acht Haltetasten, groß.
- **Pattern-Taste:** Slots A–H mit Inhaltspunkt, Kopieren, Einfügen, Würfeln, Pattern leeren.
- **Tipp auf BPM** im Display: Tempo, Swing, Master, Tap.

Halte-Tasten (Fill, Stutter, Punch) dürfen beim Modus- oder Seitenwechsel nie hängen bleiben.

### Desktop

- Tastaturkürzel und Hilfe „?“ wie heute. ↑/↓ wählt jetzt unter allen Spuren, nicht nur Drums.
- „Alle Spuren“ zeigt Drums, Bass, Lead und die Sampler-Pads, die Inhalt haben, mindestens das gewählte. Ein Tipp in eine Zelle wählt die Spur; bei Drums und Pads schaltet er den Step, bei Bass und Lead öffnet er „Noten“.

## Veröffentlichung

Ein Branch, in prüfbaren Schritten gebaut; live erst, wenn alle drei Layouts vollständig sind und die Funktionsliste auf die neuen Orte nachgeführt ist.

## Fertig, wenn

- Die Funktionsliste wurde **vor** dem Umbau auf den heutigen Stand gebracht (Vorlagen-Browser mit 21 Vorlagen und Lade-Umfang, Kits, Warm, Tape fehlen darin).
- Jede Zeile der Funktionsliste hat einen neuen Ort und einen Test.
- E2E auf allen fünf Geräteprofilen: kein Seiten-Scroll (Maß oben), Touch-Ziele, axe, keine Long Tasks beim Spielen.
- Klang- und Speicher-Referenztests unverändert grün.
- Der Besitzer bedient die App auf dem iPhone und findet sich zurecht.

## Dem Umsetzer überlassen

Genaue Maße und Raster, Gestaltung der Spur-Übersicht, Pattern- und Tempo-Fläche, Aufteilung der Regler auf Unterseiten, falls eine Seite voll ist, Code-Struktur der Oberfläche.

## Eigene Festlegungen (bitte prüfen)

Zurück und Datei im Display; Tempo/Swing/Master hinter dem BPM-Tipp; FX liegen im Mixer; Verhalten nach dem Laden einer Vorlage; Auswahl der Zeilen in „Alle Spuren“; Maß 390 × 660; Step-Bereich in allen Modi; Rolle am Desktop nur unten; Ziel beim Laden eines Synth-Sounds.
