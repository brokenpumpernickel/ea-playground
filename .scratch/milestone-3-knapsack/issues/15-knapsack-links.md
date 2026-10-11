# 15 Share links for the knapsack

Status: resolved
Type: task (test-first)
Blocked by: 12, 14
Spec: ../spec.md

## What to build

Extend the link tests to the new problem's options: every preset of all three problems; generated knapsack configurations (item sets, capacities, handling methods, ρ, hand-edited populations); and the bad-option cases (an item with a bad weight or value, too few or too many items, a capacity out of range, an unknown handling method, a missing or non-numeric ρ, options of the wrong shape), each with the drawer's own message and nothing applied.

## Done when

- Round-trip and run-equality tests for every preset and the generated configurations.
- Bad-link cases each give a readable message; a Playwright scenario opens the link of every preset of all three problems in a fresh page and compares the run with the engine's.

## Comments

## Answer

The codec needed no change (ticket 06 had already made the options part of the configuration, validated by the entry's rules); this ticket tested it hard.

- **Round trips and run equality:** every preset of all three problems (each with its own problem and options, `run-config-strings.test.ts`, and in the browser `string-link.spec.ts`, which now also opens the five knapsack presets in a fresh page and compares three generations with the engine); the default configuration of each problem; each handling method and a hand-edited population on another instance (`run-config-knapsack.test.ts`); and **200 generated knapsack configurations** (2 to 20 items, weights 1–99, values 1–999, capacities from the lightest item to the total weight, every method, ρ from 0 to 1000 including fractions, tournament and roulette with several chains, every crossover operator that fits the item count, both mutation modes, truncation, stop settings, random and hand-edited populations): every one round-trips to an equal configuration and every tenth opens as the same run (populations, events, metrics).
- **Bad links**, each with the drawer's own message and nothing applied (`run-config-knapsack.test.ts` and, in the browser, `e2e/knapsack-link.spec.ts`, 12 cases): an item with weight 0 or a value above 999, a single item, 21 items, a capacity above the total weight or 0, an unknown method, ρ negative, as text or missing, no options at all, a hand-edited bag of the wrong length. Several problems in one link are listed together, and nothing of the good parts is used. The default Goldberg configuration opens, the seed is the default's, playback does not start and the address is cleared.
- **Fresh page:** for each of the four methods, a link of a configured run (9 items, capacity 30, ρ 3.5, two-point crossover, per-individual mutation, three hand-edited bags) opens as the same run for three generations with the same handling, capacity and items in the drawer; a link with 20 items and a very different instance opens, plays and fits the screen. Copy link then open was already covered by `knapsack-setup.spec.ts`.

State: 1231 unit tests, `npm run check` clean, 248 Playwright tests.
