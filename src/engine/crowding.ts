import type { ReplacementStrategy } from './generation';
import type { Individual } from './initialize';
import type { Problem } from './problem';
import type { SelectionResult } from './selection';
import type { Rng } from '../run/rng';

/**
 * Deterministic crowding (Mahfoud): selection is no selection at all (every individual is a parent exactly once, in random
 * order), and replacement is a set of duels in which each child faces the nearer of its two parents and takes its place only
 * by being strictly better. The population stays the same size, the children sit where their parents sat, and a niche cannot
 * lose its best individual to a child from another niche.
 */

/** Said once, at the start of the stage, so the view can explain that this is not a selection pressure. */
export interface CrowdingSetupEvent {
  readonly stage: 'selection';
  readonly kind: 'crowding-setup';
  /** The number of individuals, each of which is taken once. */
  readonly size: number;
  /** An odd population needs one extra parent, drawn from the whole population, to complete the last pair. */
  readonly extra: boolean;
}

/** One draw: the next parent, taken from those not yet taken (or, for the extra parent, from everyone). Draws are numbered from 1. */
export interface CrowdingDrawEvent {
  readonly stage: 'selection';
  readonly kind: 'draw';
  readonly draw: number;
  readonly r: number;
  readonly individualId: number;
  readonly extra?: true;
}

/**
 * Every individual becomes a parent once, in random order: draw k takes position floor(r × the number still waiting) among
 * those not yet taken. `count` is the mating pool the pairing needs: the population size, or one more when it is odd, and the
 * extra parent is drawn from the whole population.
 */
export function crowdingSelect(population: readonly Individual[], count: number, rng: Rng): SelectionResult {
  const n = population.length;
  if (count !== n && count !== n + 1) throw new Error(`Deterministic crowding needs a mating pool of ${n} or ${n + 1} parents, but ${count} were asked for`);
  const extra = count > n;
  const waiting = [...population];
  const events: (CrowdingSetupEvent | CrowdingDrawEvent)[] = [{ stage: 'selection', kind: 'crowding-setup', size: n, extra }];
  const pool: number[] = [];
  for (let draw = 1; draw <= n; draw++) {
    const r = rng.next();
    const [taken] = waiting.splice(Math.floor(r * waiting.length), 1);
    pool.push(taken!.id);
    events.push({ stage: 'selection', kind: 'draw', draw, r, individualId: taken!.id });
  }
  if (extra) {
    const r = rng.next();
    const picked = population[Math.floor(r * n)]!;
    pool.push(picked.id);
    events.push({ stage: 'selection', kind: 'draw', draw: n + 1, r, individualId: picked.id, extra: true });
  }
  return { pool, events };
}

/** One duel: a child against the individual now holding the place of the parent it was matched with. */
export interface CrowdingDuel {
  readonly childId: number;
  /** Whoever held the place when the duel was fought: the parent, or the first child of its pair when both parents are one individual. */
  readonly parentId: number;
  /** The distance between the child and the parent it was matched with. */
  readonly distance: number;
  readonly childFitness: number;
  readonly parentFitness: number;
  /** The child wins only by being strictly fitter; on a tie the parent stays. */
  readonly winner: 'child' | 'parent';
}

/** A pair of parents and its children: which child was matched with which parent, and the duels, parent A's first. */
export interface CrowdingPair {
  readonly pair: number;
  readonly parentAId: number;
  readonly parentBId: number;
  readonly childIds: readonly number[];
  /** `straight`: child 1 against A and child 2 against B; `crossed`: child 2 against A and child 1 against B; `single`: the one child that was kept. */
  readonly matching: 'straight' | 'crossed' | 'single';
  /** With two children: the total distance of each matching; the smaller total is chosen, the straight one when they are equal. */
  readonly totals?: { readonly straight: number; readonly crossed: number };
  readonly duels: readonly CrowdingDuel[];
}

/** The replacement of deterministic crowding for a problem with this distance. It makes as many children as there are individuals. */
export function crowdingReplacement(distance: NonNullable<Problem['distance']>): ReplacementStrategy {
  return {
    offspringCount: (populationSize) => populationSize,
    replace(population, offspring) {
      const slotOf = new Map(population.map((individual, k) => [individual.id, k]));
      const parentOf = (id: number): Individual => {
        const slot = slotOf.get(id);
        if (slot === undefined) throw new Error(`Individual ${id} is named as a parent but is not in the population`);
        return population[slot]!;
      };
      const places = [...population];
      const byPair = new Map<number, Individual[]>();
      for (const child of offspring) {
        if (child.origin.kind !== 'offspring') throw new Error(`Individual ${child.id} is not an offspring, so it cannot duel`);
        const pair = Math.ceil(child.origin.offspring / 2);
        byPair.set(pair, [...(byPair.get(pair) ?? []), child]);
      }
      const duels: CrowdingPair[] = [];
      for (const [pair, children] of [...byPair.entries()].sort((a, b) => a[0] - b[0])) {
        const origin = children[0]!.origin as Extract<Individual['origin'], { kind: 'offspring' }>;
        const a = parentOf(origin.parentAId);
        const b = parentOf(origin.parentBId);
        let matching: CrowdingPair['matching'];
        let totals: CrowdingPair['totals'];
        let matched: { child: Individual; parent: Individual }[];
        if (children.length === 2) {
          const [c1, c2] = children as [Individual, Individual];
          const straight = distance(a, c1) + distance(b, c2);
          const crossed = distance(a, c2) + distance(b, c1);
          totals = { straight, crossed };
          matching = straight <= crossed ? 'straight' : 'crossed';
          matched = matching === 'straight' ? [{ child: c1, parent: a }, { child: c2, parent: b }] : [{ child: c2, parent: a }, { child: c1, parent: b }];
        } else {
          const [c1] = children as [Individual];
          matching = 'single';
          matched = [{ child: c1, parent: distance(b, c1) < distance(a, c1) ? b : a }];
        }
        const fought = matched.map(({ child, parent }): CrowdingDuel => {
          const slot = slotOf.get(parent.id)!;
          const holder = places[slot]!;
          const wins = child.fitness > holder.fitness;
          if (wins) places[slot] = child;
          return { childId: child.id, parentId: holder.id, distance: distance(child, parent), childFitness: child.fitness, parentFitness: holder.fitness, winner: wins ? 'child' : 'parent' };
        });
        duels.push({ pair, parentAId: a.id, parentBId: b.id, childIds: children.map((c) => c.id), matching, ...(totals ? { totals } : {}), duels: fought });
      }
      return { population: places, elites: [], duels };
    },
  };
}
