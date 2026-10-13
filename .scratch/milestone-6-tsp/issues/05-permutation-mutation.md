# 05 Swap, inversion and insertion mutation

Status: resolved
Type: task (test-first)
Blocked by: 03
Spec: ../spec.md

## What to build

The three permutation mutations as engine operators with their events: **per individual** (one draw u against pm decides; then the positions are drawn in a documented order and recorded), **swap** (two distinct positions exchanged), **inversion** (the slice between two positions reversed, a 2-opt move) and **insertion** (the city at one position removed and put at another). Mutation off leaves the chromosome unchanged; a bypass is recorded as such; the refusal rules as for crossover (flip and Gaussian for a permutation, and these for the others).

## Done when

- Hand-worked cases and property tests: every result is a permutation that differs from the original in exactly the positions the event states (swap: two; inversion: the slice; insertion: the span between the two positions); inversion changes exactly two edges, swap at most four, insertion at most three (for non-adjacent positions), which the event reports as the edges removed and added.
- pm = 0 and pm = 1; n = 3; no shared arrays; reproducible by seed.

## Comments

## Answer
`swap`, `inversion` and `insertion` are `MutationOperator`s (with `permutationMutationOperators`), and `mutate(…, bounds, permutation)` takes the problem's representation; `generation.ts` passes `problem.permutation` to crossover and mutation. Built test-first in `src/engine/mutation-permutation.test.ts` (20 tests):

- **Draws**, in this order: one u per individual against pm; only when u < pm, r1 then r2: i = ⌊r1·n⌋ and, of the other n − 1 positions in order, the ⌊r2·(n − 1)⌋-th, j (so j ≠ i). Swap and inversion use the two sorted; insertion takes the city at i out and puts it at position j (a direction). A switched-off mutation draws nothing and is a bypass; pm 0 and 1 hand-checked.
- **Hand-worked on 1 2 3 4 5**: swap of positions 2 and 5 gives 1 5 3 4 2; inversion of the slice 2 to 4 gives 1 4 3 2 5; insertion of the city at 2 to position 5 gives 1 3 4 5 2, and of the last city to the front gives 5 1 2 3 4.
- **Events** keep the usual fields (mode `per-individual`, decision, threshold, `individualDraw`, before and after, `flipped` = the positions whose city changed, from 1) and add `move` (kind, the two positions 0-based, the draws) and `edges` (removed and added, as pairs of cities in tour order). Reversing everything but the first city is shown to remove and add no edge: it is the same route read the other way.
- **Properties** over generated tours (n = 2, 3, 5, 9, 20, 52; 30 seeds; all three operators): the result is a permutation; swap changes exactly the two positions, inversion exactly the slice (reversed) and insertion equals remove-and-insert; `flipped` equals the positions that differ; the reported edges equal the set difference computed directly; for n ≥ 4 inversion changes at most two edges, swap four, insertion three, and as many are added as removed; over 400 seeds every one of the 6 unordered (swap) and 12 ordered (insertion) position pairs of four cities occurs; the input is untouched and the event keeps its own copies.
- **Refusals in words**: flip and Gaussian for a permutation ("… would repeat and lose cities; choose swap, inversion or insertion mutation for this problem"), no operator named for a permutation, per-gene mode for a permutation ("Per-gene mutation has no meaning for a permutation, whose genes are not independent; use per individual mutation"), the permutation operators for the other problems; two cities at least (the tour of one city is refused only when mutation is on).
- **A whole generation** (the follow-up from ticket 04): every crossover (OX, PMX, CX) with every mutation over 15 generations of 8 cities gives permutations only, the events carry the operators that ran, a symbol crossover on a permutation problem is refused by `runGeneration`, and a seeded run is the same run each time.

Mutation-checked (16 mutants: both position draws and the distinctness rule, the sorting, the inversion slice, the swap and insertion arithmetic, the decision draw and its bypass, both edge lists, the per-gene refusal, the minimum size and the three representation pass-throughs in `generation.ts`, including the two that ticket 04 left uncovered): each fails a test. Golden runs unchanged; `npm run check` clean; the whole unit suite passes.
