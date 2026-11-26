# Berlin-Paket und Drum Drive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein Verzerrer für die Drum-Summe (Drum Drive) und ein sechster Stil „Berlin“ mit neun Vorlagen, vier Kits und zehn Synth-Sounds (Version 0.30.0).

**Architecture:** Drum Drive ist ein optionales Zustandsfeld `drumDrive` wie Tape. Der Graph hängt eine Sättigungs-Kette (neues Modul `audio/drumdrive.ts`, Muster `audio/partfx.ts`) nur bei Bedarf zwischen die zehn Drum-Panner und den Bus und baut sie nach der Ausblendung ab. Berlin ist reine Vorlagen-Daten (`core/templates/berlin.ts`).

**Tech Stack:** TypeScript, Web Audio, Vitest, node-web-audio-api, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-25-berlin-drum-drive-design.md`

## Global Constraints

- Branch `berlin-drum-drive`. Kein Merge, Push oder Artifact: erst nach der iPhone-Hörprobe und ausdrücklichem Ja.
- Node 24: jedem Befehl `source ~/.nvm/nvm.sh && nvm use >/dev/null && ` voranstellen. Der Commit-Hook prüft Lint, Typen, Unit- und Referenztests (Commit-Timeout 600000 ms).
- Keine `!`-Assertions (`must` aus `core/util.ts`); Schichtregel core → store → audio/ui → main; Abdeckung ≥ 90 % je Datei.
- `drumDrive` fehlt bei 0; alte Speicherstände und Projektdateien bleiben bytegleich.
- Bei Drum Drive 0 liegt kein zusätzlicher Knoten im Signalweg; vorhandene Referenzen (`golden/`) bleiben unverändert. Nie `npm run ref:update` für vorhandene Dateien.
- Bass, Lead, Sampler und Reverb-Send bleiben unverzerrt. Keine Knoten pro Treffer.
- UI-Texte deutsch, Hardware-Begriffe englisch; keine neuen Farben; ab 390 × 660 kein Scrollen des Dokuments, Touch-Ziele ≥ 44 px.
- Keine Künstlernamen in App, README oder Namen im Code (nur im Entwurf). Keine nachgebauten Melodien, Riffs oder Beats vorhandener Titel.
- Die 21 vorhandenen Vorlagen, Kits, Sounds und `SYN_PRESETS` bleiben unverändert.
- Tests zuerst (rot sehen), dann Code. Neue Bedienhandlungen bekommen eine Zeile in `docs/superpowers/specs/2026-10-14-ui-funktionsliste.md` mit Ort und Test.
- Commit-Nachrichten enden mit `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Drum Drive während der Wiedergabe schnell aus und wieder an (innerhalb von 100 ms): Die Drums dürfen weder verstummen noch doppelt anliegen (Task 2).
2. Speicherstand oder Projektdatei mit `drumDrive` als Text, negativ, über 1 oder ganz ohne Feld: geladen wird ein gültiger Wert oder kein Feld (Task 1).
3. Der Knob knapp über 0: kein hörbarer Lautheitssprung (Task 2).
4. Drum Drive voll bei dichtem Demo-Song: keine Übersteuerung; Bass, Lead und Sampler klingen wie ohne (Task 2).
5. Eine Vorlage ohne Drive nach einer mit Drive laden, auch nur „Drums“: Der Wert verschwindet, Zurück holt ihn wieder (Task 4 und 5).

---

### Task 1: Zustandsfeld `drumDrive`

**Files:**
- Modify: `src/core/types.ts` (`State`, bei `tape`), `src/core/tone.ts`, `src/core/persist.ts` (Laden bei `'tape' in src`, `serialize`)
- Test: `src/core/tone.test.ts`

**Interfaces:**
- Produces: `State.drumDrive?: number` (0..1, fehlt = aus); `setDrumDrive(s: State, v: number): State` in `core/tone.ts`. `Tone`, `toneOf`, `sameTone` bleiben unverändert.

- [ ] **Step 1: Tests in `tone.test.ts` ergänzen**

