# 05 Drawer: the trap section

Status: open
Type: task (test-first)
Blocked by: 04
Spec: ../spec.md

## What to build

The drawer's run setup for the trap: block size k, number of blocks m and linkage (tight or loose), with live validation whose messages name the field, a help text that states the trap definition (and its source) and the optimum and attractor scores for the current k and m, staged and applied with "Restart and apply" like the knapsack's instance. Changing the options is a reset and says so.

## Done when

- Unit tests of the draft model (typed text, validation messages naming the field, "changed" detection, reset notice) and Playwright: change each option through the drawer and compare with the engine; an invalid entry disables the restart and names the field; no control without an accessible name with the drawer open.
- Other problems' drawers are unchanged.

## Comments

## Answer
