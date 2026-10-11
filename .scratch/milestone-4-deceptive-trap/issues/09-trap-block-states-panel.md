# 09 Block states panel

Status: resolved
Type: task (test-first)
Blocked by: 06
Spec: ../spec.md

## What to build

The panel beside the diversity plot for the trap: for each block, how many of the N individuals have it at its optimum (all ones), at the deceptive attractor (all zeros) or in between, for the current population and over the generations of the history, with the figures printed and the marks that carry the meaning besides colour. The registry's gene-panel choice gains the trap's panel; it keeps its width whatever the numbers or the number of blocks (1 to 10).

## Done when

- The counts equal a direct count of the population for every recorded generation, for tight and loose linkage (property test); the panel follows the history cursor.
- Geometric test at both sizes with 1 block, 5 blocks and 10 blocks; the panel never changes width between generations; hidden table or text alternative for the chart; keyboard and screen-reader pass.
- Goldberg's, the string's and the knapsack's panels are unchanged.

## Comments

## Answer

The trap's panel beside the diversity plot is now **Block states**, and the fitness plot has the dashed "all zeros" line (the mock's decisions).

- **Model** (`src/ui/block-states-model.ts`): `blockStateCounts` (per block: individuals at all ones, in between, at all zeros), `blockStatesModel(run, info, now)` (the counts of the cursor's generation, the totals of blocks at all ones and all zeros for every recorded generation, and the history line "blocks at all zeros, generations 2–8: 15 · 14 · …", at most the last seven up to the cursor), `describeBlockStates` (the panel as a sentence). `session.blockStates` follows the cursor, so scrubbing back shows the counts of that generation.
- **View** (`BlockStatesStrip.svelte`, `MetricsPanel.svelte`): a row per block with a bar sharing its width by the counts (all ones solid ✓, in between empty, all zeros hatched ▽, a count of zero has no segment) and the three figures printed in a column of fixed width ("✓ 0 · 4 · ▽ 8"), so nothing moves when the numbers change; the history line; a key for up to five blocks (the panel has no room for it beyond that; the marks stay in the figures and in the sentence); one sentence for a screen reader and a hidden table of every recorded generation. Rows are 13 to 22 px high so that one to ten blocks fit; the summary under them is smaller for the trap.
- **Plot** (`plot-models.ts`, `FitnessPlot.svelte`): `PlotModel.attractor` (what all zeros scores, m × (k − 1)), drawn as a dashed line with a longer dash than the optimum's and the label "all zeros 15", and said in the plot's sentence; the axis and the points are unchanged; the other problems are unchanged.
- **Tests**: `block-states-model.test.ts` (8: hand-worked counts, loose linkage, a property test comparing every recorded generation of several runs with a direct count in both linkages, history and scrubbing), `block-states-view.test.ts` (5), `trap-plot.test.ts` (4), and Playwright `e2e/trap-block-states.spec.ts` (11: for 1 block, 5 blocks tight, 5 blocks of 6 loose and 10 blocks, at both sizes in projector mode, through eight generations the panel and everything in it stay inside the panel, every bar and figure column keeps its width from generation to generation, and the counts are the engine's; scrubbing back; the plot's lines and labels inside the plot; the other problems keep their panels). A first layout showed the summary clipped for ten blocks; fixed.
- `npm run check` clean; 1405 unit tests and 356 Playwright tests pass.
