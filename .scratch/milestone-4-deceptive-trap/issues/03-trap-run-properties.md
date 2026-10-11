# 03 Trap runs: reproducibility, operators, zero-total populations

Status: resolved
Type: task (test-first)
Blocked by: 02
Spec: ../spec.md

## What to build

Run-level tests of the trap through the public run interface, as ticket 07 did for the knapsack: whatever is needed in the engine to make them pass (expected: nothing beyond ticket 02).

## Done when

- A seeded trap run is identical by micro-step, stage, generation, run-until and every playback tier, for tight and loose linkage; regenerated events equal live ones; the events alone reproduce every population.
- Crossover (all three operators), mutation (both modes), their bypasses, elitism, truncation, odd mating pools and size invariants hold as for Goldberg; children never share chromosome arrays.
- A population whose total fitness is 0 (every block 1110) under roulette selection behaves exactly as the existing zero-total rule says for Goldberg, and the test shows it.
- Stop criteria: generation limit, optimum reached (k × m) and stagnation work on trap runs.

## Comments

## Answer

`src/engine/trap-run.test.ts` (25 tests, all passing). **Nothing in the engine had to change**: the trap runs through the existing algorithm, run layer and playback unchanged.

- For tight and loose linkage: micro-steps, stages, generations and run-until make the identical run (snapshots and events), regenerated events equal live ones, playback at all four tiers makes the identical run, the events alone reproduce every population (also with elites and with truncation), and every individual's fitness, objective and decoded text equal the trap's `outcomeOf`.
- Operators: one-point, two-point and uniform crossover with both mutation modes keep every chromosome a valid trap string; crossover off and mutation off are recorded bypasses (copies, selection still runs); a mutated gene flips between 0 and 1; size, elites, truncation and the odd mating pool hold; children never share arrays with parents.
- Zero total: a population of six chromosomes with every block 1110 (all fitness 0) under roulette with the Identity chain switches to Shift with the reason "All fitness values are zero…" and selection runs, exactly as the existing rule does for Goldberg.
- Stops and metrics: the target k × m is reported after the first generation when the optimum is in the initial population (generation 0 never reports stops, as for every problem); with crossover and mutation off, stagnation is reported from exactly its window; the generation limit stops the run; the trap reports no feasibility metrics.

`npm run check` clean, 1295 unit tests pass.
