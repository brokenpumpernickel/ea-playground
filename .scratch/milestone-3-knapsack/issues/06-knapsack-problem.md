# 06 The knapsack problem in the engine and registry

Status: open
Type: task (test-first)
Blocked by: 03, 05
Spec: ../spec.md

## What to build

- `knapsackProblem(options)` with options `{items, capacity, handling, rho}`: chromosome length = number of items, binary alphabet, columns per handling method (Packed, Weight, Value, Feasible, Penalty where it applies, Fitness; the problem declares them as in milestone 2), score text and evaluation explanation per method, `knownOptimumFitness` = the DP value, no landscape.
- Options validation (all messages, grouped by field for the drawer as the string problem does), exported the same way as the target string's.
- A registry entry (`src/ui/problems.ts`): id `knapsack`, name, logo `Kn`, default options (the built-in instance, the decoder), `validateOptions`, `validateOptionFields`, `create`. Placeholder defaults for population, parameters and seed until ticket 13 measures them. The Goldberg and string entries do not change.
- `RunConfig` and the link codec carry the options (extend the existing options handling; the format stays v1).

## Done when

- The problem scores every bag of the built-in instance consistently with ticket 05's functions and declares its columns and sentences for each method.
- Options validation covers every message, per field; a config with knapsack options round-trips through a link; Goldberg and string links are untouched.
- The problem menu lists Knapsack and switching to it runs (views are the generic ones until ticket 08).

## Comments
