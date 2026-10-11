import { describe, expect, test } from 'vitest';
import fixtures from './golden/runs.json';
import { goldenCases, goldenSeeds, recordGolden, recordAllGolden, type GoldenRun } from './golden-support';

/**
 * The binary engine must produce exactly the runs recorded in `golden/runs.json`: populations, events and metrics.
 *
 * To regenerate the fixtures after a change that is meant to alter binary behaviour, run
 *   UPDATE_GOLDEN=1 npx vitest run src/engine/golden
 * and review the diff of `golden/runs.json` line by line. Never regenerate to make a failure go away: a failure
 * means a binary run changed, which the alphabet generalisation (milestone 2) promised never to do.
 */
const recorded = fixtures as unknown as GoldenRun[];

const proc = (globalThis as { process?: { env: Record<string, string | undefined>; cwd(): string } }).process;
if (proc?.env.UPDATE_GOLDEN) {
  test('writes the golden fixtures (UPDATE_GOLDEN is set)', async () => {
    // @ts-ignore node typings are deliberately absent from the engine project (ADR 0002); this runs only under vitest
    const fs = await import('node:fs');
    fs.writeFileSync(`${proc.cwd()}/src/engine/golden/runs.json`, JSON.stringify(recordAllGolden()) + '\n');
  });
} else {
  describe('golden runs', () => {
    test('there is one recording per case and seed, and nothing else', () => {
      expect(recorded.map((r) => `${r.name} / ${r.seed}`)).toEqual(goldenCases.flatMap((c) => goldenSeeds.map((s) => `${c.name} / ${s}`)));
    });

    for (const c of goldenCases) {
      for (const seed of goldenSeeds) {
        test(`${c.name}, seed ${seed}: populations, events and metrics are exactly as recorded`, () => {
          const want = recorded.find((r) => r.name === c.name && r.seed === seed)!;
          const got = recordGolden(c, seed);
          // compared part by part so a failure says which kind of output changed
          expect(got.populations).toEqual(want.populations);
          expect(got.metrics).toEqual(want.metrics);
          expect(got.events).toEqual(want.events);
        });
      }
    }
  });
}
