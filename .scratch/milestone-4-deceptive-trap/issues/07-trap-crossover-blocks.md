# 07 Crossover view: blocks kept and split

Status: resolved
Type: task (test-first)
Blocked by: 06
Spec: ../spec.md

## What to build

In the crossover view, for each offspring and each block: inherited whole from parent A, whole from parent B, or split (genes from both), derived from the recorded swap mask; marked by shape and word, with the per-pair summary ("4 blocks kept, 1 split"); bypassed pairs show no split (copies). Pure model first, then the view, for tight and loose linkage and all three operators.

## Done when

- For every offspring and block of generated runs, the model's verdict equals what the swap mask gives (property test, tight and loose, all operators, bypasses included); the per-pair summary adds up.
- Rendered check of the marks and a geometric test at both sizes for the default and for 6 × 5 loose, at every micro-step of two generations.
- The crossover view of the other problems is unchanged.

## Comments

## Answer

The crossover view marks, for each child and each block, where it came from, and says in each recombined pair's header how many blocks the cut split.

- **Model** (`src/ui/block-model.ts`): `blockOrigins(info, sources)` (whole from A, whole from B, or split, from the recorded `sources` of the child), `blockOriginNotes` (`● A`, `▨ B`, `◧ split`: a shape and a word, the hatched ▨ echoing the hatched genes of parent B), `blockSplitSummary` ("1 of 5 blocks split" / "no block split").
- **View** (`CrossoverView.svelte`): the block row over the parents and children, a note under every block of every child of a recombined pair, and a badge in the pair header (`data-testid="block-split"`). A bypassed pair, whose children are copies, gets no marks and no summary. For chromosomes of blocks the parents and children are stacked in one column (two columns do not fit 20 genes); a cut line sits in the gap between genes and no longer pushes the genes after it, so the block row stays over its cells (a cell inside a block used to be pushed onto a second line by the cut).
- **Tests**: `trap-crossover.test.ts` (13: the verdicts on hand-worked cuts, including a cut exactly between blocks and loose linkage where one cut splits all five blocks; a property test over one-point, two-point and uniform crossover, tight and loose, 12 seeds each, comparing every child and block with what the recorded sources give, including bypasses, with complementary children splitting the same blocks; the rendered notes equal the model's verdicts; no marks for a bypass or without a trap), and Playwright `e2e/trap-crossover.spec.ts` (11: for 4 × 5, 6 × 5 and 3 × 10, tight and loose, at 1920×1080 and 1366×768 in projector mode, at every micro-step of the crossover stage the grid and page do not overflow, nothing leaves its card, the block row is within 1.5 px of its cells, no chromosome wraps, every note lies under its block; and the notes on screen equal the engine's recorded verdicts for every pair).
- `npm run check` clean; 1372 unit tests and 331 Playwright tests pass (one timing-sensitive history test failed once under load and passes alone).
