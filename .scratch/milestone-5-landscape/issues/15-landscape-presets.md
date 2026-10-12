# 15 Landscape presets

Status: resolved
Type: task (test-first)
Blocked by: 07, 14
Spec: ../spec.md

## What to build

The presets as data files with verified seeds, from the spec's candidates settled by the ticket 14 measurements: single peak, two peaks (premature convergence), Rastrigin, Himmelblau, mutation too small, arithmetic crossover, BLX-α against α = 0, and, only where a real seed shows it, Gray against plain binary and real against binary-coded. Each preset's lesson and "look for" text claims only what a test on its seed shows (including statistics over many seeds where the text says "usually"); a preset expected to fail says so; a demonstration that is not real for any seed is reduced to what holds or dropped.

## Done when

- Each preset has a test asserting every claim in its text on its seed, including the generation at which Run until stop pauses where a stagnation stop comes first; presets of the other problems are unchanged and each list keeps to its own problem.
- Playwright: the menu lists them with their texts, loading one restarts with its seed, the run equals the engine's, and the link of each opens the same run in a fresh page.

## Comments

## Answer
Ten presets, as data files `src/ui/presets/j…s-landscape-*.json`, each at the approved defaults except for the one thing its lesson changes:

1. **Single peak** (seed 42): stops at the target in generation 10; all 100 seeds reach it, median 10 generations.
2. **Two peaks: the broad hill** (42): ends on the broad hill (fitness 0.6); 84 of 100 seeds end there, 16 find the narrow one.
3. **Rastrigin: local minima** (2): ends in the minimum next to the global one (−0.995 at (0.00, −0.99)); 81 of 100 seeds reach ε; seed 42 reaches it in generation 19.
4. **Himmelblau: four optima** (42): generation 8 at (3, 2); over 100 seeds the four optima win 45 / 18 / 9 / 28 times.
5. **Mutation too small** (42, Rastrigin, σ = 0.005): ends in a local minimum at (2, 1); the same seed with σ = 0.05 reaches the global minimum in generation 19; 13 against 81 of 100 seeds.
6. **Arithmetic crossover** (42, mutation off): the box around the population never grows (in all 100 seeds), stagnation pause at generation 56 with best so far 0.976; 17 of 100 reach ε, 80 stop for stagnation.
7. **BLX-α with α = 0** and 8. **BLX-α with α = 0.5** (42 → seed 8, Himmelblau, mutation off): with α = 0 the box never grows (100 of 100 seeds) and the run pauses at generation 79 for stagnation at −9.94; with α = 0.5 the same seed reaches ε in generation 6; 37 against 66 of 100 seeds.
9. **Plain binary, low mutation** and 10. **Gray code, low mutation** (42, single peak, 10 bits, pm 0.02): plain pauses at generation 75 for stagnation at 0.881 at (2.00, 0.00) and none of the 20 one-bit changes of its best individual is better; Gray reaches ε in generation 39; 33 against 100 of 100 seeds.

Every claim of every text is asserted on its seed in `presets-landscape.test.ts` (25 tests: the defaults-except-the-change comparison for each file, the generation at which Run until stop pauses and why, the best point and fitness, diversity, the box never growing or growing, the one-bit neighbours, and the statistics over seeds 1 to 100), and a test checks that each text states those figures. Mutation-checked: moving any preset's seed, elites, mutation switch or tournament size fails the tests.

**Dropped, as the spec allowed:** *Real against binary-coded* — measured, the two representations reach the optimum about equally often on the functions here (Rastrigin 71 against 63 to 74 per cent, Himmelblau 100 against 98 to 100), so there is no demonstration that holds beyond speed; students can compare them by switching the representation in the drawer. **Reduced:** the Gray-against-plain pair uses a low mutation rate (0.02), since at the default 0.05 the contrast is 88 against 100 per cent; the text says so. The α pair and the arithmetic preset switch mutation off, which the texts state, because with mutation on α = 0 and arithmetic crossover make almost no difference in success (measured).

`e2e/landscape-presets.spec.ts` (13): the menu lists the ten with their lessons and texts; each preset loads with its seed, name, representation chip and the engine's run for three generations, and its share link opens the same run in a fresh page; Run until stop pauses in each at the generation the text names (10, 100, 100, 8, 100, 56, 79, 6, 75, 39); the other problems' lists are unchanged. `run-config-strings.test.ts` and `e2e/string-link.spec.ts` now count the ten landscape presets and compare their runs (by summary line, as real-valued individuals have no bit rows).
