# 13 Defaults by measurement

Status: resolved
Type: task (needs instructor approval)
Blocked by: 06
Spec: ../spec.md

## What to build

Measure over at least 20 seeds and propose, with the numbers: population size, tournament size, crossover and mutation settings, ρ (so that a slightly overweight bag is not a bargain), the generation limit and the stagnation window (so that successful runs are not paused on the way, as was found for the string). The goal: most seeds reach the optimum or come within one item of it in a classroom-sized run, but not all. Record the table of results in this file and ask the instructor to approve the defaults before they are set.

## Done when

- The measurements are recorded, the instructor has approved the defaults, and the registry entry and its tests use them.

## Comments

## Measurements and proposal (waiting for the instructor's approval; nothing has been set yet)

All on the built-in instance (optimum 123, capacity 48), random initial populations, 40 seeds for the grid and 100–200 seeds for the chosen settings. "Optimum" means a feasible bag worth 123 has been found. The scratch scripts are not kept.

**Grid, first-fit decoder, pc 0.8 one-point** (seeds 1–40, 60 generations). It is an easy problem: with N ≥ 12 nearly every setting reaches the optimum in every seed within about ten generations, which is too quick to watch. A population of 8 with tournaments of 2 and no elites is the setting where the run takes a few dozen generations and some seeds fall short. Excerpt (reached the optimum within 60 generations / median generation):

| N | tournament | pm | elites | reached | median gen |
|---|---|---|---|---|---|
| 24 | 3 | 0.05 | 0 | 40/40 | 5 |
| 16 | 2 | 0.05 | 0 | 40/40 | 12 |
| 12 | 3 | 0.08 | 0 | 40/40 | 11 |
| 12 | 2 | 0.05 | 0 | 40/40 | 15 |
| **8** | **2** | **0.05** | **0** | **34/40** | **25** |
| 8 | 2 | 0.03 | 0 | 31/40 | 21 |
| 8 | 3 | 0.03 | 1 | 22/40 | 15 |

**Proposed defaults:** first-fit decoder (your choice); **population 8**, **tournament of size 2**, **one-point crossover pc 0.8**, **per-gene mutation pm 0.05**, **no elites**, seed 42; stop: **generation limit 100**, **target 123** (the best feasible bag), **stagnation window 50**.

Over 200 seeds with these settings: the optimum is reached within 30 generations in 66% of runs, within 60 in 87%, within 100 in 96% (8 of 200 runs do not find it by generation 100, but every run ends with a bag worth at least 100 and all but a few at 112 or more: the greedy value). The generation of success has median 20, 90th percentile 56, maximum 95. The longest stretch without improvement before success has median 10, 90th percentile 34, 95th percentile 51, maximum 88, so a window of 50 pauses about 5% of successful runs on the way (for the default seed 42 the optimum comes in generation 26 with a longest plateau of 13). Seed 42 under the other methods: Lamarckian 44, Baldwinian 27; penalty with ρ = 8: 95.

**Methods compared** (same operators, 100 seeds, optimum within 100 generations / median generation): decoder 92% / 22, Lamarckian repair 96% / 15, Baldwinian repair 100% / 11.

**ρ for the penalty** (same operators, 100 seeds, 100 generations; "scored above the optimum" means some bag, overweight, scored more than 123):

| ρ | optimum reached | an overweight bag scored above 123 | median final share of feasible bags |
|---|---|---|---|
| 0 | 10% | 100% | 0% |
| 1 | 74% | 100% | 0% |
| 2 | 89% | 96% | 38% |
| 3 | 86% | 0% | 50% |
| 4 | 74% | 0% | 63% |
| 8 | 63% | 0% | 75% |
| 15 | 52% | 0% | 75% |
| 50 | 58% | 0% | 88% |

Below ρ = 3 overweight bags beat the optimum (the "cheat"); from 3 up they never did in 100 × 100 generations. The best value per weight is 7 (item C: 21 for weight 3), so any ρ above 7 guarantees an overweight bag is never worth its extra weight. **Proposed default ρ = 8** (just above 7, explainable in one sentence: "more than any item earns per unit of weight"). The "too small" preset would use ρ = 1 (100% of seeds score above the optimum and end with nothing but infeasible bags).

**Finding that changes ticket 14:** a penalty that is *too large* does not do visible harm on this instance. Even at ρ = 50 every run ends with a feasible bag worth at least 112 (median 123); the only effect is that fewer runs reach 123 within 100 generations (58% against 86% at ρ = 3). So the preset "Penalty too large" with the text in the spec ("settles on a poor feasible bag") is not true. I propose to keep it only if a seed shows something specific and measured (for example "at ρ = 50 this seed has not found 123 after 100 generations, while ρ = 3 finds it in generation N"), and otherwise to drop it, as the spec allows.

## Answer

Approved by the instructor as proposed, and set in `knapsackDefaults` (`src/engine/knapsack.ts`, with the reasoning in its comment): first-fit decoder, population 8, tournament size 2, one-point crossover 0.8, per-gene mutation 0.05, no elites, seed 42, stop at 100 generations, the optimum 123 (best feasible) or 50 generations without improvement, penalty ρ = 8. `knapsack.test.ts` pins the numbers and checks that ρ is above the best value per weight (7). Tests that assumed the placeholders were updated (population of 8, ρ 8); tests that need an overweight offspring or a repair in the first generation now find such a seed by running the engine instead of relying on the default seed. The decision about the "Penalty too large" preset is carried to ticket 14.

State: 1204 unit tests, `npm run check` clean, 219 Playwright tests passing.
