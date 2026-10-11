# 11 Trap presets

Status: open
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
