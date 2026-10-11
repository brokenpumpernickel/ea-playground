# 01 Throwaway mock of the knapsack screens

Status: resolved
Type: mock, review (needs instructor)
Blocked by: none
Spec: ../spec.md

## What to build

Build a static mock (plain HTML and CSS, hand-made data, thrown away afterwards) of the knapsack screens at 1920×1080, in the style of milestone 2's mock, and have the instructor review it. It settles the marks and layouts and shows what the views need.

Screens: the population table for each handling method (decoder, penalty, Lamarckian and Baldwinian repair) with the item row above the gene cells and the columns Packed, Weight, Value, Feasible, Penalty (penalty only), Fitness; a capacity bar (in the table rows, in the stage views, or both: show the options); a gene that is 1 but skipped, and a gene dropped by repair (✂ is the starting proposal), each with a non-colour mark; the evaluation view for the decoder and for Lamarckian repair (`before → after`); the "Chosen per item" panel; the fitness plot with the "best feasible so far" line under the penalty; the stats line with the feasible count; the drawer's Instance section (item table, capacity, a validation message) and the Constraint handling selector with ρ; the problem menu with Knapsack in it.

## Done when

- The instructor has reviewed the mock and decided: the mark for a dropped gene and for a skipped gene, where the capacity bar goes, and any layout change.
- The decisions are recorded in this file and in the spec's "To decide" list; screenshots are kept under `.scratch/milestone-3-knapsack/mock/`.

## Comments

## Answer (mock built; waiting for the instructor's review)

The mock is `.scratch/milestone-3-knapsack/mock/index.html` (open it in a browser; `build.py` and `knapsack.js` next to it make it, and all of it is thrown away afterwards). It reuses the app's styles from the milestone 2 mock. The buttons along the top switch: screen (evaluation with the population, the problem menu, the drawer's setup), the handling method (decoder, penalty, Lamarckian, Baldwinian), two proposals for the "1 that is not in the bag" mark, the fitness plot with a sensible ρ or one that is too small, the drawer with and without an error, light and dark, and normal and projector size. Screenshots of ten states are in `mock/screenshots/`.

The instance in the mock is illustrative only (12 items, capacity 48, total weight 97, optimum 123, greedy by value per weight gets 112, half of all bags are feasible); ticket 04 designs the real one.

**What the mock proposes, and what to decide**

1. **Item row.** Printed once above the chromosome columns, three lines per item: letter, weight, value (`item / weight / value` labels hang to the left, as "target" does for strings). It lines up with the gene cells in the population table and the evaluation list. *Decision: keep, or show only the letters and put weight and value in a tooltip?*
2. **A gene that is 1 but not in the bag** (decoder, Baldwinian repair). Two proposals: **A** a struck-through 1 in a dashed filled cell, **B** a ✕ in a dashed, plain cell. B is much easier to read at distance (the strike-through is thin and almost disappears at 23 px), and the legend reads "✕ not in the bag". *Decision: A or B? My recommendation: B.*
3. **A gene rewritten to 0 by Lamarckian repair.** A dotted orange outline with ✂ above it, like ✱ for mutation. *Decision: ✂ as proposed?*
4. **Lamarckian `before → after`.** I tried a separate before/after box and dropped it: it squeezes the table to one row. The ✂ marks on the repaired chromosome already show what changed, and the "what happened" column says which items were dropped and at what value per weight, and the weight bar notes "repaired from 67". *Decision: no separate before/after box?*
5. **Capacity bar.** Small bar with the capacity tick and a hatched overflow, plus "58/48 ✗ +10" (and ✓ when it fits) in each table row; a larger stacked bar for the offspring being evaluated, one segment per packed item, the overflow hatched. The table has **no separate Packed column**: the filled cells already are the packed items (and the ✕ ones are the skipped), and a Packed column would not fit the 760 px table. *Decision: drop the Packed column, and keep bars both in the rows and in the evaluation view?*
6. **Penalty mode width.** With the Penalty column the right-hand table is just wide enough only with a 40 px bar and 23 px cells; in the evaluation view the cells are 23 px as well (instead of 26 px in the string problem) so that the item row and the columns fit. Fitness values go negative with a minus sign.
7. **Bottom strip.** "Chosen per item" with 12 narrow bars (percentage printed at 13 px, letter at 17 px; the percentage is the small text here), "best feasible so far" as a ◇ dotted line under the penalty only (the "ρ too small" button shows the best line climbing above the optimum while the feasible line stays below it), and "4 of 6 feasible" in the table header and the panel.
8. **Drawer.** Constraint handling selector with a sentence per method, ρ only for the penalty, capacity, the items as two columns of six rows (weight and value inputs, ✕ to remove, "+ Add item"), and an error under the table naming the item ("Item F: the weight must be a whole number from 1 to 99 (it is 0)") with the restart disabled.
9. **Menu.** Knapsack is the third entry (logo `Kn`); the brand area shows the method as a chip next to the name and "12 items · capacity 48 · optimum 123" under it.

Nothing is built yet beyond the mock. Waiting for the decisions above (especially 2, 3, 4 and 5) before tickets 08–12.

## Decisions (instructor)

All nine points accepted as proposed: item row (letter, weight, value); **mark B** for a gene that is 1 but not in the bag (✕ in a dashed, plain cell); ✂ with a dotted orange outline for a gene rewritten to 0 by Lamarckian repair; no separate before/after box; capacity bar small in the rows and stacked in the evaluation view, no Packed column; 23 px cells in the knapsack tables; the bottom strip, drawer and menu as mocked.
