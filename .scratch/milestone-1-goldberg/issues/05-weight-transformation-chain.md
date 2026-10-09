# 05 Weight transformation chain

Status: open
Type: task (test-first)
Blocked by: 04
Spec: ../spec.md

## What to build

The ordered chain from raw fitness to selection weights, as a small registry so adding a step is one function plus a parameter description:

- Steps: Identity, Shift (fitness − min + ε), Rank (1 = worst, ties get the average rank), Linear ranking (selection pressure s in [1, 2]), Power (exponent).
- A validator that rejects chains whose output is not non-negative or has a zero sum, and returns a reason a student can read.
- Auto-switch: when the chain starts as Identity and raw fitness has negatives, switch to Shift and record that it happened and why.
- Every step's intermediate values are recorded, so the selection view can show one column per step (`raw fitness → step 1 → … → weight → probability`).
- Defaults for ε, s and the exponent chosen here and recorded in the spec.

## Tests (write first)

- Each step against hand-computed values, including ties under Rank and the bounds of s.
- Chains of several steps in different orders.
- Validator rejects all-zero and negative outputs with distinct reasons.
- Negative raw fitness under Identity switches to Shift and records the banner event; positive fitness does not.
- The weights recorded are the ones roulette actually used.

## Comments
