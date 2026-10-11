# 08 Views: item row and population table

Status: open
Type: task
Blocked by: 01, 06
Spec: ../spec.md

## What to build

Per the mock and the decisions of ticket 01: the **item row** printed once above the chromosome columns (item letter, weight and value under it) aligned with the gene cells in the population table, the evaluation list, the replacement view and the hand-edited population table; the table's columns from the problem's declaration per handling method, with Feasible shown as ✓ or ✗ plus the word; `Bits` fills a 1 as "in the bag" and marks skipped genes by shape; the chromosome's accessible name says which items are in the bag and which were skipped, with weight against capacity. Models stay pure and are tested through render-to-string; Goldberg and the string problem are unchanged.

## Done when

- Unit tests of the models and views for each method, including a skipped gene and an overweight bag.
- Playwright against the engine's events: the table's items, weights, values, feasibility and fitness equal the engine's at several generations for each method; the item row sits over the cells; Goldberg and the string screens are unchanged.

## Comments
