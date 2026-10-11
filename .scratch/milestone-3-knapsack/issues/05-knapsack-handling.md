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
