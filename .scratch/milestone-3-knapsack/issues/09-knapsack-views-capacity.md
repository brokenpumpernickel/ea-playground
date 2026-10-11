# 09 Views: capacity bar and the skipped and dropped marks

Status: resolved
Type: task
Blocked by: 08
Spec: ../spec.md

## What to build

The capacity bar (weight against capacity, overflow hatched with its number) wherever ticket 01 put it, and the marks decided there for a gene that is skipped by the decoder or Baldwinian repair and for a gene dropped by repair, each carried by shape and text. Projector-size legibility is checked on a rendered view.

## Done when

- Playwright: the bar's filled and overflow lengths equal weight and excess weight from the engine; the marks are present exactly on the genes the engine says were skipped or dropped; no colour-only meaning (computed styles checked as in ticket 17 of milestone 2).
- A rendered screenshot at 1920×1080 in projector mode was looked at.

## Comments

## Answer

- **Small capacity bar** (`CapacityBar.svelte`) beside the bag weight in the population table rows, the evaluation list and the hand-edited table: filled up to the capacity, a tick at the capacity (two thirds of the bar, so up to 1.5× the capacity is shown), and the excess hatched beyond the tick. The problem declares which column is a bar (`ProblemColumn.meter`: value against limit), so no view knows about the knapsack; the text beside it ("55/48 ✗ +7") says the same, so the bar is hidden from screen readers and never the only carrier.
- **Stacked bar for the offspring being scored** (`StackedBag.svelte`) under the evaluation table: one segment per packed item in order, as wide as its weight, the capacity marked, whatever crosses it hatched (split inside the item that crosses), and a line of words ("6 items · weight 39 of 48", "19 over (hatched)", "repaired from 67"). For Lamarckian repair it shows the repaired bag and the weight it was repaired from.
- **✂ mark** for a gene Lamarckian repair rewrote to 0 (`Bits` `dropped` prop): dotted outline, ✂ above the cell, `data-dropped`, and "genes 1, 5 and 6 dropped by repair, rewritten to 0" in the description. The evaluation model carries `repairedFrom` and `dropped` from the engine's evaluation event. (Mark B for skipped genes was ticket 08.)
- **Fit:** the table is exactly as wide as its panel at 1920×1080 in normal and projector mode for the decoder and the penalty, with tournament and with roulette selection. The one case that did not fit (penalty with roulette weights on show) drops the bars and the optional Value column (`ProblemColumn.optional`) while the selection columns are there; the evaluation view still has them. Cell padding and font sizes of the knapsack table are tightened for the same reason.

**Tests**
- `knapsack-bars.test.ts` (9): the bar's fill and hatching for a bag under, exactly at and over the capacity (and clipped far over), hidden from screen readers; the stacked bar's segments, widths and capacity mark, the split segment, "1 over (hatched)", "repaired from 67"; the ✂ mark on exactly the named genes and none otherwise.
- `e2e/knapsack-bars.spec.ts` (12): for every method, every bar in the table at generations 0–3 has the engine's weight, capacity, fill and hatching, and only the penalty ever has any excess; for Lamarckian repair, one offspring at a time, the ✂ marks and `data-dropped` are exactly the genes the engine's evaluation event says repair changed, and the bar under the table is the offspring just scored, with the engine's packed letters, weight and "repaired from"; for the penalty the bar hatches exactly when the engine says the excess is above 0 and says how much; computed styles show nothing depends on colour (the excess is a repeating hatch pattern, a skipped gene is dashed with ✕, a repaired gene is dotted with ✂, the numbers are in the text); the table never scrolls sideways (decoder and penalty, normal and projector, tournament and roulette); the other problems have no bars.
- One older unit test matched the table's markup too tightly and now allows the markers the bar adds.

State: 1166 unit tests, `npm run check` clean, 181 Playwright tests passing. A rendered screenshot at 1920×1080 in projector mode was looked at.
