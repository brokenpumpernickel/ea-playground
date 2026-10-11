# 18 The stacked bag bar keeps one width

Status: open
Type: bug (layout), found in the review of ticket 17
Blocked by: none
Spec: ../spec.md

## What to build

In the evaluation view the stacked bar (`StackedBag.svelte`, `.bagwrap .bigbar { flex:1 }`) takes whatever width is left beside its caption, so its length changes from one offspring to the next with the caption ("5 items · weight 39 of 48 · repaired from 39" is longer than "8 items · weight 65 of 48 · 17 over (hatched)"). The bar's scale is fixed (the capacity mark is always at the same fraction of the track), but the track itself grows and shrinks while stepping, which makes consecutive offspring harder to compare. Give the track a fixed width (or put the caption on its own line) so it does not move between micro-steps, in every method and at 1920×1080 and 1366×768, without the caption overlapping or clipping.

## Done when

- A Playwright test steps through every micro-step of two generations for each method (and the 20-item instance) and finds the track's width and left edge identical at every step.
- Caption never overlaps the bar or leaves the panel at either size; existing a11y and overflow tests still pass.

## Comments
Reported by the instructor on 2026-10-11 while signing off ticket 17: "this knapsack indicator changes size depending on the text on the right"; to be ironed out later, not a blocker for the milestone.
