import { describe, expect, it, vi } from 'vitest';
import { connectHost, hostState } from './host.ts';

describe('connectHost', () => {
  it('ohne Host: init sofort ohne Daten', () => {
    const init = vi.fn();
    connectHost({}, () => ({}), init);
    expect(init).toHaveBeenCalledWith(undefined);
  });
  it('mit ready: init über den Host, snapshot registriert', () => {
    const init = vi.fn();
    let snap: (() => unknown) | null = null;
    const hot = {
      snapshot: (fn: () => unknown) => {
        snap = fn;
      },
      ready: (fn: (d: unknown) => void) => {
        fn({ state: { tempo: 140 } });
      },
    };
    connectHost({ claude: { hot } }, () => ({ state: 1 }), init);
    expect(init).toHaveBeenCalledWith({ state: { tempo: 140 } });
    expect((snap as (() => unknown) | null)?.()).toEqual({ state: 1 });
  });
  it('ohne ready: init mit hot.data', () => {
    const init = vi.fn();
    connectHost({ claude: { hot: { data: { state: { tempo: 99 } } } } }, () => ({}), init);
    expect(init).toHaveBeenCalledWith({ state: { tempo: 99 } });
  });
});

describe('hostState', () => {
  it.each([
    [{ state: { tempo: 1 } }, { tempo: 1 }],
    [null, undefined],
    ['x', undefined],
    [{}, undefined],
  ])('%o → %o', (data, expected) => {
    expect(hostState(data)).toEqual(expected);
  });
});
