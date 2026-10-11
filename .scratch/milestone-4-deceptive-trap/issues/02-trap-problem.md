# 02 The trap problem in the engine

Status: resolved
Type: task (test-first)
Blocked by: 01
Spec: ../spec.md

## What to build

The trap as an engine `Problem`, with no change to any existing problem (golden runs unchanged, run before and after): options `{blockSize k, blocks m, linkage}`; validation of them with messages that name the field (k 2–8, m 1–10, at most 30 genes in all, linkage tight or loose); gene ownership by block (tight: contiguous; loose: block b owns genes b+1, b+1+m, …); the Deb–Goldberg contribution of a block (k if all ones, otherwise k − 1 − u); the problem's scores (objective = fitness = sum of contributions, decoded as the ticket 01 decision says, `knownOptimumFitness` = k × m); columns; and a way for the views to ask which genes a block owns and what a chromosome's per-block counts and contributions are (as `outcomeOf` serves the knapsack).

## Done when

- Contributions checked on hand-worked blocks for several k, every u from 0 to k; fitness on hand-worked chromosomes (all ones, all zeros, mixed) for tight and loose linkage.
- The known optimum equals brute force over all chromosomes for small k × m; all zeros scores m × (k − 1); ownership is a partition of the genes for generated k, m and linkage (property test); fitness equals the sum of contributions.
- Validation: every bad option gives a readable message naming the field; defaults are valid.
- Golden runs reproduce exactly; `npm run check` clean.

## Comments

## Answer

The trap is `src/engine/trap.ts` (tests `src/engine/trap.test.ts`, 37), exported from `src/engine/index.ts`. Nothing existing was changed.

- **Options** `TrapOptions {blockSize, blocks, linkage}`; `trapLimits` (k 2–8, m 1–10, at most 30 genes: the ticket 01 decision); `trapDefaultOptions` = 4 × 5, tight.
- **Validation** `validateTrapFields` gives the messages per field (`blockSize`, `blocks`, `linkage`, and `genes` for the total), `validateTrap` the flat list; the total is only reported when both sizes are themselves valid, so a bad size is named once. Messages as the drawer will show them, for example "Block size × blocks: at most 30 genes in all (8 × 6 = 48)."
- **Ownership** `problem.blockGenes`: tight blocks are contiguous; loose block b owns genes b, b + m, b + 2m, … (0-based).
- **Scores**: `decoded` is the number of 1s per block ("4 · 0 · 3 · 1 · 2", the ticket 01 decision), `objective = fitness = ` the sum of the Deb–Goldberg contributions; `knownOptimumFitness = k × m`; `attractorFitness = m × (k − 1)`. Columns Decoded (optional, note "1s per block") and Fitness; `scoreText` ("ones per block 4 · 0 · 1 · 0 · 4 → 4 + 3 + 2 + 3 + 4 = 16"), `evaluationExplanation`.
- **`outcomeOf(chromosome)`** for the views: per block its genes, ones, contribution and state (`optimum`, `attractor`, `between`), and the fitness.

Evidence: contributions for every u at k = 4 (3, 2, 1, 0, 4) and the shape of the trap for k = 2, 3, 5, 8; hand-worked chromosomes tight (20, 15, 16, 10) and loose (the same string scores 6); brute force over all chromosomes for seven small sizes and both linkages finds the optimum only at all ones, all zeros scoring m × (k − 1) and the lowest fitness 0; ownership is a partition for every valid size and both linkages; fitness equals the sum of contributions on generated chromosomes; ten bad-option cases with their messages. Mutation checks (changing the trap formula, the loose interleave and the block state) each made tests fail. Golden runs are unchanged (`golden.test.ts` passes), `npm run check` is clean, 1270 unit tests pass.
