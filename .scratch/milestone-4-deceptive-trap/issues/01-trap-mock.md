# 01 Throwaway mock of the trap screens

Status: claimed
Type: mock, review (needs instructor)
Blocked by: none
Spec: ../spec.md

## What to build

A static mock (plain HTML and CSS, hand-made data, thrown away afterwards) of the trap screens at 1920×1080 in the style of the milestone 3 mock, reviewed by the instructor. It settles the marks and layouts before anything is built.

Screens: the population table with the block row above the genes and each chromosome's block contributions printed beneath it, for **tight** and for **loose** linkage (show the options for loose: block letters on the genes, and coloured brackets with a non-colour carrier); the Decoded column ("4 · 0 · 3 · 1 · 2") and Fitness; a block at its optimum and a block at the deceptive attractor, each with a shape and a word; the crossover view with each offspring's blocks marked whole from A, whole from B or split, for one-point cuts in tight and in loose linkage, plus the per-pair "kept / split" summary; the mutation view with a changed block ("block 3: 1111 → 1110, 4 → 0") and a flip that changes nothing; the block states panel (optimum / attractor / in between per block, now and over generations) beside the diversity plot; the schema tracker (input with notation help, "block b solved" picker, counts, instance mean fitness against population mean, the wording that says it illustrates and proves nothing); the drawer's trap section (k, m, linkage, with a validation message and the trap definition in the help); the problem menu with Trap in it. Also the stress case: 8 × 5 genes (40) in loose linkage in the population table and in the crossover view, at 1920×1080 and 1366×768.

## Done when

- The instructor has reviewed the mock and decided: how loose linkage is drawn, the Decoded text and column, the marks for optimum/attractor/split/whole/changed, where the schema tracker sits, and any layout change.
- The decisions are recorded in this file and in the spec's "To decide" list; screenshots are kept under `.scratch/milestone-4-deceptive-trap/mock/`.

## Comments

## Answer (mock built; waiting for the instructor's review)

The mock is `.scratch/milestone-4-deceptive-trap/mock/index.html` (open it in a browser; `build.py`, `trap.js` and `shots.mjs` next to it make it and its screenshots, all thrown away afterwards). The buttons along the top switch screen (crossover, mutation, schema tracker, wide population, menu, drawer), linkage (tight, loose with two drawing styles), size (4 × 5, 6 × 5, 8 × 5), drawer with or without an error, light/dark, normal/projector. Screenshots of 17 states at 1920×1080 are in `mock/screenshots/`. The data are hand-made.

**What the mock proposes, and what to decide**

1. **Block row and contributions (tight).** One row above the genes with "block 1 … block 5" over bracketed groups of genes (a bracket over each block in every chromosome too), and under each block of each chromosome its contribution: `✓ 4` for all ones (the optimum), `▽ 3` for all zeros (the deceptive attractor), a plain number otherwise. Both marks are shape plus number plus a legend entry, not colour. *Decision: keep these two symbols?*
2. **Loose linkage, two ways to draw it.** **A** (screenshots `02`, `05`): the genes stay in their true order and every gene column has its block number printed above it, with every other block's numbers in a dotted underline; the contributions become a line of text under the chromosome ("block 1: 2 · block 2: ▽ 3 · …"). One-point cuts stay where they really are. **B** (`03`): the genes are regrouped block by block with the true gene numbers printed small under each cell; contributions sit under the groups as for tight linkage, but the cut line cannot be drawn (the cut is between positions, not between groups) and the position numbers crowd the "split" marks. *Decision: A or B? Recommendation: A, because the cut is the whole point of loose linkage.*
3. **Decoded column** reads "4 · 0 · 3 · 1 · 2" (number of 1s in each block), header note "1s per block". *Decision: keep, or show the contributions instead?* It is dropped above 20 genes (see 7).
4. **Crossover view** (`01`, `02`): per pair, parents A and B, then each child with, under every block, `● A` (whole from A), `▨ B` (whole from B, matching the hatched genes) or `◧ split`, and a badge "4 of 5 blocks whole · 1 split". Loose linkage shows how one cut splits all five blocks (`02`: "0 of 5 whole · 5 split"). *Decision: marks and wording OK?*
5. **Mutation view** (`04`, `05`): the usual cards with a draw under every gene, a "result" row, and for each block whose contribution changed an orange badge "✱ block 3: 0100 → 1110 · 2 → 0"; where two flips inside one block cancel, a dashed grey badge says so ("flips inside block 1 cancel: 1s in the block unchanged (1), contribution unchanged") and fitness stays. *Decision: keep the "cancel" badge, or say nothing when the contribution does not change (the spec's wording)?* I recommend keeping it: it is a real teaching point (what counts is the number of 1s, not which genes).
6. **Block states panel** (bottom right, replaces the gene share): one bar per block with the population split into all ones (solid), in between (empty), all zeros (hatched), the counts as text at the right ("✓ 2 · 1 · ▽ 3"), plus a line with the history of blocks at all zeros by generation. The fitness plot gains a dashed "all zeros 15" line next to the optimum line. *Decision: keep both?*
7. **Size: 40 genes does not fit.** At 8 × 5 the right-hand population table is wider than its panel even with 14 px cells and no Decoded column (the Fitness column is cut off, `10`, `12`), the crossover badge wraps, and the draws under 40 genes are unreadable (the mock prints only the draws that flipped a gene). At **6 × 5 = 30 genes** everything fits at 16 px cells with the Decoded column dropped (`15`, `16`, `17`). *Decision (recommendation): cap the chromosome at **30 genes** (k × m ≤ 30; k 2 to 8, m 1 to 10) instead of 40, and drop the Decoded column above 20 genes.* This changes the spec's limit.
8. **Schema tracker** (`06`) as a second tab next to "Stage view" in the left panel (so it never competes with the stage view for space): the schema input with the notation explained, "Block n solved" buttons, the order (number of fixed genes) and the defining length, a bar chart of instances per generation, the mean fitness of instances against the whole population, a sentence, and the standing caveat. *Decision: tab, and are order and defining length wanted (they are the quantities of the schema theorem)?*
9. **Drawer** (`08`, `09`): block size, number of blocks, linkage selector, a box that states the trap definition with the numbers for the current k and m (optimum and all-zeros score), and the error naming the field ("Block size × blocks: at most 40 genes in all (8 × 6 = 48)", to be 30 if you agree with 7). **Menu** (`07`): Trap is the fourth entry with logo `Tr`.

Nothing is built yet beyond the mock. Waiting for the decisions above (especially 2, 5 and 7) before tickets 02 and 06.
