# 02 Carry-over: the knapsack stacked bar

Status: resolved
Type: task (test-first)
Blocked by: 01
Spec: ../spec.md

## What to build

Fix ticket 18 of milestone 3 (`../../milestone-3-knapsack/issues/18-stacked-bar-fixed-width.md`): the knapsack stacked bar can run past its track. Read that ticket first; it has the failing case.

## Done when

- The case in that ticket is fixed with a geometric test that fails without the fix; the other problems and the knapsack screens are otherwise unchanged; that ticket is marked resolved with a pointer to this one.

## Comments

## Answer
The stacked bar's track now has one width and one left edge: `.bigbar` is 520 px (`flex:none`), the label before it a fixed 140 px, and the caption after it takes the rest of the row and wraps inside it (`app.css`). Before, the track was `flex:1` between a label and a `nowrap` caption, so it grew and shrank with the caption ("Offspring 3" against "Offspring 12", "nothing packed" against "5 items · weight 39 of 48 · repaired from 39").

Test first: `e2e/knapsack-bar-width.spec.ts` (10) steps every micro-step of two generations at 1920×1080 and 1366×768 in projector mode, for the four methods with 12 items and the penalty method with 20, and requires that the track's width and left edge are identical at every step (while the label and the caption do change), and that the label and caption never overlap the bar or leave the panel. It failed for the penalty and Lamarckian repair methods (2 to 5 different widths) before the fix and passes after; decoder and Baldwinian repair, whose captions barely change, passed both ways. The existing knapsack geometry tests (caption clear of the bar, bar inside its track) are unchanged and pass. `npm run check` clean; the whole Playwright suite (587 tests) passes.