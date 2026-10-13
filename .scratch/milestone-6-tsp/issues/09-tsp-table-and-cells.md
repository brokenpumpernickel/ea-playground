# 09 The population table and the permutation cell

Status: open
Type: task (test-first)
Blocked by: 08
Spec: ../spec.md

## What to build

The population table for a TSP run with the decided layout: the whole tour in the cell up to 16 cities (cells of 22 px), above that the first seven and the last three cities with "… n more …" and a thumbnail of the tour, the tour length, the gap in per cent, Fitness (= −length); elites ★; the selected individual (click a row, its id or the keyboard equivalent) highlighted and its canonical route written out in full under the table (cut at 46 cities with "(n more)"); the accessible name of a chromosome says the route in words with its length and gap; the same cell in the parents tables; a hidden table of the tours; a hand-edited population typed as city numbers in the drawer.

## Done when

- The cell, the thumbnail and the detail equal the engine's tours for every generation (data attributes); the table keeps its column widths at every micro-step; nothing overflows at 1920×1080 and 1366×768 for 5, 14, 16, 22, 48 and 52 cities with 12 and 60 individuals and with extreme data (all cities on a line, duplicate cities).
- Playwright geometry at both sizes; the other problems' tables unchanged.

## Comments

## Answer
