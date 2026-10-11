# 05 The four constraint-handling methods

Status: open
Type: task (test-first)
Blocked by: 02, 04
Spec: ../spec.md

## What to build

The evaluation of a chromosome for each method, as the spec states them:
1. First-fit decoder: walk the items in order, pack an item if its gene is 1 and it fits; genes of skipped items stay 1; the chromosome is unchanged.
2. Penalty: the packed set is the genes set to 1; `fitness = value − ρ × excess weight`; objective = value.
3. Repair, Lamarckian: drop the packed item with the lowest value per weight (ties to the later item) until feasible; the repaired chromosome replaces the original (the `repaired` score detail from ticket 02).
4. Repair, Baldwinian: the same rule; the chromosome is left; the repaired bag is scored.
Each returns the scores plus what the views need to explain it: the packed set, the dropped or skipped items in the order they were dropped or skipped, weight, penalty.

## Done when

- Hand-worked cases for each method: penalty exactly at capacity has none and one unit over costs ρ; the decoder skips an item that does not fit and still packs a later one that does; repair drops the lowest ratio first, ties to the later item, and stops as soon as the bag fits; Lamarckian rewrites, the others never change a chromosome.
- Property tests over generated instances and chromosomes: decoder and both repairs always give a feasible packed set; repair never drops more than needed; with a feasible chromosome all four methods agree on the packed set (penalty is zero).
- Fitness and objective are as the spec defines for each method, including negative penalty-method fitness.

## Comments

## Answer

`src/engine/knapsack-handling.ts`: `Handling` (`'decoder' | 'penalty' | 'repair-lamarckian' | 'repair-baldwinian'`), `handlings`, and `handleBag(instance, handling, rho, chromosome)`, which returns a `BagOutcome`: the genes after handling, the packed set, weight, value, excess, penalty, feasibility, fitness and objective, what the decoder skipped (item, its weight and the room left when it was reached), what repair dropped (item and value per weight, in order), the repaired chromosome (Lamarckian only, only when something was dropped) and the `Scores` in the engine's form (decoded = the packed letters, `feasible`, and `repaired` for Lamarckian). The views will recompute an outcome from a chromosome, so the explanation is never stored in the engine's state.

Rules as the spec states them, with two details fixed here: repair compares values per weight by cross-multiplication (exact, no floating-point ties), and a tie goes to the later item; the decoder walks A, B, C, … and records the room left at each skip. ρ must be a finite number of at least 0 (the drawer's own range is ticket 06's); a chromosome of the wrong length is refused.

**Tests** (`knapsack-handling.test.ts`, 22; worked by hand on the built-in instance): penalty at exactly the capacity (A, B, C, E, F: 48, 73, no penalty), one over (A, B, E, F, G: 49, 59, penalty 4, fitness 55), everything on (97, 49 over, penalty 196, fitness −25, so fitness can be negative), non-integer ρ; decoder with everything on packs A, B, C, D, E, G, H (46, 88), skips F (14 > 11 left), I, J, K, L in order and still packs G after skipping F, never changes genes; repair with everything on drops A, E, I, L, F in that order (ratios 0.44, 0.50, 0.73, 1.46, 1.64) leaving B, C, D, G, H, J, K (40, 112), stops as soon as the bag fits (over by 1 drops only A), a tie goes to the later item, a chromosome that fits is untouched, Lamarckian writes the genes of the dropped items as 0 while Baldwinian keeps the chromosome; the scores the engine sees. Properties over 300 generated instances and chromosomes: decoder and both repairs are always feasible and use only items whose genes were on, repair never drops more than needed, a chromosome that fits is packed as it is by all four methods with no penalty, skip or repair, Lamarckian and Baldwinian agree on packed set and score, and nothing feasible beats the DP optimum. A mutation of the tie rule failed the tie test.

State: 1076 unit tests, `npm run check` clean.
