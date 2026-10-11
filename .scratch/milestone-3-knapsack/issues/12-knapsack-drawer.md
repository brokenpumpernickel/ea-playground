# 12 Drawer: the instance, the handling method and ρ

Status: resolved
Type: task
Blocked by: 06, 08
Spec: ../spec.md

## What to build

In the run setup for the knapsack: an Instance section (item table with weight and value per item, add and remove an item, capacity) with live validation naming the item or field, a Constraint handling selector with a one-line explanation of each method, and ρ for the penalty only. All staged and applied with "Apply and restart" and the usual notice (which now names the instance and the handling when they change). The hand-edited population editor works on the 0/1 strings against the instance. Same behaviour as milestone 2's setup fields (draft problem, drawer-model tests, link carries it).

## Done when

- Unit tests of the drawer model's new fields and validation.
- Playwright: invalid weights, values, capacity and counts are explained and block the restart; a valid change restarts with the notice naming what is lost and the run equals the engine's for the new instance and method; a hand-edited population starts the run from it; Copy link then open reproduces it.

## Comments

## Answer

The knapsack's run setup in the drawer, staged and applied with "Apply and restart" exactly like the target and alphabet:
- **Constraint handling** (select, with a sentence under it for the chosen method), **Penalty ρ** (only for the penalty), **Capacity** (help says "at most the total weight (97)", following what is typed), and **Items**: two columns of rows (letter, weight, value, ✕ to remove) with "+ Add item"; 20 items at most (Add is disabled at 20), 2 at least (the ✕ buttons are disabled at 2). Every input is named ("Item F weight"), a bad one is outlined and `aria-invalid`, and the message names the item or the field ("Item F: the weight must be a whole number from 1 to 99 (it is 0).") under the table or the field, with the restart blocked and "Fix the highlighted fields first." beside the button.
- **Draft model** (`drawer-model.ts`): `Draft.knapsack` holds the options as typed text; `optionsOf(draft)` reads them (text that is not a number becomes NaN and is explained as "not a number"); `problemOf` builds the problem from valid options (the string problem's `options` path now goes through the same functions); `validate` collects the option messages per field (`items`, `capacity`, `handling`, `rho`) for any problem; a hand-edited population is read against the draft's number of items and not blamed while the options are wrong; the crossover-fits-length rule applies (two items cannot be cut twice).
- **What a restart changes** is named in the notice: "the items", "the capacity", "the constraint handling", "the penalty ρ" (ρ counts only while the penalty is the method). The "target fitness reached" stop follows the new instance's optimum when it still held the old one, and the drawer and notice say so ("moves to the new instance's optimum (112)"; the string problem keeps "the new target's length"). Options carry through the existing share link; nothing in the link format changed.

**Tests**
- `drawer-knapsack.test.ts` (14): the draft as typed text and its round trip to options; the same parameters and setup, so the same run; every error under its field with the item named (and "not a number"); wrong options do not build a problem; hand-edited bags against the new length; two items and two-point crossover; every part of the instance and the handling named as a reset (the optimum worked out independently: still 123 with A lighter or a capacity of 47, 125 with a thirteenth item, 112 at capacity 40); ρ counted only for the penalty; nothing is an operator parameter; the target fitness follows only when it was the old optimum; a restart from the draft for every method.
- `e2e/knapsack-setup.spec.ts` (10): every field with its value and accessible name, ρ only for the penalty, none of it for Goldberg; bad weights, values, capacity (including "not a number") and ρ explained and blocking; adding to 20 and removing to 2 with the capacity re-checked; a staged change with cancel and confirm and the run equal to the engine's at generations 0 and 2 for the new instance; changing the handling (with ρ) restarts under the new method; the stop target following the optimum (123 → 112); operator settings beside a staged instance without leaking; hand-edited bags with the live table (bag weight and fitness), the wrong-length message and the run from them equal to the engine's; Copy link then open reproducing instance and handling; the drawer fitting at 1366×768 in projector mode with 20 items.

State: 1202 unit tests, `npm run check` clean, 219 Playwright tests passing.
