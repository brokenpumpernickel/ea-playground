# 15 Landscape presets

Status: open
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
