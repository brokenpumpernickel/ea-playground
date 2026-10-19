# 03 Deterministic crowding in the engine

Status: resolved
Type: task (test-first)
Blocked by: 01
Spec: ../spec.md

## What to build

Selection becomes a random order in which every individual is a parent once (an odd population adds one extra random parent) with its events; pairing, crossover, mutation and evaluation as today; the crowding replacement: each child duels the nearer parent (the matching with the smaller total distance, the first matching on equal totals), replaces it only if strictly better (ties keep the parent), the children take their parents' places; `duels` in the replacement event; elites and truncation ignored; the population size constant.

## Done when

- A hand-worked pair; matching by total distance; strict improvement and the tie; size constant; every individual a parent once and the odd case; events replay to the population; reproducible; the run layer's playback tiers agree.

## Comments

## Answer

**Built** (`src/engine/crowding.ts`, `generation.ts`, `selection.ts`, `algorithm.ts`): with `niching.method = 'crowding'`, **selection** is `crowdingSelect`: a `crowding-setup` event, then one `draw` event per individual (each draw takes position floor(r × the number still waiting) among those not yet taken, so every individual is a parent exactly once; an odd population adds one extra parent drawn from everyone, flagged `extra`); one draw per parent, N in all, and each draw is a micro-step. Pairing, crossover, mutation and evaluation are as before. **Replacement** is `crowdingReplacement`: the children are grouped by pair; with two children the matching of children to parents with the smaller total distance is taken (the straight one on equal totals); a pair with one child (an odd population's dropped second child) duels the nearer parent (parent A on a tie); each child duels whoever now holds its parent's place and takes it only if **strictly** fitter (a tie keeps the parent). The population keeps its size, the children sit where their parents sat, elites are empty, and elitism and offspring truncation are ignored (even absurd values). The replacement event carries `duels`: for each pair its parents, children, matching, the two totals, and each duel's child, the place's holder, the distance, both fitnesses and the winner. The narration has sentences for the new selection events.

**Tests** (`crowding.test.ts` 16, `niching-run.test.ts` now 22): the selection hand-worked with scripted draws (pool 1, 3, 4, 2 from r = 0, 0.5, 0.99, 0.7), every individual exactly once whatever the draws, one draw per parent, the odd case with its extra parent; the replacement hand-worked (parents at 0 and 10, children at 9 and 1: the crossed matching totals 2 against 18), the straight matching and the tie between totals, a tie in fitness keeps the parent, the single-child pair, both parents the same individual (the second child duels the first), the size kept and no place ever worse; a generation: the crowding selection whatever selection method is set, N children evaluated, elites 99 and truncation ignored, six pair records of two duels each, every place its old individual or a child that won a duel for it, the events replay to the population, an odd population (7: four pairs, the last with one duel, matching `single`), the total fitness of the places never goes down over 15 generations, the same seed the same run, the refusal for a problem with no distance. The run layer: a seeded run under crowding is identical by micro-step, stage, generation and run-until and at every playback tier, replays to the population, and keeps its size, for an even and an odd population. Mutations (ties to the child, ties to the crossed matching, never crossed, the draw position by N instead of the number remaining) each fail tests.
