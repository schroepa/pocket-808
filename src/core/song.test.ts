import { describe, expect, it } from 'vitest';
import { baseState } from './defaults.ts';
import {
  appendToSong,
  bumpRepeat,
  clearSong,
  moveEntry,
  nextBar,
  removeEntry,
  SONG_MAX,
  songStart,
  type SongCursor,
} from './song.ts';
import { deepFreeze } from './test-utils.ts';
import { stepDuration, subStepOffset, swingDelay } from './timing.ts';
import type { SongEntry, State } from './types.ts';

const withSong = (song: SongEntry[], extra: Partial<State> = {}): State =>
  deepFreeze({ ...baseState(), song, ...extra });

describe('Song bearbeiten', () => {
  it('hängt das aktuelle Pattern an, höchstens 32 Einträge', () => {
    expect(appendToSong(withSong([], { cur: 'C' })).song).toEqual([{ p: 'C', n: 1 }]);
    const full = withSong(new Array<SongEntry>(SONG_MAX).fill({ p: 'A', n: 1 }));
    expect(appendToSong(full)).toBe(full);
  });
  it('Wiederholungen 1…16, verschieben, entfernen, leeren', () => {
    const s = withSong([
      { p: 'A', n: 1 },
      { p: 'B', n: 16 },
    ]);
    expect(bumpRepeat(s, 0, -1).song[0]!.n).toBe(1);
    expect(bumpRepeat(s, 1, 1).song[1]!.n).toBe(16);
    expect(bumpRepeat(s, 0, 3).song[0]!.n).toBe(4);
    expect(bumpRepeat(s, 5, 1)).toBe(s);
    expect(moveEntry(s, 0, 1).song.map((e) => e.p)).toEqual(['B', 'A']);
    expect(moveEntry(s, 0, -1)).toBe(s);
    expect(moveEntry(s, 1, 1)).toBe(s);
    expect(moveEntry(s, -1, 1)).toBe(s);
    expect(removeEntry(s, 0).song).toEqual([{ p: 'B', n: 16 }]);
    expect(removeEntry(s, -1)).toBe(s);
    expect(removeEntry(s, 2)).toBe(s);
    expect(clearSong(s).song).toEqual([]);
  });
});

describe('nextBar', () => {
  const run = (s: Pick<State, 'mode' | 'song' | 'cur'>, bars: number) => {
    let c: SongCursor = songStart();
    const out: string[] = [];
    for (let i = 0; i < bars; i++) {
      const r = nextBar(c, s);
      c = r.cursor;
      out.push(r.fromSong ? r.slot : `(${r.slot})`);
    }
    return out.join('');
  };
  it('spielt Einträge mit Wiederholungen und beginnt am Ende von vorn', () => {
    expect(
      run(
        {
          mode: 'song',
          cur: 'A',
          song: [
            { p: 'A', n: 2 },
            { p: 'C', n: 1 },
          ],
        },
        7,
      ),
    ).toBe('AACAACA');
  });
  it('Pattern-Modus oder leerer Song spielen das aktuelle Pattern', () => {
    expect(run({ mode: 'pattern', cur: 'B', song: [{ p: 'A', n: 1 }] }, 2)).toBe('(B)(B)');
    expect(run({ mode: 'song', cur: 'D', song: [] }, 2)).toBe('(D)(D)');
  });
  it('nach einem Takt im Pattern-Modus beginnt der Song wieder von vorn', () => {
    const song: SongEntry[] = [
      { p: 'A', n: 1 },
      { p: 'B', n: 3 },
    ];
    let c = nextBar(songStart(), { mode: 'song', cur: 'C', song }).cursor;
    c = nextBar(c, { mode: 'song', cur: 'C', song }).cursor;
    expect(c.index).toBe(1);
    c = nextBar(c, { mode: 'pattern', cur: 'C', song }).cursor;
    expect(nextBar(c, { mode: 'song', cur: 'C', song }).slot).toBe('A');
  });
  it('fängt einen hinter das Ende gerutschten Index ab', () => {
    const r = nextBar(
      { first: false, index: 5, repeat: 0 },
      { mode: 'song', cur: 'A', song: [{ p: 'B', n: 1 }] },
    );
    expect(r).toEqual({ cursor: { first: false, index: 0, repeat: 0 }, slot: 'B', fromSong: true });
  });
});

describe('Timing', () => {
  it('Step-Dauer, Swing auf ungeraden Steps, Sub-Step-Versatz', () => {
    expect(stepDuration(120)).toBe(0.125);
    expect(swingDelay(0, 0.5, 0.125)).toBe(0);
    expect(swingDelay(1, 0.5, 0.125)).toBeCloseTo(0.025);
    expect(subStepOffset(8, 0.125)).toBe(0.0625);
  });
});
