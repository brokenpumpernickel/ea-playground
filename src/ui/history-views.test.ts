import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import { createFakeScheduler } from '../run/fake-scheduler';
import { defaultParams } from './config';
import DiscardNotice from './DiscardNotice.svelte';
import HistoryStrip from './HistoryStrip.svelte';
import { createSession } from './session.svelte';

const make = (generations: number) => {
  const session = createSession({ scheduler: createFakeScheduler(), drawSeed: () => 777 });
  for (let g = 0; g < generations; g++) session.stepGeneration();
  return session;
};
const html = (component: unknown, session: ReturnType<typeof make>) => render(component as never, { props: { session } as never }).body;
const attr = (markup: string, name: string) => new RegExp(`${name}="([^"]*)"`).exec(markup)?.[1];

describe('history bar', () => {
  test('is a slider whose value is the generation, described in words, with a cell label for each generation', () => {
    const session = make(4);
    session.scrubTo({ cycle: 2, stage: 3, micro: 1 });
    const markup = html(HistoryStrip, session);
    expect(markup).toContain('role="slider"');
    expect(attr(markup, 'aria-valuemin')).toBe('0');
    expect(attr(markup, 'aria-valuemax')).toBe('4');
    expect(attr(markup, 'aria-valuenow')).toBe('2');
    expect(attr(markup, 'aria-valuetext')).toBe('Generation 2, stage 4 Mutation, micro-step 1 of 6');
    for (const g of [0, 1, 2, 3, 4]) expect(markup).toContain(`gen ${g}</text>`);
    expect(markup).toContain('recorded gens 0–4');
  });

  test('return to live is disabled at the live end and enabled in the past', () => {
    const session = make(3);
    expect(html(HistoryStrip, session)).toMatch(/<button[^>]*disabled[^>]*>Return to live/);
    session.scrubTo({ cycle: 1, stage: 0, micro: 0 });
    expect(html(HistoryStrip, session)).not.toMatch(/<button[^>]*disabled[^>]*>Return to live/);
  });

  test('the thumb moves right as the cursor goes forward through the history', () => {
    const session = make(4);
    const xs = [0, 1, 2, 3, 4].map((cycle) => {
      session.scrubTo({ cycle, stage: 0, micro: 0 });
      return Number(attr(html(HistoryStrip, session), 'data-thumb'));
    });
    xs.forEach((x, k) => k > 0 && expect(x).toBeGreaterThan(xs[k - 1]!));
  });
});

describe('discard notice', () => {
  test('names the generations that will go, and offers cancel and confirm', () => {
    const session = make(8);
    session.scrubTo({ cycle: 5, stage: 5, micro: 1 });
    session.changeParameters({ ...defaultParams, elites: 1 });
    const markup = html(DiscardNotice, session);
    expect(markup).toContain('role="alertdialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('Generations 6–8 will be discarded. The run continues from generation 5 with the new settings.');
    expect(markup).toContain('>Cancel</button>');
    expect(markup).toContain('>Discard and apply</button>');
  });
});
