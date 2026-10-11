# 06 Block row, population table and chromosome names

Status: resolved
Type: task (test-first)
Blocked by: 01, 04
Spec: ../spec.md

## What to build

As decided in the mock (ticket 01): the block row above the chromosome columns, aligned with the gene cells for both linkages; the block contributions printed beneath each chromosome's blocks; the optimum and attractor marks (shape and word as well as colour); the table's Decoded and Fitness columns; an accessible name and sentence for each chromosome ("blocks 4 · 0 · 3 · 1 · 2, contributions 4 · 3 · 0 · …"). Pure models first (the block row, the per-chromosome block states), then the views, applied to every table that shows chromosomes (population, parents, evaluation, replacement).

## Done when

- Unit tests of the models and the server-rendered views against the engine's per-block numbers; rendered checks that the block row lines up with the gene cells (tight and loose, 20 and 30 genes); a geometric test at 1920×1080 and 1366×768 that no table is wider than its panel and no label overlaps another, for the default and for 6 × 5 loose.
- The other problems' tables are unchanged.

## Comments

## Answer

The block row, the contributions under each block and the chromosome names are in the population, parents, evaluation and replacement views, as decided in the mock (ticket 01).

- **Pure parts** (test-first): `block-geometry.ts` (cell sizes: 20 px up to 20 genes, 15 px from 21 to 30, so every valid size, tight or loose, fits 560 px; the cells, the block row and the notes all take their sizes from it so labels sit exactly over their cells), `block-model.ts` (`blockNotes`: `✓ 4` / `▽ 3` / `2` per block; `blockSentence`; `blockRowLabels`; `blockRowSentence`), `block-context.ts` (`blockInfoOf`).
- **Views**: `Bits.svelte` lays a trap chromosome out by block (tight: a bracketed group per block with its note inside; loose: genes in true order with the notes as one line under them, "block 1: 2 · …") and its accessible name gains "ones per block 4, 0, 1, 0, 4; scores 4, 3, 2, 3, 4; all ones in blocks 1 and 5; all zeros in blocks 2 and 4"; new `BlockRow.svelte` (tight: "block n" labels as wide as their groups, "n" for blocks narrower than 4 genes; loose: the owning block's number over every gene, alternate blocks underlined differently; one sentence for a screen reader). The population table uses the knapsack's compact mode (selection columns only with roulette weights, parent count in the first column, the optional Decoded column dropped when selection columns show or above 20 genes); the evaluation view drops Decoded above 20 genes; in the replacement view the chromosome starts each row so the block row sits exactly over it.
- **Tests**: `block-geometry.test.ts` (3), `block-model.test.ts` (9), `trap-views.test.ts` (14, server-rendered), and Playwright `e2e/trap-views.spec.ts` (14): for 4 × 5 tight and loose, 6 × 5 tight and loose (30 genes), 3 × 10 (ten blocks) and 2 × 1, at 1920×1080 and 1366×768 in projector mode, in the population, evaluation and replacement views, every block-row label is within 1.5 px of its group (or gene), every note lies inside its block, no table or region is wider than its panel, and the page does not overflow; plus names and sentences for every chromosome and the engine's fitness in the table. Several real overflows were found and fixed this way (the table paddings, a loose chromosome wrapping in the replacement column, too many pixels at 30 genes).
- `npm run check` clean; 1359 unit tests and 321 Playwright tests pass.

Left for later tickets: the crossover and mutation views still show their own marks (tickets 07, 08); the strip beside the diversity plot is still the generic "Share of 1s per gene" (ticket 09).
