# 02 Golden-run fixtures for the binary engine

Status: resolved
Type: task (test-first)
Blocked by: none
Spec: ../spec.md

## What to build

Before any engine change, record the exact output of the existing engine as test fixtures, so the generalisation in tickets 05–07 can be proven not to change a single binary run.

For fixed seeds, record populations after every generation, the recorded events of selected generations, and the metrics, for: the default configuration; each of the four Goldberg presets; both mutation modes; elites 0 and 2; offspring truncation on; tournament and roulette (with a Rank and Linear ranking chain); one-point, two-point and uniform crossover; and an odd mating pool. Store them as JSON fixtures next to a test that regenerates the run and compares everything, field by field, with a readable diff on failure.

## Done when

- The golden tests pass on the current engine and fail (proven once by a deliberate change, then reverted) when any draw, field or value changes.
- They run as part of `npx vitest run`, take only a few seconds, and are documented in a comment saying how to regenerate the fixtures and why that must never be done to make a failure go away.

## Comments

## Answer

`src/engine/golden-support.ts` defines 21 configurations and two seeds (7, 42), each run for 12 generations: the default; the four Goldberg presets; per-gene and per-individual mutation (including probability 1); elites 2 and elites = N; truncation with λ = 10 and an odd λ = 7; tournament size 3; a Rank + Linear ranking chain and a Shift + Power chain; two-point and uniform crossover; pc = 0; an odd mating pool (N = 5, and N = 6 with one elite); all-zero fitness (automatic switch to Shift); and a population of two. For each run it records every generation's population (`id:chromosome:fitness`), the full event lists of generations 1, 2 and 12, and the metrics of every generation, in `src/engine/golden/runs.json` (about 1 MB, compact JSON).

`src/engine/golden.test.ts` regenerates each run and compares populations, metrics and events separately, so a failure says which kind of output changed (45 tests, about 2 s). Fixtures are rewritten only with `UPDATE_GOLDEN=1 npx vitest run src/engine/golden`, and the file says why that must never be done to make a failure go away. `resolveJsonModule` was added to both tsconfigs for the import.

Proved to bite: changing the random-initialization threshold from 0.5 to 0.4 fails 40 of the 45 tests (the 5 explicit-population cases never draw an initial population, as expected); the engine was restored. A change that only matters at the extreme edge of a draw (the largest r of the per-individual gene choice, scaled by 0.998) is not caught, which is inherent in recording from fixed seeds; the statistical and edge tests of tickets 05–06 cover edges.

Check (`npm run check`) and all 806 tests pass.
