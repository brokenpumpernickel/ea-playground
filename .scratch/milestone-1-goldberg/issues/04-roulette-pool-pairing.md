# 04 Roulette selection, mating pool, pairing

Status: resolved
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

## Answer

Done test-first (seams agreed with the instructor beforehand). 57 engine tests pass; `npm run check` is clean.

Public interface (`src/engine/index.ts`):

- `rouletteSelect(population, weights, count, rng)` → `{ pool, events }`. The caller supplies one weight per individual (this ticket passes fitness, i.e. Identity; ticket 05's chain will supply its output). `pool` is the selected individuals' ids in spin order. Events: one `probabilities` event (per individual: weight, probability, interval `[lo, hi)`), then one `spin` event per spin (`spin`, `r`, `individualId`).
- `matingPoolSize(offspringCount)` → the number of parents to draw: the count rounded up to even.
- `pair(pool, offspringCount)` → `{ pairs, events }`. Pairs are neighbours (slots 1+2, 3+4, …); each carries slots, both parent ids, and `secondChildDropped` for the last pair when the offspring count is odd. Pairing makes no random draws.

Decisions made here:

- **Odd offspring count: draw one extra parent** (agreed with the instructor over wrapping to parent 1). `matingPoolSize(5)` is 6, and the last pair's second child is dropped. Recorded in `CONTEXT.md` under Mating pool. The generation loop (ticket 09) should call `matingPoolSize(offspringCount)` for the spin count and `pair(pool, offspringCount)`.
- **Validation lives in selection.** Negative or non-finite weights, an all-zero total, the wrong number of weights, and a non-whole spin count are all refused with messages naming the individual. Nothing is silently shifted; ticket 05's auto-switch to Shift must happen before weights reach this function.
- **Interval edges:** an individual is picked when `lo ≤ r < hi`. Zero-weight individuals have empty intervals and are never picked. Floating-point rounding can leave the last `hi` a hair below 1, so a draw past every edge falls to the last individual with weight (tested with the largest possible draw over 500 random weight sets). The displayed `hi` of the last entry may therefore be 0.9999999999999999 rather than 1.
- **Draw order:** exactly one draw per spin, in order, so stages after selection continue the same sequence (tested by comparing the next draw with a reference sequence).
- Tests use a scripted generator (a plain `Rng` returning fixed draws) to replay the mock's worked example: r = 0.58, 0.07, 0.91, 0.31 gives pool 2, 1, 4, 2 and pairs (2, 1) and (4, 2).

Not covered here and left for later tickets: the weight chain's intermediate columns and auto-switch banner (05), tournament selection (06), and the mating-pool size with elites (09).

## Comments
