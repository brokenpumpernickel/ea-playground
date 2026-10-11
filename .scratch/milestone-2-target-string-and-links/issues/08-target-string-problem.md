# 08 Engine: the target string problem

Status: resolved
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

## Answer

`src/engine/target-string.ts`, exported from the engine:

- `targetStringProblem({ alphabet, target })` builds a `Problem`: chromosome length = the target's length; genes are positions in the alphabet; objective = fitness = positions equal to the target; known optimum = the length; no landscape; one table column, "Fitness" with the note "= matches", shown as "7 of 11"; the decoded value is the string. It throws the first validation message for invalid options.
- `validateTargetString(options)` returns every problem in words: alphabet under 2 or over 40 symbols, a symbol twice (naming it, "a space" for a space), control characters; target empty, over 24 characters, or a character outside the alphabet ("The target contains "," (position 6), which is not in the alphabet. Add it to the alphabet or remove it from the target."). Case is as typed.
- `targetStringDefaults`: alphabet `A`–`Z` and space, target **HELLO**, population 12, **tournament size 3**, one-point pc 0.8, per-gene pm 0.1, no elites, stop: limit 100, target reached, stagnation 15.

**The defaults changed from the first draft, with the instructor's agreement.** Measured over 20 seeds, the agreed `HELLO WORLD` / population 12 / roulette with Identity / pm 0.09 never reached the target in 150 generations (median best 7 of 11); even a 5-letter target needed elitism or tournaments. Measured alternatives (target reached within 100 generations): HELLO with tournament 3 and pm 0.1 in 20 of 20 seeds (median 56 generations); HELLO with roulette, 1 elite, pm 0.2 in 17 of 20; HELLO WORLD with tournament 3 and 1 elite in 2 of 20. The instructor chose the first; the spec's target-string section is updated. The throwaway mock still shows `HELLO WORLD` and roulette; it is not updated.

Tests (`target-string.test.ts`, 31): scoring on worked examples (all, none, repeats, a space, one letter, a 24-letter target over 40 symbols, the right letters in the wrong places, case); the declared optimum, columns and alphabet; every validation message and several problems at once; the defaults; and the whole GA on strings through the unchanged run layer: a seeded default run converges within the limit (seed 1), reproducibility by seed, micro-step/stage/generation/run-until make the identical run with identical regenerated events, replay of events reproduces every population (also with elites and truncation), crossover and mutation bypasses, a mutated letter always becomes a different letter with its replacement draw recorded, population size N and elites respected over 15 generations with every gene valid, truncation survivors are the best of λ and discards are listed, an odd mating pool drops its last child, copies never share arrays, all-zero fitness switches roulette to Shift and says why, and the hand-edited population with its refusal message. A deliberate break of the scoring is caught.

All 916 tests (including the 45 golden), `npm run check` and the Playwright suite pass; `src/run` has no diff.
