/**
 * A scheduler a test controls: nothing happens until the test fires a timer, so intervals and orderings
 * can be checked exactly without real time.
 */
export function createFakeScheduler() {
  let time = 0;
  let nextHandle = 1;
  const timers = new Map<number, { due: number; callback: () => void }>();

  const earliest = () => [...timers.entries()].sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];

  return {
    setTimeout(callback: () => void, delayMs: number): number {
      const handle = nextHandle++;
      timers.set(handle, { due: time + delayMs, callback });
      return handle;
    },
    clearTimeout(handle: unknown) {
      timers.delete(handle as number);
    },
    /** The delays (from now) of every pending timer, soonest first. */
    pendingDelays(): number[] {
      return [...timers.values()].map((t) => t.due - time).sort((a, b) => a - b);
    },
    now: () => time,
    /** Runs the soonest pending timer, moving time forward to when it was due. False if none is pending. */
    fire(): boolean {
      const next = earliest();
      if (!next) return false;
      const [handle, timer] = next;
      timers.delete(handle);
      time = Math.max(time, timer.due);
      timer.callback();
      return true;
    },
    /** Moves time forward, running every timer that falls due on the way (at most `limit` callbacks, as a safety net). */
    advance(ms: number, limit = 10_000) {
      const target = time + ms;
      for (let n = 0; n < limit; n++) {
        const next = earliest();
        if (!next || next[1].due > target) break;
        this.fire();
      }
      time = target;
    },
  };
}
