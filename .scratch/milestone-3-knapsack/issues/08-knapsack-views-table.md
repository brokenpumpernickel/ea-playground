# 08 Views: item row and population table

Status: resolved
Type: task
Blocked by: 01, 06
Spec: ../spec.md

## What to build

Per the mock and the decisions of ticket 01: the **item row** printed once above the chromosome columns (item letter, weight and value under it) aligned with the gene cells in the population table, the evaluation list, the replacement view and the hand-edited population table; the table's columns from the problem's declaration per handling method, with Feasible shown as ✓ or ✗ plus the word; `Bits` fills a 1 as "in the bag" and marks skipped genes by shape; the chromosome's accessible name says which items are in the bag and which were skipped, with weight against capacity. Models stay pure and are tested through render-to-string; Goldberg and the string problem are unchanged.

## Done when

- Unit tests of the models and views for each method, including a skipped gene and an overweight bag.
- Playwright against the engine's events: the table's items, weights, values, feasibility and fitness equal the engine's at several generations for each method; the item row sits over the cells; Goldberg and the string screens are unchanged.

## Comments

## Answer

**What was built** (as the mock and your decisions describe it):
- `bag-context.ts` and `session.bag`: the views get the running knapsack (items, capacity, how any chromosome is packed) through a context, as the string problem's target does; with no knapsack running nothing changes. The app sets it once.
- `ItemRow.svelte`: the item row (letter, weight, value under each gene's column, with `item / weight / value` labels hanging to the left), one sentence for screen readers ("Items: A weighs 9 and is worth 4; …"). It is above the chromosomes in the population table, the evaluation list, both lists of the replacement view and the hand-edited population table; other problems draw nothing.
- `Bits`: with a knapsack, cells are 23 px wide (mock decision 6); a gene that is 1 but not in the bag (decoder skip, or Baldwinian drop) is a ✕ in a dashed, plain cell (mark B); the description says which items are packed, the weight against the capacity, and which items are not in the bag although the gene is 1 ("Chromosome 111111111111, bag: A, B, C, D, E, G, H, weight 46 of 48, not in the bag although the gene is 1: F, I, J, K, L").
- The weight column is called **Bag weight** (note "of 48"), not "Weight", because the table already has a selection "Weight" column and `data-col="weight"` would have been ambiguous.
- **A gap in the mock, found when it met the real table:** the mock showed no selection columns (Weight, Prob., Parent), but the real table has them and the knapsack's own columns leave no room for three more (the Fitness column was cut off). For the knapsack, Weight and Prob. now appear only while there are roulette selection weights to show, and the parent count (◆×n) moves into the first column beside the number; the other problems keep all three columns. The columns fit at 1920×1080 (checked rendered, penalty method included).
- The replacement view uses two columns for the knapsack as for strings (the old population is the table beside the stage): `Display` has `chromosomeLength`, and the old column is shown only for short binary chromosomes (Goldberg).

**Tests**
- `knapsack-views.test.ts` (10): the item row's cells and sentence, nothing without a knapsack; cells narrower; the decoder's skipped genes are exactly F, I, J, K, L with everything on (✕, not filled), Baldwinian marks the dropped items, Lamarckian marks nothing once repaired, the penalty never marks; the description for a full, empty and partial bag; flip marks, cuts and hatching still work; no change without a knapsack or for a chromosome of another length.
- `e2e/knapsack-views.spec.ts` (9): for each of the four methods, at generations 0 to 4, the table's chromosomes, bag weight (with ✓/✗), value, penalty and fitness equal the engine's, and the ✕ marks are exactly the genes the engine says are not packed; the item row's letters, weights and values and its alignment over the cells (within 2 px); the item row in the evaluation list, replacement view and hand-edited table, and no old-population column; the selection columns hidden for the tournament default and shown with roulette; Goldberg and the string problem unchanged (no item row, all selection columns); switching from the menu.

Still generic until tickets 09–11: the capacity bar and ✂ mark (09), the evaluation view's "what happened" and narration (10), "Chosen per item" and the feasible line (11).

State: 1157 unit tests, `npm run check` clean, 169 Playwright tests passing.
