# 09 The population table and the permutation cell

Status: resolved
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

The population table of a TSP run is as decided in the mock review, with one change forced by the width of the panel (below).

- **The cell** (`Bits.svelte`, model in `tour-cells.ts`): up to 16 cities one cell per city, 22 × 28 px, the whole tour in order; above that a 64 × 44 px thumbnail of the tour (cities placed by `tspPlaces`: longitude across and latitude up for GEO; cities on a line or at one place are drawn on the line or as a dot, never with a division by zero), the first seven and last three cities and "… n more …". Sources (hatch), cut lines and changed cities keep their marks in the whole-tour cell, so the same cell serves the parents tables. Every cell carries `data-bits` (and the thumbnail `data-path`), so tests read exactly what is drawn.
- **Names:** the accessible name of a tour is "Tour of 52 cities, in the order visited: 31, 18, …, then back to 31. Length 14,004, 85.7% over the optimum 7,542." (or "Length 7,542, the optimum."), followed by the operator marks as one more sentence. The shortened cell's picture and text are hidden from screen readers, which have the name; a hidden table ("Tours of the population") lists every tour in full with its length, gap and role.
- **Columns:** `#`, Chromosome (note: "n cities, in the order visited"), Length (objective), Gap (to the optimum), Fitness (= −length); the heading's right side says "avg … · best … (gap)". Elites ★, the selected row marked ▸ and highlighted; the id is a button (click, or Enter/Space) that selects.
- **Layout decision:** the five columns have fixed widths (the chromosome takes what is left), so nothing moves between micro-steps. A 16-city tour with the two roulette columns beside Length, Gap and Fitness does not fit in 760 px, so **while roulette weights are on show Weight and Prob. stand where Length and Gap stand** (the length is minus the fitness, which stays; the gap is in the heading and returns after selection). Tournament selection has no such columns.
- **Selected individual:** its canonical route is written out under the table ("Individual 27 · canonical route 1 → 7 → … → 1 · the chromosome starts at city 33"); always shown for tours of more than 16 cities (with a hint until one is selected), and for shorter ones once one is selected. A route of more than 52 cities would be cut at 46 with "(n more)"; no instance reaches that, so it is unit-tested only.
- **Context:** `session.tour` (a `TourInfo`: cities, places, optimum, `lengthOf`, `lengthText`, `gapText`, `describe`) is provided to every view through the tour context. Engine additions: `tspPlaces` and `TspProblem.lengthText` / `gapText` (tested).
- **Known, left for later tickets:** the operator views (stage panel: crossover, mutation, replacement) still use the table cell and overflow at 16+ cities (ticket 10); the edge-agreement strip and the stats text are still the old ones (ticket 12).

Tests: `tour-cells.test.ts` (17), `tour-views.test.ts` (8), engine `tsp.test.ts` (+3), `e2e/tsp-table.spec.ts` (42: every row equals the engine's tour, length and gap at generations 0–3 for 5, 14, 16, 22, 48 and 52 cities; names and the hidden table; selection by mouse and keyboard; rotation and reversal give one route; geometry at 1920×1080 and 1366×768 for all six sizes with 12 and 60 individuals, selected and not; fixed column widths at every micro-step of two generations under tournament and roulette). Mutation checks on the model constants and arithmetic (10 mutants) all fail a test. "All cities on a line" and "duplicate cities" are not reachable through the instances, so they are covered at the model level.