```ts
describe('Drum Drive im Zustand', () => {
  it('setzt, begrenzt und löscht das Feld bei 0', () => {
    expect(setDrumDrive(initialState(), 0.4).drumDrive).toBe(0.4);
    expect(setDrumDrive(initialState(), 3).drumDrive).toBe(1);
    expect('drumDrive' in setDrumDrive(setDrumDrive(initialState(), 0.4), 0)).toBe(false);
    expect('drumDrive' in setDrumDrive(initialState(), -1)).toBe(false);
    expect('drumDrive' in serialize(initialState())).toBe(false);
  });

  it('übersteht Speichern und Laden, auch in der Projektdatei', () => {
    const on = setDrumDrive(initialState(), 0.6);
    expect(loadState(JSON.parse(JSON.stringify(serialize(on))), initialState()).drumDrive).toBe(0.6);
    const file = decodeProject(encodeProject({ state: on, pads: [], drums: {} }, new Date(0)));
    expect('state' in file && file.state.drumDrive).toBe(0.6);
  });

  it('verwirft Unsinn beim Laden; ohne Feld bleibt die Basis', () => {
    for (const bad of ['x', -1, 0, Number.NaN, null])
      expect('drumDrive' in loadState({ drumDrive: bad }, initialState())).toBe(false);
    expect(loadState({ drumDrive: 5 }, initialState()).drumDrive).toBe(1);
    const base = setDrumDrive(initialState(), 0.3);
    expect(loadState({}, base).drumDrive).toBe(0.3);
    expect('drumDrive' in loadState({ drumDrive: 0 }, base)).toBe(false);
  });
});
```

- [ ] **Step 2:** `npx vitest run --project unit src/core/tone.test.ts` → FAIL (`setDrumDrive` fehlt).
- [ ] **Step 3:** Feld, Funktion und Persistenz wie bei `tape` umsetzen; in `serialize` hinter `tape`.
- [ ] **Step 4:** Derselbe Befehl → PASS.
- [ ] **Step 5:** Commit `core: Drum Drive im Zustand`.

---

### Task 2: Verzerrer im Graphen und in der Engine

**Files:**
- Create: `src/audio/drumdrive.ts`, `src/audio/drumdrive.test.ts`, `tests/reference/next-drumdrive.test.ts`, `tests/reference/golden/bench/drive.json` (erzeugt)
- Modify: `src/audio/partfx.ts` (`level` exportieren), `src/audio/graph.ts`, `src/audio/engine.ts` (`watchLive`, Muster Drive/Chorus), `tests/reference/next/scenarios.ts`, `tests/reference/bench.test.ts`

**Interfaces:**
- Consumes: `State.drumDrive`, `setDrumDrive` (Task 1).
- Produces:
  - `createDrumDrive(ctx: BaseAudioContext, sources: readonly AudioNode[], output: AudioNode): DrumDrive` mit `set(v: number, t: number | null): void`, `readonly idle: boolean`, `dispose(): void`.
  - `Graph.setDrumDrive(v: number, t: number | null): boolean` (true: aus, Kette darf nach der Blende weg), `Graph.releaseDrumDrive(): void` (baut nur ab, wenn weiterhin aus).
  - Szenario `drumDriveProbe(args: { drive: number; mute: 'none' | 'drums' | 'rest' }): Promise<{ peak: number; rmsDb: number; brightness: number }>`: Demo-Song über `renderOffline`, 5 s, Seed 1; `'rest'` stellt BA, LD und SM stumm, `'drums'` die zehn Drum-Kanäle. `brightness` wie in `partFx`.

**Aufbau der Kette** (aus den Tests nicht ableitbar):

```text
Drum-Panner (10) → sum ─┬─ dry ───────────────→ Bus
                        └─ pre → shaper → post → Bus
shaper: softClipCurve(4, false), oversample '2x'
g = 1 + v·11;  pre = 0.35·g / 4;  post = 1 / (0.35 · g^0.6);  dry = 0
v = 0:         post → 0, dry → 1   (Blende 30 ms, `level` aus partfx.ts)
Aufbau:        erst jede Quelle an sum, dann ihre Verbindung zum Bus lösen; post startet bei 0
dispose:       erst jede Quelle an den Bus, dann von sum lösen; alle eigenen Knoten trennen
```

Bei kleinem g ist die Kennlinie praktisch linear (kein Sprung am Anfang). Die drei Zahlen 11, 0.35 und 0.6 dürfen nachgestimmt werden, bis die Referenztests passen; die Testgrenzen nicht.

