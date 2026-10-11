# 08 Mutation view: blocks that changed

Status: resolved
Type: task (test-first)
Blocked by: 06
Spec: ../spec.md

## What to build

In the mutation view, a block whose contribution changed because of a flip is marked ("block 3: 1111 → 1110, 4 → 0"), by shape and word; flips that leave the contribution unchanged are not called out; skipped mutation (bypass) shows no change. Pure model from the before and after chromosomes, then the view; per-gene and per-individual modes.

## Done when

- The model's changed blocks equal a direct recomputation of every block's contribution before and after, over generated runs for tight and loose linkage and both modes.
- Rendered check and a geometric test at both sizes for the default and 6 × 5 loose (the mutation cards must not overlap their draw labels, as in milestone 3's review).
- Other problems' mutation views are unchanged.

## Comments

## Answer

The mutation view says, under each offspring's result, which blocks the mutation changed, and (the instructor's decision in the mock) which blocks it touched without changing.

- **Model** (`src/ui/block-model.ts`): `blockMutation(info, before, after)` gives, in block order, the **changed** blocks (the block's genes in its own order before and after, its score before and after) and the **cancelled** blocks (genes flipped but the same number of 1s, so the same score; the trap's score is a strictly one-to-one function of the number of 1s, so this is exactly "touched but not changed"); `describeChange` ("block 3: 0100 → 1110 · 2 → 0") and `describeCancel` ("block 3: genes 10 and 11 flipped but the block still has 1 one, so it still scores 2").
- **View** (`MutationView.svelte`): an orange badge ✱ per changed block (`data-testid="block-change"`) and a dashed grey badge per cancelled block (`block-cancel`), for both per-gene and per-individual mode, in the cards and in the table of a short chromosome; nothing for an unchanged offspring or for a switched-off mutation. The block row now also sits over the cards' top row. To make room for the draw under every gene, the top row's gene columns are 8 px wider than the cells up to 20 genes (`drawExtra`, shared by the cells and the block row so they stay aligned), the draw loses its leading 0 (.281), and above 20 genes only the draws that flipped a gene are printed, cut (not rounded) to two decimals so that they stay below the threshold they were compared with (decision of the mock).
- **Tests**: `trap-mutation.test.ts` (12: hand-worked cases including a cancel, several blocks and loose linkage; a property test over both modes, both linkages and 15 seeds each comparing the changed blocks, their scores and the partition (changed + cancelled = blocks with flipped genes) with a direct recomputation from the engine's before and after; the rendered badges), `block-geometry` and `trap-views` additions, and Playwright `e2e/trap-mutation.spec.ts` (13: for 4 × 5, 6 × 5, 3 × 10 and 2 × 2 (the table path), tight and loose, at both sizes in projector mode, at every micro-step of the mutation stage the cards and page do not overflow, the block row is within 1.5 px of the cells, no chromosome wraps, draws stay in their column (up to 20 genes) or do not overlap each other (above 20), and no draw touches a star; and the badges say their words). The geometry spec found three real problems (draw columns not widened until the draws existed, draws wider than 15 px columns, adjacent flipped draws overlapping) and they are fixed.
- `npm run check` clean; 1388 unit tests and 345 Playwright tests pass.
