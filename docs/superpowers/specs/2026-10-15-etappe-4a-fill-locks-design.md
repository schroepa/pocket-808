# Etappe 4a: Fill-Taste und Parameter-Locks – Spezifikation

Stand: 2026-10-15. Erster Teil der Etappe „Performance“, die der Besitzer gewählt hat (Teenage-Engineering-Ideen). Der Auftrag lautet „ohne Rückfragen“, deshalb sind die Entscheidungen hier begründet.

## Ziel

- **Fill:** Eine Taste gedrückt halten, und das Pattern spielt seine Fill-Variante, wie bei OP-XY und Elektron.
- **Parameter-Locks:** Einzelne Steps klingen anders als der Rest der Spur, etwa eine höher gestimmte Snare oder eine kurze Hat, wie bei OP-Z und OP-XY.

## Fill

- **Bedingungen:** Zwei neue Werte kommen dazu, „Fill“ und „Nicht Fill“ (`fill`, `notFill`). Sie stehen in der Liste nach „Nicht erster“.
  - „Fill“ spielt nur, solange Fill gehalten wird.
  - „Nicht Fill“ spielt nur, wenn Fill nicht gehalten wird.
  - Alle anderen Bedingungen gelten unabhängig von Fill.
- **Taste:**
  - „Fill“ steht in der Transportleiste. Sie gilt, solange sie gehalten wird. Loslassen, Abbruch, Zeigerverlust oder Fokusverlust heben Fill auf, wie beim Stutter.
  - Auf dem Desktop wirkt zusätzlich die gehaltene Taste **F**.
- **Engine:** `setFill(on)`. Fill wirkt auf das Planen: Steps, die im Vorlauf (0,2 s) schon geplant sind, bleiben.
- **Export:** Fill ist aus. Gerendert wird der Normalfall.

## Parameter-Locks

- **Drums:** **Tune** und **Decay** pro Step.
  - Ein gelockter Step spielt eine eigene, offline vorgerenderte Variante der Stimme.
  - Die Varianten werden vorab gerendert, sobald ein Lock gesetzt ist. Sie laufen über dieselbe Warteschlange, nie parallel.
  - Werte werden auf 1/100 gerundet. Höchstens 64 Varianten bleiben im Cache, die älteste fällt heraus.
  - Solange eine Variante noch rendert, spielt der normale Klang.
  - Eigene Drum-Samples rechnen Tune und Decay ohnehin live, dort wirkt der Lock direkt.
- **Sampler-Pads:** **Tune**, **Decay** und **Start** pro Step. Das ist der Chop-Gedanke wie beim EP-133. Alle drei werden beim Treffer live gerechnet. Start bleibt mindestens 0,02 vor dem Ende.
- **Kein Pan-Lock.** Pan liegt im Kanalzug. Ein Lock bräuchte einen zusätzlichen Panner pro Treffer, das widerspricht der Performance-Regel.
- **Keine Bewegungsaufnahme** (Knöpfe drehen während der Wiedergabe). Das kommt später in der Live-Aufnahme (Roadmap 8).
- **Speicher:** `StepOpt` bekommt `t` (Tune), `d` (Decay) und `s` (Start, nur Pads), jeweils 0..1.
  - Ist ein Feld vorhanden, ist der Step gelockt, auch wenn der Wert zufällig dem Spurwert entspricht.
  - `loadState` prüft und begrenzt die Werte. `s` wird nur bei Pads gelesen.
- **Bedienung:**
  - Im Opt-Feld gibt es eine Zeile **„Lock“** mit den Knobs Tune und Decay (bei Pads zusätzlich Start).
  - Ohne Lock zeigen sie den Spurwert. Drehen setzt den Lock.
  - Ein gelockter Knob trägt die Klasse `locked` (Beschriftung im Akzent).
  - Der Chip **„Locks lösen“** entfernt alle Locks des Steps (mit Zurück).
  - Gelockte Steps tragen dieselbe Marke wie Chance und Bedingung.

## Tests

- **core:** Bedingungen mit Fill, Lock-Felder normalisieren, speichern und lesen (auch kaputte), `s` bei Drums verworfen.
- **Referenz:**
  - Ein Tune-Lock spielt eine andere Buffer-Variante als der Normalschlag. Der nächste Normalschlag nutzt wieder den Normal-Buffer.
  - Ein Pad-Lock ändert die Abspielrate.
  - Fill: Ein Step mit „Fill“ spielt nur, solange Fill an ist, und „Nicht Fill“ umgekehrt.
- **UI:**
  - Fill-Taste: halten und loslassen, Abbruch, Fokusverlust, Taste F auf dem Desktop.
  - Lock-Knobs: Spurwert ohne Lock, setzen, Klasse `locked`, „Locks lösen“.
  - Start-Knob nur bei Pads.
- **E2E:**
  - Fill-Taste vorhanden und im Fenster, Touch-Ziel.
  - Lock setzen, bleibt nach dem Neuladen.
  - axe.
