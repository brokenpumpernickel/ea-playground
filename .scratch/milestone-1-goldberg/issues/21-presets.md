# 21 Presets and the textbook acceptance check

Status: resolved
Type: task
Blocked by: 20
Spec: ../spec.md

## What to build

- Presets as plain data files (full configuration plus seed), with a menu in the UI and a one-sentence lesson per preset:
  - **Textbook population**: N = 4, population 01101, 11000, 01000, 10011, one-point crossover, pc = 1.0, pm = 0.001, no elites.
  - **No crossover**, **No mutation**, **High mutation**: each chosen with a seed that shows the effect, with the description saying what to look for, and stating plainly when a run is expected to stall or fail.
- Loading a preset resets the run with that configuration.
- The acceptance check from the spec: the textbook preset shows fitness 169, 576, 64, 361; total 1170; average 292.5; maximum 576; selection probabilities about 0.144, 0.492, 0.055, 0.309.

## Done when

- A Playwright test loads the textbook preset and checks the numbers above on screen.
- The expected-failure presets are verified to behave as their descriptions say for their seeds.
- Adding a preset needs only a new data file.

## Comments

## Answer

Presets are plain JSON files in `src/ui/presets/` (`name`, one-sentence `lesson`, `lookFor`, `seed`, `setup`, `params`), read at build time with `import.meta.glob` and checked by `presetFromData`, which refuses a malformed file with a message naming the file and the field. Adding a preset is adding a file; nothing else changes. The drawer has a **Presets** section at the top (menu, the lesson, "Look for: …", and **Load preset**). Loading goes through the same restart notice as other setup changes ("Loading the preset “High mutation” restarts the run from generation 0 and discards the 3 recorded generations (1–3).") and sets the seed, population, and every parameter together. The toolbar subtitle then reads "preset: <name>" until a setting is changed by hand.

Presets and what each is verified to do (by `src/ui/presets.test.ts`, against the engine, for the preset's own seed):
- **Textbook population** (seed 88, N = 4: 01101 11000 01000 10011, one-point, pc = 1, pm = 0.001, no elites): fitness 169, 576, 64, 361; total 1170; average 292.5; best 576; selection probabilities 0.144, 0.492, 0.055, 0.309; in generation 1 both pairs recombine and exactly one gene (gene 3) mutates, as the description says.
- **No crossover** (seed 888): every pair of every generation is a switched-off bypass; the best is still 900 (11110) after 50 generations. The description says only what holds for this seed (a random seed usually finds 961 anyway), so it does not claim crossover-free runs fail in general.
- **No mutation** (seed 4): no individual starts with a 1 in gene 1, its share of 1s stays 0 for all 50 generations, diversity reaches 0 by generation 30, and the best is 225 (01111, x = 15). The description says the run is expected to stall there.
- **High mutation** (pm = 0.3, seed 4): best of generation is below best so far in 23 of the first 30 generations and mean diversity over generations 15–30 stays above 0.3. The description says plainly that this run can still find the optimum by luck, which is not convergence. (I searched 4000 seeds for one that fails to reach 961 at pm = 0.3 and found none that also showed the dips, so I chose a truthful description over a failing run.)

Seeds were found by searching, not guessed. Mutations of a preset's seed and of pm are caught by the verification tests.

Playwright (`e2e/presets.spec.ts`, 6 tests): the menu with lessons; the textbook numbers on screen (fitness, x, Σ 1170 · avg 292.5 · best 576, then 0.144/0.492/0.055/0.309 in the selection stage); the textbook seed's two recombined pairs and one flipped gene 3; the no-mutation run reaching best so far 225 with gene 1 at share 0 and one distinct chromosome; no crossover showing three bypassed pairs; and the notice, the label and the hand-edit that clears it.
