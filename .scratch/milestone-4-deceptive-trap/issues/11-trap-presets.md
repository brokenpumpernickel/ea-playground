# 11 Trap presets

Status: resolved
Type: task (test-first)
Blocked by: 04, 10
Spec: ../spec.md

## What to build

The presets as data files with verified seeds: candidates from the spec (tight blocks, loose blocks, a bigger population or uniform crossover, no mutation), settled by the ticket 10 measurements. Each preset's lesson and "look for" text claims only what a test on its seed shows, as for the knapsack (including statistics over many seeds where the text says "usually"); a preset expected to fail says so; a demonstration that is not real for any seed is reduced to what holds or dropped.

## Done when

- Each preset has a test asserting every claim in its text on its seed; presets of the other problems are unchanged and each preset list keeps to its own problem.
- Playwright: the menu lists them with their texts, loading one restarts with its seed, and the run equals the engine's.

## Comments

## Answer

Six presets as data files (`src/ui/presets/d-…` to `i-…`), all on the trap, 5 blocks of 4, with the measured defaults except for what each lesson changes. Seeds were found by scanning (not chosen by hand) and every claim in each text is asserted by a test on its seed (`src/ui/presets-trap.test.ts`, 17 tests; the statistics over seeds 1 to 100 are recomputed there).

| Preset | What it changes | Verified on its seed | Verified over seeds 1 to 100 |
|---|---|---|---|
| Tight blocks (42) | the defaults, population 12 | never finds 20; Run until stop pauses at generation 86 for stagnation (best so far 16); best so far 17 and average 13 at generation 100, below the all-zeros 15 | 2 runs find 20 |
| Loose blocks (44) | loose linkage, population 50 | ends at 17 without 20; the same seed with tight blocks finds 20 in generation 74; a cut between genes 5 and 15 splits all five blocks (11 of 19 cuts) | tight 32, loose 0 |
| Bigger population (42) | population 200 | finds 20 in generation 11; 12 individuals end at 17 | 83 against 2 (17 of 100 still miss) |
| Elitism (42) | population 100, one elite | finds 20 in generation 17; without the elite the same seed ends at 19 | 94 against 43 |
| Uniform crossover (10) | uniform crossover, population 100 | pauses at generation 73 for stagnation with best 17, still 17 at 100; one-point with the same seed finds 20 in generation 20; most blocks of a child are split | 0 against 43 |
| No mutation (42) | mutation off | all 12 individuals identical by generation 100, best 14, a generation changes nothing; Run until stop pauses at generation 72 for stagnation | no run finds 20 and every run ends with identical individuals |

Texts that the first draft got wrong and the tests caught: "Run until stop" pauses at stagnation before the generation limit for three presets, so those texts now say where it pauses. Playwright `e2e/trap-presets.spec.ts` (9): the menu lists the six with their lesson and what to look for, loading each restarts with its seed and the run equals the engine's, Run until stop pauses at generation 86 for Tight blocks and stops at the target in generation 11 for Bigger population; `string-link.spec.ts` now also opens each preset's link in a fresh page. `npm run check` clean; 1451 unit tests and 384 Playwright tests pass.
