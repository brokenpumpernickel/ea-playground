# 04 Roulette selection, mating pool, pairing

Status: open
Type: task (test-first)
Blocked by: 03
Spec: ../spec.md

## What to build

The selection and pairing stages with roulette-wheel selection and the Identity weight (the chain arrives in 05):

- Selection probabilities from selection weights; N − k independent spins with replacement, each recorded with its random number and the individual it landed on.
- The mating pool of N − k parents (k = elite count; use 0 until 09).
- Pairing: neighbours in the pool, recorded as explicit pairs. An odd pool records the last pair's dropped child as a pending note for the crossover stage.
- All draws for the generation come from the generator in a fixed order, recorded as events (ADR 0001).

## Tests (write first)

- On the textbook population the probabilities are about 0.144, 0.492, 0.055, 0.309 and sum to 1.
- Pool size is N − k; pairs are the pool's neighbours in order.
- The same seed gives the same pool; over many seeded draws the observed frequencies match the probabilities within a stated tolerance.
- Zero total weight is rejected with a message rather than producing NaN.

## Comments
