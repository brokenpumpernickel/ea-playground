# 08 Engine: the target string problem

Status: open
Type: task (test-first)
Blocked by: 05, 06, 07
Spec: ../spec.md

## What to build

The second problem, in `src/engine`:

- Options: an alphabet (ordered, distinct symbols, 2–40) and a target (1–24 characters, every character in the alphabet, case-sensitive as typed). Validation returns readable messages naming the offending character, duplicate or limit. Chromosome length is the target's length.
- Objective value is the number of positions equal to the target; fitness equals it (identity). Known optimum: the target's length. No `landscape`. Table columns: matches (shown like "7 of 11") and fitness; no decoded column.
- Defaults (also the first entries of the problem registry's data): alphabet `A`–`Z` and space, target `HELLO WORLD`, population 12, one-point crossover pc 0.8, per-gene mutation pm 0.09, no elites, roulette with Identity; stop: generation limit 100, target reached, stagnation 15. All-zero fitness uses the existing automatic switch to Shift.
- Works through `gaAlgorithm` and the unchanged run layer: a seeded run is reproducible by micro-step, stage, generation and run-until.

## Done when

- Scoring on hand-worked examples: all matching, none, repeated letters, a space, a one-letter target, a 24-letter target, a 40-symbol alphabet.
- Validation messages for each invalid option.
- Reproducibility across granularities and tiers, event/result agreement by replay, the bypass, copy-independence, elitism, truncation and size invariants for strings (the milestone 1 criteria re-run for this problem).
- A seeded default run converges to `HELLO WORLD` within the generation limit (record the seed and generation count in the test).

## Comments