- [ ] **Step 1: Unit-Tests in `drumdrive.test.ts`** (Helfer `fakeContext`, `made` wie in `partfx.test.ts`)

Testfälle und Zusicherungen:
- `'bei 0 entsteht nichts'`: Graph aus `baseState()` und `setDrumDrive(0, 0)` → `createWaveShaper` genauso oft wie ohne Aufruf, Rückgabe `false`.
- `'ein: ein WaveShaper für alle zehn Drums, BA, LD und SM bleiben am Bus'`: nach `setDrumDrive(0.5, 1)` genau ein neuer Shaper mit `oversample === '2x'`; alle zehn `chan[id].pan` haben `sum` als Ziel und `disconnect` mit `bus`; für `BA`, `LD`, `SM` kein `disconnect` mit `bus`.
- `'Drehen legt keine neuen Knoten an'`: zweites `setDrumDrive(0.9, 2)` → Zahl der Gains und Shaper unverändert.
- `'aus: true, nach release hängen die Panner wieder am Bus'`: `setDrumDrive(0, 3) === true`; `releaseDrumDrive()` → jeder Drum-Panner `connect(bus)` und `disconnect(sum)`; erneutes `setDrumDrive(0.5, 4)` legt eine neue Kette an.
- `'schnell aus und wieder an: release baut nichts ab'`: `set(0.5)`, `set(0)`, `set(0.5)`, `releaseDrumDrive()` → kein weiteres `connect(bus)` oder `disconnect` an den Pannern.
- `'Anfangszustand direkt'`: `createGraph` mit `setDrumDrive(baseState(), 1)` → ein Shaper, ohne `linearRampToValueAtTime` an den Gains der Kette.
- `'Engine: Regler live, Abbau nach 100 ms'` (fake timers, wie in `tone.test.ts`): `store.update` auf 0.5 → ein Shaper; auf 0, `advanceTimersByTimeAsync(100)` → Panner wieder am Bus; `dispose` mit offenem Zeitgeber wirft nicht.

- [ ] **Step 2: Referenztest `next-drumdrive.test.ts`**

```ts
const probe = (drive: number, mute: 'none' | 'drums' | 'rest') =>
  runNext<DriveProbe>('drumDriveProbe', { drive, mute });

describe.concurrent('Drum Drive', () => {
  it('Drums: knapp über 0 kein Sprung, voll lauter in den Obertönen, Pegel etwa gleich', async ({ expect }) => {
    const [dry, hint, half, full] = await Promise.all([0, 0.02, 0.5, 1].map((d) => probe(d, 'rest')));
    // (Werte mit must() auspacken)
    expect(Math.abs(hint.rmsDb - dry.rmsDb)).toBeLessThan(1);
    for (const r of [half, full]) {
      expect(Math.abs(r.rmsDb - dry.rmsDb)).toBeLessThanOrEqual(3);
      expect(r.peak).toBeLessThanOrEqual(0.8);
    }
    expect(full.brightness).toBeGreaterThan(dry.brightness * 1.1);
  });

  it('Bass, Lead und Sampler klingen mit und ohne gleich', async ({ expect }) => {
    const [dry, full] = await Promise.all([probe(0, 'drums'), probe(1, 'drums')]);
    expect(full.peak).toBeCloseTo(dry.peak, 4);
    expect(full.rmsDb).toBeCloseTo(dry.rmsDb, 3);
  });

  it('ganzer Demo-Song voll aufgedreht übersteuert nicht', async ({ expect }) => {
    expect((await probe(1, 'none')).peak).toBeLessThanOrEqual(0.8);
  });
});
```

