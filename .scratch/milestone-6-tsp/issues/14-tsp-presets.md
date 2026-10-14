# 14 TSP presets

Status: resolved
Type: task (test-first)
Blocked by: 08, 13
Spec: ../spec.md

## What to build

The presets as data files with verified seeds, from the spec's candidates settled by the ticket 13 measurements: OX, PMX and CX on the same instance and seed; swap against inversion; no crossover; no elitism; a small population that stalls on Two clusters; the circle and the crossing tours; berlin52 against the nearest-neighbour baseline and the optimum (what a plain GA reaches in a given number of generations, as statistics over seeds). Each preset's lesson and "look for" text claims only what a test on its seed shows (including statistics over many seeds where the text says "usually"); a preset expected to fail or to stay far from the optimum says so; a demonstration that is not real for any seed is reduced to what holds or dropped.

## Done when

- Each preset has a test asserting every claim in its text on its seed, including the generation at which Run until stop pauses where a stagnation stop comes first; presets of the other problems are unchanged and each list keeps to its own problem.
- Playwright: the menu lists them with their texts, loading one restarts with its seed, the run equals the engine's, and the link of each opens the same run in a fresh page.

## Comments

## Answer

Nine presets (data files `t-` to `zb-` in `src/ui/presets/`, listed in that order under the TSP's drawer), settled by the ticket 13 measurements and by 100-seed statistics for the candidates; each text claims only what a test shows.

| file | what it is | what the text claims (seed 15 unless said) |
|---|---|---|
| `t-tsp-berlin52` | the defaults on berlin52 | ends at 8,794, 16.6 % over the optimum 7,542 and 2.1 % under the nearest-neighbour tour (8,980, 19.1 % over), which it first beats at generation 423; Run until stop pauses at 500 (the limit); over seeds 1–30 the median gap is 15.0 %, 22 of 30 runs end under the nearest-neighbour tour (none after 300 generations), none reaches the optimum |
| `u-tsp-berlin52-pmx` | PMX instead of OX | same starting population; 16.5 % (OX 16.6 %) after 500; behind at 200 (44.7 % against 37.6 %); better than OX in 17 of 30 runs and worse in 13 (15 and 15 at 200): no difference to see |
| `v-tsp-berlin52-cx` | CX instead of OX | 77.9 % at 200 (OX 37.6 %), 24.5 % at 500, never under the nearest-neighbour tour; behind OX in 30 of 30 runs at 200 and 29 at 500 |
| `w-tsp-berlin52-swap` | swap instead of inversion | 74.7 % at 200, 44.6 % at 500; a swap removes up to four edges, an inversion at most two (checked on the events); behind in 29 of 30 runs at 200 and 30 at 300 and 500 |
| `x-tsp-berlin52-no-crossover` | mutation alone | 50.4 % at 200, 19.4 % at 500 (9,005, just above the nearest neighbour); every crossover event is a bypass; OX is ahead in 25 of 30 runs at 200 and 20 at 500: crossover helps in most, not all |
| `y-tsp-berlin52-no-elitism` | no elites | the best of the generation is worse than the one before in 183 of 500 generations (never with elites, in none of 30 seeds × 500 generations); 87.9 % over at 14,168; behind in 30 of 30 runs; median 70.5 % |
| `z-tsp-berlin52-no-mutation` | no mutation, stagnation window 50 | nothing improves after generation 49, 154.2 % over at 19,173; **Run until stop pauses at generation 99** (stagnation); median 168.6 %, behind in 30 of 30 |
| `za-tsp-circle` | Circle of 15 cities, seed 2 | all 20 starting tours cross themselves (12 to 42 crossings each); the best has 12, 8, 4, 2, 1 crossings at generations 0, 10, 20, 30, 40; **pauses at generation 46** within ε: the tour is 1 2 3 … 15 with no crossing; all 30 seeds reach the optimum between generation 28 and 84 |
| `zb-tsp-clusters-swap` | Two clusters, swap, stagnation window 100, seed 3 | the best, 0.25 % over, is found at generation 26 and nothing improves for 100 generations: **pauses at generation 126**; over seeds 1–30 16 runs reach the optimum and 14 stop above it (0.25 % to 1.02 %), against 28 of 30 with inversion |

**Dropped:** "a small population that stalls on Two clusters". It is not real: a population of 6 with the default settings reaches the optimum on Two clusters in most runs (73 of 100 by generation 500, median gap 0), and one of 4 in 54 of 100. What does stall on Two clusters is the swap mutation, and that is the last preset. **Reduced:** "OX against PMX against CX" says what holds: PMX is indistinguishable from OX, CX is clearly slower. The crossover-helps claim is stated as "in most runs, not in all".

Tests (`presets-tsp.test.ts` 29, `presets-tsp-stats-a/b/c.test.ts` 8, split over three files because each is a 30-seed run of 500 generations): the list, names, order and one-sentence lessons; every file is a configuration the drawer accepts; the seven on berlin52 share the instance, the seed and the starting population and differ from the defaults only in what their name says; every number each text quotes appears in the text (a list of fragments per preset) **and** is asserted by a test — on the seed (lengths, gaps at generations 200, 300 and 500, the generation of the first win over the nearest neighbour, the worsening generations, the crossing counts of the circle, the stop generations, the edges a swap and an inversion remove) and over seeds 1–30 for every sentence with "over seeds"; the run of the tests' quick loop equals the app's run (`createRun`). Mutation checks: another seed, another stagnation window, another mutation operator and a changed generation in a text each fail the tests. `e2e/tsp-presets.spec.ts` (12): the menu lists the nine with their lesson and look-for text; loading each restarts with its seed and instance, the run equals the engine's after three generations, and its link opens the same run in a fresh page; Run until stop pauses at generation 99, 46 and 126 for the three presets whose text says so (the other six run to the limit of 500: asserted on the engine); the other problems' lists are unchanged.

Not done: the top bar with the longest preset name ("berlin52: against the nearest neighbour and the optimum") is checked in ticket 15.
