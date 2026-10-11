# 03 Trap runs: reproducibility, operators, zero-total populations

Status: open
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