- [ ] **Step 3: Bench-Test.** `bench` nimmt zusätzlich `load: 'drive'` (Demo mit `drumDrive = 1`). In `bench.test.ts` nur für die neue Engine: `nodesPerSecond` ≤ Wert aus `bench/demo`, `renderMs` ≤ `readGolden('bench/drive', r).renderMs * RENDER_SLACK`. `bench/demo` dabei nur lesen, nie über `readGolden` mit anderem Ergebnis aufrufen.
- [ ] **Step 4:** `npx vitest run --project unit src/audio/drumdrive.test.ts` → FAIL (Modul fehlt).
- [ ] **Step 5:** Modul, Graph (`setDrumDrive(s.drumDrive ?? 0, null)` beim Aufbau, Quellen = `VOICE_IDS.map((id) => chan[id].pan)`), Engine-Effekt mit Abbau-Zeitgeber (100 ms, in `disposers` abräumen) und Szenario umsetzen.
- [ ] **Step 6:** `npx vitest run --project unit src/audio` → PASS; `npm run test:ref` → PASS, `git status` zeigt keine geänderte Datei unter `golden/`.
- [ ] **Step 7:** `REF_UPDATE=1 npx vitest run --project bench -t "Drum Drive"`, danach `npm run bench` → PASS; nur `golden/bench/drive.json` neu.
- [ ] **Step 8:** Commit `audio: Drum Drive`.

---

### Task 3: Knob im Mixer

**Files:**
- Modify: `src/ui/panels/mixer/fx.ts` (`.tone-row`, hinter Tape), bei Bedarf `mixer.css`; Funktionsliste (Abschnitt „Klang“ heißt dann „Klang: Warm, Tape und Drum Drive“)
- Test: `src/ui/panels/mixer/mixer.test.ts`, `tests/e2e/mix-song.spec.ts`

**Interfaces:**
- Consumes: `setDrumDrive` (Task 1).
- Produces: Slider mit Namen `Drum Drive`, ohne `tag` (Meldung „Drum Drive 40%“, das Display schreibt groß).

- [ ] **Step 1: Tests.** Unit `'Drum Drive stellt den Wert, meldet ihn und löscht das Feld bei 0'`: `End` → `drumDrive === 1`, Meldung `'Drum Drive 100%'`; `Home` → Feld fehlt; `End`, Doppeltipp → Feld fehlt. E2E `'FX: Drum Drive einstellen; bleibt nach Neuladen'`: Slider `aria-valuenow` 0, `End` → 100, `.lcd-sub` „Drum Drive 100%“, gespeichert `1`; Neuladen → 100; `Home` → `'drumDrive' in saved` ist `false`.
- [ ] **Step 2:** `npx vitest run --project ui src/ui/panels/mixer` → FAIL.
- [ ] **Step 3:** Knob umsetzen (`label: 'Drum Drive'`, `def: () => 0`, `format: pct`).
- [ ] **Step 4:** Unit → PASS; `npx playwright test mix-song fit a11y` → PASS auf allen Projekten (Passform auf der FX-Seite).
- [ ] **Step 5:** Mit der Browser-Vorschau bei 390 × 660 die FX-Seite ansehen: drei Elemente in einer Reihe, Beschriftung ungekürzt.
- [ ] **Step 6:** Funktionsliste ergänzen (Zeile „Drum Drive (Doppeltipp: aus)“, Speichern-Zeile um `drumDrive`), Commit `ui: Knob Drum Drive`.

---

### Task 4: Vorlagen-Feld, Kits und Synth-Sounds

**Files:**
- Modify: `src/core/templates/types.ts` (`Template`), `apply.ts`, `kits.ts`, `sounds.ts`; Funktionsliste (Zeilen „Laden: …“ und „Kit tippen“)
- Test: `src/core/templates/templates.test.ts`

**Interfaces:**
- Consumes: `setDrumDrive` (Task 1).
- Produces: `Template.drumDrive?: number`; Kits `Electro`, `Break`, `Draht`, `Beton`; Bass-Sounds `Kreissäge`, `Roboter`, `Wummer`, `Knurr`, `Beton`; Lead-Sounds `Neon`, `Orgel`, `Sirene`, `Glas`, `Zerre`.

**Kits** (hinter `Trap`, nur Level, Tune, Decay):

| Name | `hint` | Richtung |
|---|---|---|
| Electro | kurz, knackig, trocken | Decays 0.2–0.35, Tune um 0.55 |
| Break | volle Snare, lockere Hats | Snare Decay ≥ 0.55, CH/OH länger |
| Draht | dünn und hell | Tune ≥ 0.65, Kick kurz, Level der Kick ≤ 0.8 |
| Beton | schwere Kick, harte Snare | BD Level 1, Tune ≤ 0.45, SD Tune ≥ 0.6 |

