# 06 The knapsack problem in the engine and registry

Status: resolved
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

## Answer

**Engine** (`src/engine/knapsack.ts`): `KnapsackOptions { items, capacity, handling, rho }`, `knapsackProblem(options)` (throws the first message for invalid options) returning a `KnapsackProblem`: 12 binary genes (one per item), `knownOptimumFitness` = the DP value (123 for the built-in instance), no landscape, `evaluate` = `handleBag(...).scores`, and `outcomeOf(chromosome)` which gives the views the full `BagOutcome` (skipped and dropped items, penalty). `validateKnapsack` and `validateKnapsackFields` (messages under `items`, `capacity`, `handling`, `rho`), `knapsackRhoLimits` (ρ from 0 to 1000), `knapsackDefaults`, all exported from the engine index.

**Columns and sentences** (declared by the problem, as the string problem does): Weight (note "of 48"; "48/48 ✓" or "49/48 ✗ +1"; recomputed from the packed letters in `decoded`, so the columns need nothing but the scores), Value, Penalty (penalty method only; "0" or "−4"), Fitness (a real minus sign). Score text: "packs B, C, D: weight 18 of 48, value 58", "packs nothing: …", and for an overweight bag "…, over by 1 → penalty 4". Each method has its own evaluation explanation (the mock's wording; the penalty one names ρ).

**Registry and link** (`src/ui/problems.ts`): `ProblemOptions` is now `TargetStringOptions | KnapsackOptions` with `isStringOptions`, `isKnapsackOptions` and `targetOf` helpers (the views and the drawer model that assumed string options use them; their behaviour is unchanged). The knapsack entry: id `knapsack`, name "Knapsack", logo `Kn`, subtitle "12 items · capacity 48 · optimum 123", default options (a copy of the built-in instance, decoder, ρ = 4), structural validation in words ("options.items[2].weight" must be a number, unknown or missing keys, …) followed by the instance and handling rules, `validateOptionFields` for the drawer, and placeholder defaults (population 12, tournament 3, pc 0.8, pm 0.08, limit 60, target 123, stagnation 30) that ticket 13 replaces by measurement. The share-link format needed no change (v1, options validated through the entry); the problem menu lists Knapsack as the third entry. Until ticket 08 the knapsack uses the generic views (gene-share panel "ones", the problem's own columns).

**Tests:** `knapsack.test.ts` (16: problem facts, scores for each method, the columns and sentences hand-worked, validation per field, defaults), `problems-knapsack.test.ts` (5: defaults are a copy, subtitle, every structural message, grouping by field), `run-config-knapsack.test.ts` (10: each handling method and a hand-edited population on another instance round-trip and open as the same run, populations, events and metrics; the bad-link cases — item weight and value, too few and too many items, capacity out of range, unknown handling, ρ, wrong shape, strings of the wrong length or alphabet, a crossover that does not fit 2 items, several problems together). Four older tests and one e2e that used "knapsack" as an unknown problem now use "tsp"; the menu test lists three problems.

State: 1108 unit tests, `npm run check` clean, 160 Playwright tests passing.
