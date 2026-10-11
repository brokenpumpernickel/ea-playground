# 10 Trap defaults by measurement

Status: resolved
Type: measurement, review (needs instructor approval)
Blocked by: 03
Spec: ../spec.md

## What to build

Measure, over at least 20 seeds (more where it matters), candidate defaults for the trap with k = 4, m = 5, tight: population size, selection and tournament size, crossover operator and probability, mutation rate, elitism, generation limit and stagnation window. Goal (spec): most runs with the defaults do not reach the optimum within the limit, a few do, and a parameter change or a preset visibly helps; no run is paused by the stagnation window while still moving. Also measure what loose linkage, uniform crossover, a bigger population and no mutation change. Report the numbers and a proposal to the instructor; set the defaults only after approval. Measurement scripts are not kept.

## Done when

- The measurements are recorded in this file, a proposal is approved by the instructor and set in the registry, with a test that pins the defaults.

## Comments

## Answer

## Answer (measured; waiting for the instructor's approval)

100 seeds (1 to 100) per setting, 5 blocks of 4 (20 genes, optimum 20), tight linkage unless said, tournament of 2, one-point crossover 0.8, per-gene mutation 0.05, no elites, unless said. "Reached" = a bag with fitness 20 was seen in a population within 100 generations (the best so far, as the stop criterion counts it). "Attractor share" is the share of blocks at all zeros in the final population (generation 100 or the generation the optimum was found); the average fitness of the final population is 11 to 12 in nearly every setting with mutation 0.05: the constant mutation keeps the population from settling, so the deception shows as a population that hovers around the all-zeros score of 15 or below while a lucky individual now and then finds 20.

| Setting | Reached the optimum | Median generation when reached | Mean best so far | Mean average of the final population |
|---|---|---|---|---|
| population 8 | 0 | – | 16.7 | 10.9 |
| **population 12** | **2** | 97 | 17.3 | 11.2 |
| population 20 | 5 | 57 | 17.9 | 11.5 |
| population 30 | 13 | 59 | 18.1 | 11.5 |
| population 50 | 32 | 56 | 19.1 | 11.6 |
| population 100 | 43 | 50 | 19.3 | 11.5 |
| population 200 | 83 | 36 | 19.8 | 11.3 |
| population 500 | 100 | 21 | 20.0 | 10.8 |
| population 12, mutation 0.01 / 0.1 | 0 / 0 | – | 16.7 / 16.8 | 16.2 / 8.7 |
| population 12, tournament 3 | 7 | 76 | 17.2 | 13.1 |
| population 12, uniform crossover | 3 | 36 | 16.7 | 11.0 |
| population 12, no mutation | 0 | – | 13.5 | 13.1 |
| population 50, tournament 3 | 41 | 27 | 19.1 | 13.9 |
| population 50, one elite | 52 | 59 | 19.4 | 12.6 |
| population 50, **loose** linkage | **0** (tight: 32) | – | 16.8 | 11.7 |
| population 50, uniform crossover | 0 | – | 16.6 | 11.8 |
| population 50, no mutation | 10 | 13 | 18.1 | 17.7 |
| population 100, one elite | 94 | 37 | 19.9 | 11.9 |
| population 100, tournament 3 | 75 | 18 | 19.7 | 13.5 |
| population 100, mutation 0.01 | 26 | 12 | 19.1 | 17.3 |
| population 100, loose linkage | 1 | 6 | 16.8 | 11.9 |
| population 100, uniform crossover | 0 | – | 16.5 | 12.1 |
| population 100, no mutation | 41 | 12 | 19.3 | 17.7 |
| population 100, limit 200 | 74 | 95 | 19.7 | 11.6 |

**Stagnation window.** The longest stretch without a new best before the optimum was found, over the runs that found it: at most 55 generations for population 12 (2 runs), 32 for 16, 42 for 20, 62 for 30. Of the runs that never found it, 72 of 98 (population 12) had a stretch of 50 or more generations without improvement; none had less than 32.

**What the numbers say.**
- A population of 12 or 20 with the textbook operators almost never reaches the optimum in 100 generations (2 and 5 runs in 100), which is the picture the milestone wants; larger populations, elitism and a larger tournament visibly change that: population 100 reaches it in 43 runs, with one elite in 94, with tournaments of 3 in 75, population 500 in all 100.
- Linkage and the crossover type matter more than the numbers suggest: with population 50, tight blocks reach the optimum in 32 runs and loose blocks in none; uniform crossover (which ignores linkage) in none either, and also in none at population 100 (loose, one-point: 1 run).
- No mutation: the population converges (average 17.7, near the best) but only a fifth to a half of the runs have the optimum in it (population 100: 41), and with population 12 none do (average 13.1); too much mutation (0.1) keeps the average below 9.

**Proposal** (the registry's provisional values, apart from the stagnation window): population **12**, tournament **2**, one-point crossover with probability **0.8**, per-gene mutation **0.05** (= 1/20, one flip per chromosome on average), **no elites**, stop at generation **100**, at fitness **20** (the optimum), and a stagnation window of **70** (more than the longest stretch before any success at these sizes, 55; the provisional 50 would have stopped a run that went on to succeed). With these, 2 runs in 100 reach the optimum, so most runs end as a deceptive population hovering around 11 to 17 while the best so far is 16 to 18. If you would rather have a run now and then succeed, population 20 gives 5 in 100 and 30 gives 13 in 100 (at the price of 20 or 30 rows in the table; the table shows nine at once).

**Presets this suggests** (each to be verified on a real seed in ticket 11): *Trap, tight blocks* (the defaults); *Trap, loose blocks* (the same with loose linkage, population 50: 0 reached against 32 for tight); *Bigger population* (population 200: 83 reached against 2 at 12 with the same seed settings; or population 100 with one elite: 94); *Uniform crossover* (population 50 or 100: 0 reached, and why: it ignores linkage); *No mutation* (population 12: the population converges on the lucky best or on the attractor, none reach the optimum).

Waiting for approval before setting the stagnation window and the defaults test; ticket 11 (presets) is blocked on it.

### Approved and set

2026-10-11: the instructor approved the proposal ("Approved, set those defaults and continue"). `trapDefaults` in `src/engine/trap.ts` is now: population 12, tournament 2, one-point crossover 0.8, per-gene mutation 0.05, no elites, stop at generation 100, at fitness 20 and after 70 generations without improvement (the one change from the provisional values: the window, 50 → 70). A test in `trap.test.ts` pins every value and the target.
