# 15 Share links for the knapsack

Status: open
Type: task (test-first)
Blocked by: 12, 14
Spec: ../spec.md

## What to build

Extend the link tests to the new problem's options: every preset of all three problems; generated knapsack configurations (item sets, capacities, handling methods, ρ, hand-edited populations); and the bad-option cases (an item with a bad weight or value, too few or too many items, a capacity out of range, an unknown handling method, a missing or non-numeric ρ, options of the wrong shape), each with the drawer's own message and nothing applied.

## Done when

- Round-trip and run-equality tests for every preset and the generated configurations.
- Bad-link cases each give a readable message; a Playwright scenario opens the link of every preset of all three problems in a fresh page and compares the run with the engine's.

## Comments
