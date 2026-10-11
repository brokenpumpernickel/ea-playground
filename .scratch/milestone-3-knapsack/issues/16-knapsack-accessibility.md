# 16 Accessibility and projector pass for the knapsack

Status: open
Type: task
Blocked by: 09, 10, 11, 12
Spec: ../spec.md

## What to build

Apply the pass of milestones 1 and 2 to the new views: names and sentences for chromosomes (the bag, the dropped and skipped items, weight against capacity), real tables, the colour-only audit extended with the new meanings (feasible, infeasible, overflow, skipped, dropped, the feasible line), keyboard-only operation of a full generation, no control without a name with the menu and drawer open, reduced motion, and no overflow in projector mode at 1920×1080 and 1366×768 for every stage, the drawer and the menu, including a 20-item instance. Capture screenshots for ticket 17.

## Done when

- The audit list is extended in this file with each colour-coded meaning and its non-colour carrier.
- Playwright: keyboard-only generation, the accessibility-tree check, reduced motion, no overflow at both sizes with the default and a 20-item instance.
- Screenshots at 1920×1080 (projector mode) and 1366×768 are under `.scratch/milestone-3-knapsack/screenshots/`.

## Comments
