# 07 Knapsack runs: reproducibility, operators and agreement

Status: resolved
Type: task (test-first)
Blocked by: 06
Spec: ../spec.md

## What to build

Run the properties milestone 1 and 2 established on seeded knapsack runs, for every handling method: identical runs by micro-step, stage, generation, run-until and every playback tier; replaying events reproduces every population (including Lamarckian rewriting) and agrees with the evaluation events; crossover and mutation bypasses, copy independence, odd mating pool, elitism, truncation and size invariants; all-negative or all-zero fitness switches roulette to Shift and says so; the best-feasible metrics and stop criteria on real runs.

## Done when

- One test file in the style of `target-string.test.ts` covering the list above for all four methods, all passing.
- Under a small ρ where an overweight bag beats the optimum, a seeded run shows fitness above the known optimum while "target reached" has not fired.

## Comments

## Answer

`src/engine/knapsack-run.test.ts` (39 tests, all passing at once; no engine change was needed):
- For each of the four handling methods: micro-steps, stages, generations and run-until make the identical run with regenerated events equal to live ones; playback at each of the four tiers makes the identical run (without a target in that test, because playback pauses for it when the seed finds the optimum early); and the events alone reproduce every population with and without elites and truncation.
- Lamarckian repair: every individual in every population fits, its chromosome is exactly its packed set, each repaired evaluation event keeps what mutation left (equal to the mutation event's result, overweight, and the repaired chromosome only cleared genes), and the run really did repair things (initial population and later). The decoder, the penalty and Baldwinian repair never change a chromosome: no setup or evaluation event has `repairedFrom`, and offspring are exactly what mutation left.
- Operators on bags: crossover and mutation off are recorded bypasses with selection still running; a mutated gene flips 0 ↔ 1 with no replacement draw; population size and elites hold, truncation keeps N − e of λ, the odd mating pool drops the last child, children never share arrays with parents.
- Roulette: a heavy penalty (ρ = 50) gives negative fitness and the default Identity chain switches to Shift and says "Fitness is negative".
- Feasibility on real runs: the decoder and both repairs have every individual feasible every generation; under the penalty the feasible count and best equal a direct count (and some bags are overweight); under ρ = 0 an overweight bag beats the optimum 123 (best fitness above 123) while `target-reached` holds exactly when a feasible bag reaches 123 (and it never does there); with Lamarckian repair at least one of 12 seeds reaches the optimum and `target-reached` then holds with a feasible best of 123.

State: 1147 unit tests, `npm run check` clean.
