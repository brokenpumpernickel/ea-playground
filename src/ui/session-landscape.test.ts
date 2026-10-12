import { describe, expect, test } from 'vitest';
import type { LandscapeOptions } from '../engine';
import { createFakeScheduler } from '../run/fake-scheduler';
import { defaultsOf, entryOf } from './problems';
import { createSession } from './session.svelte';

const entry = entryOf('landscape')!;
const landscapeSession = (options: LandscapeOptions = entry.defaultOptions() as LandscapeOptions) => {
  const d = defaultsOf(entry, options);
  return createSession({ scheduler: createFakeScheduler(), drawSeed: () => 7, config: { setup: { problem: entry.create(options), init: d.init }, params: d.params, seed: 5, problem: 'landscape', options } });
};

describe('a session running the landscape', () => {
  test('knows its landscape (representation, function, how a chromosome decodes), and the other problems have none', () => {
    const session = landscapeSession({ function: 'himmelblau', representation: 'gray', bitsPerVariable: 6 });
    expect(session.landscape).toMatchObject({ id: 'himmelblau', representation: 'gray', bits: 6, minimised: true });
    const goldberg = createSession({ scheduler: createFakeScheduler(), drawSeed: () => 7 });
    expect(goldberg.landscape).toBeUndefined();
    expect(goldberg.landscapeMarks(0)).toBeUndefined();
  });

  test('draws the marks of the population the table shows: one per row, at the row’s point, and they follow the cursor', () => {
    const session = landscapeSession();
    const marks = session.landscapeMarks(0)!;
    expect(marks.generation).toBe(0);
    expect(marks.individuals.map((i) => i.id)).toEqual(session.table.rows.map((r) => r.id));
    marks.individuals.forEach((i, k) => expect([i.point.x, i.point.y]).toEqual(session.table.rows[k]!.values));
    session.stepGeneration();
    session.stepGeneration();
    expect(session.landscapeMarks(0)!.generation).toBe(2);
    expect(session.landscapeMarks(3)!.trails.map((t) => t.generation)).toEqual([0, 1]);
    // a micro-step back from the live end is inside generation 2, so the population shown is generation 1's
    session.backMicro();
    expect(session.landscapeMarks(0)!.generation).toBe(1);
  });

  test('the selection is one individual at a time: selecting another moves it, selecting the same one again clears it, and it is in the marks', () => {
    const session = landscapeSession();
    expect(session.selectedId).toBeUndefined();
    const [a, b] = session.table.rows;
    session.selectIndividual(a!.id);
    expect(session.selectedId).toBe(a!.id);
    expect(session.landscapeMarks(0)!.individuals.filter((i) => i.selected).map((i) => i.id)).toEqual([a!.id]);
    session.selectIndividual(b!.id);
    expect(session.selectedId).toBe(b!.id);
    expect(session.landscapeMarks(0)!.selectedId).toBe(b!.id);
    session.selectIndividual(b!.id);
    expect(session.selectedId).toBeUndefined();
    session.selectIndividual(undefined);
    expect(session.selectedId).toBeUndefined();
  });

  test('a restart or a new seed starts the selection over', () => {
    const session = landscapeSession();
    session.selectIndividual(session.table.rows[2]!.id);
    session.reset();
    expect(session.selectedId).toBeUndefined();
    session.selectIndividual(session.table.rows[1]!.id);
    session.newSeed();
    expect(session.selectedId).toBeUndefined();
  });

  test('stepping the run keeps the selection (the individual may be gone from the new population, and then nothing is highlighted)', () => {
    const session = landscapeSession();
    const id = session.table.rows[0]!.id;
    session.selectIndividual(id);
    session.stepGeneration();
    expect(session.selectedId).toBe(id);
    const marks = session.landscapeMarks(0)!;
    expect(marks.individuals.filter((i) => i.selected).length).toBe(marks.individuals.some((i) => i.id === id) ? 1 : 0);
  });
});
