# 07 Knapsack runs: reproducibility, operators and agreement

Status: open
Type: task (test-first)
Blocked by: 06
Spec: ../spec.md

## What to build

Run the properties milestone 1 and 2 established on seeded knapsack runs, for every handling method: identical runs by micro-step, stage, generation, run-until and every playback tier; replaying events reproduces every population (including Lamarckian rewriting) and agrees with the evaluation events; crossover and mutation bypasses, copy independence, odd mating pool, elitism, truncation and size invariants; all-negative or all-zero fitness switches roulette to Shift and says so; the best-feasible metrics and stop criteria on real runs.

## Done when

- One test file in the style of `target-string.test.ts` covering the list above for all four methods, all passing.
- Under a small ρ where an overweight bag beats the optimum, a seeded run shows fitness above the known optimum while "target reached" has not fired.

## Comments