**Sounds** (hinten an `BASS` bzw. `LEAD`; Drive/Chorus exakt so, übrige Werte nach Charakter aus dem Entwurf):

| Part | Name | `wave` | Drive | Chorus |
|---|---|---|---|---|
| BA | Kreissäge | 0 | 0.55 | 0.15 |
| BA | Roboter | 1 | 0.3 | 0 |
| BA | Wummer | 3 | 0.2 | 0 |
| BA | Knurr | 0 | 0.65 | 0 |
| BA | Beton | 1 | 0.45 | 0 |
| LD | Neon | 1 | 0.15 | 0.2 |
| LD | Orgel | 2 | 0.1 | 0.65 |
| LD | Sirene | 0 | 0.25 | 0.3 |
| LD | Glas | 2 | 0 | 0.35 |
| LD | Zerre | 0 | 0.7 | 0.2 |

„Sirene gleitend“: Presets tragen keinen LFO; das Gleiten kommt aus langsamem Filter-Attack (`fa` ≥ 0.4) bei hoher Resonanz.

- [ ] **Step 1: Tests.** Tabelle in `'Sounds: Drive und Chorus je Preset…'` um die zehn Zeilen erweitern. Dazu:

```ts
it('neue Kits und Sounds: vorhanden, mit der Wellenform ihres Charakters, keine Dublette', () => {
  expect(KITS.slice(6).map((k) => k.name)).toEqual(['Electro', 'Break', 'Draht', 'Beton']);
  for (const part of ['BA', 'LD'] as const) {
    const list = SYNTH_SOUNDS[part];
    expect(new Set(list.map((p) => JSON.stringify(p.v))).size).toBe(list.length);
  }
  expect(SYNTH_SOUNDS.BA.slice(-5).map((p) => [p.name, p.v.wave])).toEqual([
    ['Kreissäge', 0], ['Roboter', 1], ['Wummer', 3], ['Knurr', 0], ['Beton', 1],
  ]);
  expect(SYNTH_SOUNDS.LD.slice(-5).map((p) => [p.name, p.v.wave])).toEqual([
    ['Neon', 1], ['Orgel', 2], ['Sirene', 0], ['Glas', 2], ['Zerre', 0],
  ]);
});

it('Drum Drive: jede Lade-Art setzt oder löscht ihn', () => {
  const driven: Template = { ...first, drumDrive: 0.45 };
  for (const scope of ['all', 'drums', 'sound'] as const) {
    const on = applyTemplate(initialState(), driven, scope);
    expect(on.drumDrive).toBe(0.45);
    expect('drumDrive' in applyTemplate(on, first, scope)).toBe(false);
  }
  const on = applyTemplate(initialState(), driven, 'all');
  expect(applyKit(on, kitByName('Beton')).drumDrive).toBe(0.45);
});
```

- [ ] **Step 2:** `npx vitest run --project unit src/core/templates` → FAIL.
- [ ] **Step 3:** Feld, `apply.ts`, Kits, Sounds und `FX`-Tabelle umsetzen.
- [ ] **Step 4:** `npx vitest run --project unit --project ui` → PASS (Listen-Tests der Plattenkiste mitziehen, falls sie die Kit- oder Sound-Namen aufzählen).
- [ ] **Step 5:** Funktionsliste: „Alles“, „Drums“, „Sound“ um Drum Drive, Kit-Zeile um die vier Namen. Commit `core: Kits, Synth-Sounds und Drum Drive in Vorlagen`.

---

### Task 5: Stil Berlin mit neun Vorlagen

**Files:**
- Create: `src/core/templates/berlin.ts` (`export const BERLIN: readonly Template[]`)
- Modify: `types.ts` (`Genre` um `'berlin'`, `GENRES` am Ende `{ id: 'berlin', name: 'Berlin' }`), `index.ts` (`...BERLIN` zuletzt); Funktionsliste
- Test: `templates.test.ts`, `src/ui/panels/library.test.ts`, `tests/e2e/mix-song.spec.ts`

**Interfaces:**
- Consumes: Feld, Kits und Sounds aus Task 4.

**Eckdaten** (`id` = `berlin-` + Name klein, `ö` → `oe`; `tape` 0, außer genannt):

