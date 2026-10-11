# 02 The trap problem in the engine

Status: open
Type: task (test-first)
Blocked by: 01
Spec: ../spec.md

## What to build

The trap as an engine `Problem`, with no change to any existing problem (golden runs unchanged, run before and after): options `{blockSize k, blocks m, linkage}`; validation of them with messages that name the field (k 2–8, m 1–10, at most 40 genes in all, linkage tight or loose); gene ownership by block (tight: contiguous; loose: block b owns genes b+1, b+1+m, …); the Deb–Goldberg contribution of a block (k if all ones, otherwise k − 1 − u); the problem's scores (objective = fitness = sum of contributions, decoded as the ticket 01 decision says, `knownOptimumFitness` = k × m); columns; and a way for the views to ask which genes a block owns and what a chromosome's per-block counts and contributions are (as `outcomeOf` serves the knapsack).

## Done when

- Contributions checked on hand-worked blocks for several k, every u from 0 to k; fitness on hand-worked chromosomes (all ones, all zeros, mixed) for tight and loose linkage.
- The known optimum equals brute force over all chromosomes for small k × m; all zeros scores m × (k − 1); ownership is a partition of the genes for generated k, m and linkage (property test); fitness equals the sum of contributions.
- Validation: every bad option gives a readable message naming the field; defaults are valid.
- Golden runs reproduce exactly; `npm run check` clean.

## Comments

## Answer
