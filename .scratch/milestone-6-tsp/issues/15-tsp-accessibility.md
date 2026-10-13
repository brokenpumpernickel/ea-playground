# 15 Accessibility and projector pass for the TSP

Status: open
Type: task
Blocked by: 09, 10, 11, 12, 14
Spec: ../spec.md

## What to build

The pass of milestones 1–5 on the new screens: names and sentences for tours, the map and the cards, real tables, the colour-only audit extended with the new meanings (the kept slice, hatching, ↻ mapped cities, the cycle underlines, ✱ mutated cities, the removed and added edges, the edge origins on the map, the selected tour, the optimal tour, the population's edge widths, the reference lines), keyboard-only operation of a full generation with the route map open including the selection from the map, no control without a name with menu, drawer and view open, reduced motion, and no overflow or overlap at 1920×1080 and 1366×768 in projector mode for every stage, the route map, the drawer and the menu, for 5, 14, 16, 22 and 52 cities, 12 and 60 individuals and every instance kind, **including the top bar with the longest instance and preset names and the ribbon, the generation counter and every stage pill** (milestone 5's lesson). Geometric tests of overlap, clipping and width stability at every micro-step of several generations (narration included), with extreme data (all cities on a line, duplicate cities). Capture screenshots for ticket 16.

## Done when

- The audit list is extended in this file with each colour-coded meaning and its non-colour carrier.
- Playwright: keyboard-only generation, accessibility-tree check, reduced motion, geometry tests at both sizes for the cases above.
- Screenshots at both sizes are under `.scratch/milestone-6-tsp/screenshots/`.

## Comments

## Answer