| Name | `hint` | BPM | Swing | Key / Skala | Kit | Bass / Lead | Drive | Warm |
|---|---|---|---|---|---|---|---|---|
| Kajal | kühle, trockene Drums, stoischer Bass, sparsamer Lead | 124 | 0 | 9 / 0 | Electro | Roboter / Neon | – | nein |
| Königin | sägender Bass und eine Pop-Hook | 128 | 0 | 4 / 0 | Electro | Kreissäge / Neon | 0.25 | nein |
| Westwerk | gebrochene Kick, harte Snare, Stabs im Hall | 135 | 0 | 1 / 3 | Beton | Beton / Zerre | 0.45 | nein |
| Breitwand | dicke Breaks, Acid-Linie und Roll-Aufbau | 126 | 0.2 | 7 / 4 | Break | Acid / Sirene | 0.45 | ja |
| Zimmerlinde | verspielt und klein, mit einem Motiv zum Mitsummen | 118 | 0.15 | 0 / 5 | Draht | Rubber / Pulse | – | ja |
| Ostkreuz | gerader Puls, breite Akkorde, große Melodie | 128 | 0 | 5 / 0 | Tight | Deep / Orgel | – | ja |
| Spreeufer | zerschnittene Beats unter einer wehmütigen Melodie | 126 | 0.1 | 2 / 2 | Break | Pluck / Glas | – | ja, `tape` 0.15 |
| Presslufthalle | verzerrter Punk-Techno, der stampft und schwingt | 132 | 0.35 | 4 / 3 | Beton | Knurr / Zerre | 0.8 | nein |
| Tiefgang | schwerer Bass, gebrochener Beat, Echo wie im Keller | 130 | 0.1 | 8 / 0 | Break | Wummer / Sirene | 0.2 | ja |

**Rhythmus-Kern von Pattern A** (BD-Zeile exakt; alles andere frei):

| Vorlage | BD | Dazu |
|---|---|---|
| Kajal | `x...x...x...x...` | Bass durchgehend in Achteln auf einem Ton, Lead höchstens vier Noten |
| Königin | `x...x...x...x..x` | Hook im Lead mit mindestens fünf Noten |
| Westwerk | `x..x..x...x.x...` | Stabs mit Akkord `T`, viel Reverb-Send auf LD |
| Breitwand | `x.x.......xx....` | Bass mit Akzent und Slide; ein Pattern baut mit `r`, `t`, `R` auf |
| Zimmerlinde | `x.......x.x.....` | wenige Spuren: höchstens fünf Drum-Zeilen |
| Ostkreuz | `x...x...x...x..o` | Akkorde im Lead, Offbeat-Hat |
| Spreeufer | `x.....x..x......` | Sub-Steps und Chancen in den Hats |
| Presslufthalle | `x...x...x...x.x.` | Clap und Snare zusammen |
| Tiefgang | `x..x......x..x..` | Snare auf Step 5 und 13, Delay auf LD |

Je Vorlage drei bis vier Patterns A–D und eine Song-Kette; `mix` und `fx` frei. Melodien und Beats selbst erfinden.

- [ ] **Step 1: Tests.** In `templates.test.ts`: `TEMPO.berlin = [115, 140]`; Katalog-Test auf 30 Vorlagen, 30 eindeutige `id` und Namen. Dazu:

