# 12 Drawer: the instance, the handling method and ρ

Status: open
Type: task
Blocked by: 06, 08
Spec: ../spec.md

## What to build

In the run setup for the knapsack: an Instance section (item table with weight and value per item, add and remove an item, capacity) with live validation naming the item or field, a Constraint handling selector with a one-line explanation of each method, and ρ for the penalty only. All staged and applied with "Apply and restart" and the usual notice (which now names the instance and the handling when they change). The hand-edited population editor works on the 0/1 strings against the instance. Same behaviour as milestone 2's setup fields (draft problem, drawer-model tests, link carries it).

## Done when

- Unit tests of the drawer model's new fields and validation.
- Playwright: invalid weights, values, capacity and counts are explained and block the restart; a valid change restarts with the notice naming what is lost and the run equals the engine's for the new instance and method; a hand-edited population starts the run from it; Copy link then open reproduces it.

## Comments
