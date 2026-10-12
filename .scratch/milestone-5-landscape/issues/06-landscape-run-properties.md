# 06 Landscape runs: reproducibility, bounds, metrics, the stop within ε

Status: resolved
Type: task (test-first)
Blocked by: 03, 04, 05
Spec: ../spec.md

## What to build

Run-level tests and whatever small engine additions they need: the diversity measure in decoded space (mean pairwise distance normalised by the diagonal of the bounds, 0 to 1) and the spread (standard deviation of x and of y as a share of each range) in the metrics for the landscape in both representations (and the Hamming diversity of the symbol problems kept for binary-coded runs); the stop criterion "target fitness reached" as "within ε of the optimum fitness" (ε a parameter, default 1e-3 of the function's fitness range) for the landscape, unchanged for the other problems.

## Done when

- A seeded landscape run is identical by micro-step, stage, generation, run-until and every playback tier, for all three representations and all operators; the events alone reproduce every population (also with elites and truncation); every individual of every generation is inside the bounds; odd mating pools, bypasses and size invariants hold.
- Diversity and spread equal a direct computation; the stop within ε fires exactly when the best fitness is within ε of the optimum and never otherwise; the other problems' metrics and stops are unchanged (golden runs).

## Comments

## Answer
Run-level tests in `src/engine/landscape-run.test.ts` (63) and small engine additions.

- **Same run however advanced** (for real, plain binary and Gray, each with every crossover operator it offers: real one-point, uniform, BLX-α, arithmetic; binary one-point, two-point, uniform): micro-steps, stages, generations and run-until agree including regenerated events; playback at the slow, medium, fast and maximum tiers makes the identical run; the events alone reproduce every population, with elites and with truncation; every individual of every generation, for all four functions, is inside the bounds, carries the point its chromosome stands for, and has the function's fitness at it.
- **Operators**: each crossover operator × per-gene and per-individual mutation runs and records recombinations; crossover off and mutation off are recorded bypasses of copies with no draws and selection still runs; population size, elites, truncation and the odd mating pool behave as for the other problems; children share no array with their parents. At the bounds: Gaussian steps and BLX-α children beyond a bound are clamped, recorded, and every individual stays inside.
- **Metrics** (`GenerationMetrics.decoded`, new, from `metricsOfProblem` for problems that declare `decodedBounds`): `diversity` = mean pairwise distance of the decoded points scaled to their bounds over the diagonal (0 to 1) and `spread` = standard deviation of x and of y (over the population, dividing by N) as a share of each range; equal to an independent direct computation in every generation for all three representations. For a binary-coded run the top-level `diversity` stays the Hamming one, so the plain-binary cliff is visible in the numbers: values 7 and 8 of 15 are 4 of 8 bits apart in plain binary (decoded step 1/15 of the range) and 1 of 8 in Gray. For a real run the top-level `diversity` is the decoded one. The other problems' metrics carry no `decoded` and are unchanged; the result is cached per state.
- **Stop within ε**: no new stop mechanism, the existing target criterion with `landscapeTargetFitness(problem, ε)` = optimum fitness − ε (ε must be greater than 0, `validateEpsilon`); `landscapeFitnessRange` (worst fitness found numerically and refined, best = the known optimum) and `landscapeDefaultEpsilon` = 1e-3 of that range (about 0.001 for single peak, about 0.9 for Himmelblau). Tested: it fires exactly when the best-so-far is within ε (just inside and just outside), in runs of all three representations in the generation where the best-so-far first comes within ε, and the other problems' target stop is unchanged. The range is checked against a 1200² brute-force grid, analytic corner values and a dense one-variable scan for Rastrigin.
- Mutation-checked (spread divides by N − 1, diversity not normalised, target + ε, worst fitness not refined, `decodedBounds` removed, cache removed): each fails tests.

Golden runs unchanged; 87 files / 1614 unit tests pass; `npm run check` clean.