```ts
const BERLIN_A: Record<string, [number, number | undefined, string]> = {
  // id: [BPM, Drum Drive, BD-Zeile in A]
  'berlin-kajal': [124, undefined, 'x...x...x...x...'],
  'berlin-koenigin': [128, 0.25, 'x...x...x...x..x'],
  'berlin-westwerk': [135, 0.45, 'x..x..x...x.x...'],
  'berlin-breitwand': [126, 0.45, 'x.x.......xx....'],
  'berlin-zimmerlinde': [118, undefined, 'x.......x.x.....'],
  'berlin-ostkreuz': [128, undefined, 'x...x...x...x..o'],
  'berlin-spreeufer': [126, undefined, 'x.....x..x......'],
  'berlin-presslufthalle': [132, 0.8, 'x...x...x...x.x.'],
  'berlin-tiefgang': [130, 0.2, 'x..x......x..x..'],
};

it('Berlin: neun Vorlagen mit Tempo, Drive und Rhythmus aus dem Entwurf', () => {
  expect(templatesOf('berlin').map((t) => t.id)).toEqual(Object.keys(BERLIN_A));
  for (const t of templatesOf('berlin'))
    expect([t.tempo, t.drumDrive, t.pat.A.d.BD]).toEqual(BERLIN_A[t.id]);
});

it('Berlin: jedes neue Kit und jeder neue Sound kommt vor', () => {
  const list = templatesOf('berlin');
  for (const kit of ['Electro', 'Break', 'Draht', 'Beton'])
    expect(list.some((t) => t.kit === kit)).toBe(true);
  for (const part of ['BA', 'LD'] as const)
    for (const s of SYNTH_SOUNDS[part].slice(-5))
      expect(list.some((t) => t.sound[part].p === s.name)).toBe(true);
});

it('kein Haupt-Groove gleicht dem einer anderen Vorlage', () => {
  const grooves = TEMPLATES.map((t) => JSON.stringify(t.pat.A.d));
  expect(new Set(grooves).size).toBe(TEMPLATES.length);
});
```

In `library.test.ts` die Stil-Liste um `'Berlin'` erweitern. E2E `'Stil Berlin: Vorlage laden setzt Drum Drive; eine ohne löscht ihn; Zurück'`: Stil „Berlin“, „Westwerk“ → gespeichert `tempo` 135, `drumDrive` 0.45; Lade-Umfang „Drums“, „Kajal“ → Feld fehlt; „Zurück“ → 0.45.

- [ ] **Step 2:** `npx vitest run --project unit src/core/templates` → FAIL.
- [ ] **Step 3:** Genre und `berlin.ts` umsetzen.
- [ ] **Step 4:** `npx vitest run --project unit --project ui` → PASS.
- [ ] **Step 5:** `npm run test:ref` → PASS; alle 30 Vorlagen innerhalb der Pegelgrenzen. Fällt eine heraus, Mixer, Kit oder Drive dieser Vorlage nachstimmen, nie die Grenzen.
- [ ] **Step 6:** `npx playwright test mix-song fit` → PASS (sechs Stil-Chips passen bei 390 × 660).
- [ ] **Step 7:** Funktionsliste (Stil-Zeile um Berlin, „30 in sechs Stilen“, neuer E2E-Test). Commit `core: Stil Berlin mit neun Vorlagen`.

---

### Task 6: Version, Doku, Gesamtprüfung

**Files:**
- Modify: `package.json`, `package-lock.json`, `src/core/constants.ts` (`APP_VERSION`), `README.md`, `CLAUDE.md`, Entwurf (Statuszeile)

- [ ] **Step 1:** Version `0.30.0` (`npm version 0.30.0 --no-git-tag-version`, `APP_VERSION` gleich).
- [ ] **Step 2:** README: Drum Drive und Stil Berlin in den Funktionen, „30 Vorlagen in sechs Stilen“, Kits und Sounds, Signalweg in der Architektur, Roadmap, Stand „0.30.0 auf Branch, noch nicht live“. CLAUDE.md: Absätze „Vorlagen“ (`berlin.ts`, `drumDrive`) und „Klangcharakter“ (Drum Drive: Feld, Modul, Abbau), Roadmap.
- [ ] **Step 3:** `npm run lint && npm run typecheck && npm test` → alles grün. Testzahlen aus dieser Ausgabe in die README eintragen.
- [ ] **Step 4:** `npm run build`; `dist/index.html` ≤ 227 500 B (Prüfung in `build.spec.ts`; bei Überschreitung Budget mit Begründung im Kommentar auf Ist + 10 % setzen).
- [ ] **Step 5:** Suche nach Künstlernamen in `src`, `tests`, `README.md`, `CLAUDE.md` → keine Treffer.
- [ ] **Step 6:** Commit `docs: Version 0.30.0, Berlin-Paket und Drum Drive`.

## Danach (nicht Teil des Plans)

Hörprobe auf dem iPhone (wie die Vorschau aufs Gerät kommt, mit dem Besitzer abstimmen), Korrekturen nach Gehör, dann Merge, Push und Artifact nur nach ausdrücklichem Ja.
