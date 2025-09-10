import { SimpleYProvider } from '../yjsProvider';

describe('presence throttling and filtering', () => {
  let origInit: any;
  let now = 0;
  beforeAll(() => {
    origInit = (SimpleYProvider as any).prototype.initRealtime;
    (SimpleYProvider as any).prototype.initRealtime = function () {
      // no-op in tests
    };
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });
  afterAll(() => {
    (SimpleYProvider as any).prototype.initRealtime = origInit;
    (Date.now as any).mockRestore?.();
  });

  function makeProvider() {
    const p = new SimpleYProvider({ docId: 't1', apiBase: '' } as any);
    // fake socket
    const calls: any[] = [];
    (p as any).socket = { emit: (_evt: string, payload: any) => calls.push(payload) } as any;
    return { p, calls } as const;
  }

  it('throttles duplicate presence emits', () => {
    const { p, calls } = makeProvider();
    now = 1000;
    p.sendPresence({ anchor: 5, head: 5 });
    // same payload within window should not emit again
    now += 10;
    p.sendPresence({ anchor: 5, head: 5 });
    // small move below threshold should be filtered
    now += 10;
    p.sendPresence({ anchor: 6, head: 6 });
    expect(calls.length).toBe(1);
  });

  it('allows typing flips despite throttle', () => {
    const { p, calls } = makeProvider();
    now = 2000;
    p.sendPresence({ anchor: 5, head: 5, typing: true });
    now += 30; // within throttle
    p.sendPresence({ anchor: 5, head: 5, typing: false });
    expect(calls.length).toBe(2);
  });

  it('emits after min interval even without movement', () => {
    const { p, calls } = makeProvider();
    now = 3000;
    p.sendPresence({ anchor: 10, head: 10 });
    now += 200; // over min interval
    p.sendPresence({ anchor: 10, head: 10 });
    expect(calls.length).toBe(2);
  });
});

