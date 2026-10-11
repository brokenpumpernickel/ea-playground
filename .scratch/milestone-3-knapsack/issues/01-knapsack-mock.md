# 01 Throwaway mock of the knapsack screens

Status: open
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
