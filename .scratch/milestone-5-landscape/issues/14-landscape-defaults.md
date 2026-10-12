# 14 Landscape defaults by measurement

Status: proposal awaiting instructor approval
Type: measurement, review (needs instructor approval)
Blocked by: 06
Spec: ../spec.md

## What to build

Measure, over at least 20 seeds (more where it matters), candidate defaults for each function and representation: population size, selection and tournament size, crossover operator and probability, α, σ, mutation probability, bits per variable, elitism, the generation limit, ε and the stagnation window. Goal (spec): the default function finds its optimum in most but not all runs, the harder functions show the deceptive behaviour (two peaks: premature convergence on the broad hill; Rastrigin: local minima; Himmelblau: clustering), and the stagnation window does not pause a run that is still moving. Also measure what changes with α = 0, arithmetic against BLX-α, σ too small, plain binary against Gray. Report the numbers and a proposal to the instructor; set the defaults only after approval. Measurement scripts are not kept.

## Done when

- The measurements are recorded in this file, a proposal is approved by the instructor and set in the registry, with a test that pins the defaults.

## Comments

## Measurements

Harness: a temporary test (deleted, not kept) that runs the real engine headless, 100 generations, random initial populations, seeds 1000+ (50 seeds per cell of the grids) and 5000+ (100 seeds per cell of the detailed tables). "Found" = best so far within the default ε (1e-3 of the function's fitness range) of the optimum within 100 generations. Provisional defaults measured first (pop 20, tournament 3, real: BLX-α 0.9/α 0.5 + Gaussian per gene 0.1/σ 0.05; bits: one-point 0.8 + flip 0.02; 1 elite; stagnation 40), 50 seeds:

| function | real | plain (10 bits) | Gray (10 bits) |
|---|---|---|---|
| single peak | 50/50 | 23/50 | 50/50 |
| two peaks | 12/50 | 4/50 | 17/50 |
| Rastrigin | 48/50 | 13/50 | 21/50 |
| Himmelblau (ε is loose: f < 2.2) | 50/50 | 47/50 | 50/50 |

**Real coding, grid** (population 8, 12, 20, 30; tournament 2, 3; pm 0.05, 0.1, 0.2; σ 0.02, 0.05, 0.1; elites 0, 1; 144 cells, 50 seeds each). The single peak is found in 100 % of runs in every cell with population 12 or more (and in 82–100 % at population 8): no sensible real setting makes it fail. Two peaks is found in 0–18 % (the narrow hill) at population 8–12, up to ~30 % at 20. Rastrigin depends on the population and σ: at 12 / pm 0.1 / elites 1 it is found in 18 % (σ 0.02), 74 % (σ 0.05), 90 % (σ 0.1); at 20 it is 96 % with σ 0.05. Without elites two peaks and Rastrigin get worse (found 9 % / 30 %).

**Candidate D** (population 12, tournament 2, pc 0.9, BLX-α α 0.5, per-gene pm 0.1, σ 0.05, 1 elite), 100 seeds per function, final state at generation 100:

| function | found | median gens to ε | where the runs end | pauses by a stagnation window of 40 / of those, runs that would still have improved by more than ε |
|---|---|---|---|---|
| single peak | 100 % | 10 | – | 3 / 0 |
| two peaks | 21 % | 22 | 79 % on the broad hill (wrong), 21 % on the narrow one | 8 / 0 |
| Rastrigin | 71 % | 36 | 27 % best in a local minimum; in 68 % of runs the population sits in two or more cells | 3 / 0 |
| Himmelblau | 100 % | 5 | best in optimum 1 / 2 / 3 / 4: 48 / 21 / 13 / 18 % | 5 / 0 |

Tournament 3 instead of 2 converges faster (median 10 → 10, Rastrigin 68 %) but a window of 40 then pauses 7 of 27 Rastrigin runs that were still improving; population 8 or tournament 3 at 12 make wrong pauses of 10 % and more at windows 15 to 30. A strict improvement of even 1e-9 resets the window, so for the real coding stagnation almost never fires (3–8 runs in 100): the run mostly ends by reaching ε or at the generation limit.

**What changes** (candidate D, 100 seeds; found % single peak / two peaks / Rastrigin / Himmelblau, then medians where useful):
- α = 0 (children stay in the parents' box): 100 / 19 / 71 / 100 — almost no difference in success; it is slower (Rastrigin median 42 against 36 generations), and at windows of 15 to 30 generations it makes the run look stalled far more often (15 : 96 of 100 runs paused against 42 for α 0.5).
- α 0.3: 100 / 18 / 77 / 100. Arithmetic crossover: 100 / 19 / 70 / 100, slower (single peak median 15 against 10 generations).
- σ 0.005 ("too small"): 98 / 20 / 19 / 99, final diversity 0.001 against 0.012; Rastrigin ends in a local minimum in 81 % of runs and the population never splits. σ 0.02: Rastrigin 18 %. σ 0.2: Rastrigin 89 %, final diversity 0.05. Arithmetic with σ 0.005: single peak 87 %, Rastrigin 11 %, Himmelblau 94 %.
- No elites: 100 / 9 / 30 / 100.

**Binary coding, grid** (population 12, 20; one-point and uniform; pc 0.8, 0.9; pm 0.01, 0.02, 0.05; 8 and 10 bits; tournament 2, 1 elite; 50 seeds): Gray code finds the single peak in 100 % of cells; plain binary only in 18–100 % depending on pm (population 12, pm 0.02: 30–52 %; pm 0.05: 72–82 %), because of the Hamming cliffs around the optimum. With 8 bits Rastrigin is never found (the grid step 0.04 cannot reach within ε = 0.08 of every local minimum), with 10 bits it is. Candidate F (population 12, tournament 2, one-point 0.9, pm 0.05, 10 bits, 1 elite; 100 seeds) found %: plain 88 / 27 / 63 / 98, Gray 100 / 30 / 74 / 100 (single / two / Rastrigin / Himmelblau); final diversity 0.09–0.14 (bit flips keep the population moving, unlike σ); pauses by a window of 40 that would have improved: plain 2 / 9 / 14 / 3 of 61 / 86 / 74 / 71, Gray 0 / 0 / 14 / 0 of 85 / 83 / 65 / 72; of 50: plain 0 / 5 / 9 / 2, Gray 0 / 0 / 4 / 0. With pm 0.02 instead: plain 40 / 7 / 24 / 83, Gray 100 / 23 / 30 / 100 — the Gray-against-plain contrast is sharper there.

## Proposal (awaiting the instructor)

| | now (provisional) | proposed real | proposed binary-coded |
|---|---|---|---|
| population | 20 | **12** | **12** |
| selection | tournament 3 | **tournament 2** | **tournament 2** |
| crossover | BLX-α 0.9, α 0.5 / one-point 0.8 | BLX-α **0.9**, α 0.5 | one-point **0.9** |
| mutation | per gene 0.1, σ 0.05 / flip 0.02 | per gene 0.1, σ 0.05 | flip per gene **0.05** |
| elites | 1 | 1 | 1 |
| generation limit | 100 | 100 | 100 |
| ε | 1e-3 of range | same | same |
| stagnation window | 40 | 40 (0 wrong pauses) | **50** (fewest wrong pauses) |
| bits per variable | 10 | – | 10 (not 8: Rastrigin cannot be solved) |

Why: a population of 12 is readable on the screen and in the table (and is what the tests use); tournament 2 keeps the movement visible for about ten generations; the real defaults then give the behaviours the spec asks of the harder functions (two peaks: 79 % premature convergence on the broad hill; Rastrigin: 27 % end in a local minimum and the population sits in several cells in two runs of three; Himmelblau: which of the four optima wins depends on the seed). Elites stay at 1 (without them the harder functions fail much more often).

**Decision for the instructor:** the spec asks that the *default* function finds its optimum in most but not all runs. The default is the single peak with the real coding, and it is found in 100 of 100 runs by every sensible setting (the generation limit is not the issue: the median is 10 generations). Making it fail would mean crippling the algorithm (population 6–8 with tiny σ), which would ruin the other functions. Options: (a) accept 100 % — the single peak is the example that "converges quickly", and the default binary-coded run (plain, 10 bits, pm 0.05) finds it in 88 % of runs; (b) make plain binary the default representation (88 % on the single peak, a real Hamming-cliff contrast with Gray); (c) another default function. I recommend (a).

## Answer
