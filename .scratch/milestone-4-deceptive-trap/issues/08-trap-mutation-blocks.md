# 08 Mutation view: blocks that changed

Status: open
Type: task (test-first)
Blocked by: 06
Spec: ../spec.md

## What to build

In the mutation view, a block whose contribution changed because of a flip is marked ("block 3: 1111 → 1110, 4 → 0"), by shape and word; flips that leave the contribution unchanged are not called out; skipped mutation (bypass) shows no change. Pure model from the before and after chromosomes, then the view; per-gene and per-individual modes.

## Done when

- The model's changed blocks equal a direct recomputation of every block's contribution before and after, over generated runs for tight and loose linkage and both modes.
- Rendered check and a geometric test at both sizes for the default and 8 × 5 loose (the mutation cards must not overlap their draw labels, as in milestone 3's review).
- Other problems' mutation views are unchanged.

## Comments

## Answer
