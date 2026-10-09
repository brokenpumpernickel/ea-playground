# 21 Presets and the textbook acceptance check

Status: open
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
