# 15 Accessibility and projector pass for the TSP

Status: resolved
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

## Audit list: every colour-coded meaning of the TSP screens and what carries it besides the colour

| meaning | colour | the carrier that is not colour |
|---|---|---|
| elite (table) | — | ★ before the id, the legend "★ elite", the hidden table's "elite" |
| selected individual (table, map) | tinted row | ▸ before the id, the id bold and underlined, `aria-pressed` on its button, the "selected individual" row of the hidden table of the map, the "Selected tour" control |
| parent (table) | — | ◆ ×n beside the id, the legend, "chosen as a parent n times" in the hidden table |
| city filled from, or taken from, the other parent (cards) | violet hatching | the hatching pattern itself, the key sentence ("hatched city = …"), and "Positions … from parent B" in the name of the strip |
| the slice (OX, PMX) | tinted cells | a thick outline (solid for A, dashed for B), "cuts after positions 8 and 13 → slice = positions 9 to 13 (5 cities)", "Slice: positions 9 to 13." in the names |
| a city that followed the PMX mapping | orange outline | ↻ on the cell, "n cities followed the mapping ↻" under the child, "Positions … followed the mapping." in the name |
| a city's cycle (CX) | — | the line under it: solid, dotted, dashed, double for cycles 1, 2, 3, 4 and later, the cycle list with positions ("cycle 1 = 14 positions (1, 3, …)"), "cycle 1 from A, cycle 2 from B" |
| a city changed by mutation | orange fill | ✱ on the cell, the badge "✱ reverse the slice from position 34 to 50", "Positions … changed by mutation." in the name |
| the edges a mutation took out and put in (cards) | orange | the words "✕ removed 49–34, 39–52 · added …" and the length change |
| the edges of a child, by origin (map) | grey, blue, green, orange | shared: thin solid; from A: thick solid; from B: dashed; new: dotted; the key line, and the sentence with the four counts |
| the ringed cities (the kept slice, the ends of changed edges) | — | a larger circle with a heavier outline, and the sentence saying what is ringed |
| removed edges (map) | dark orange | dashed, and ✕ at their middle, the key and the sentence "n edges removed (✕, dashed)" |
| added edges (map) | blue | wider than any other line (5 px), the key, the sentence |
| the best tour, the selected tour, the optimal tour (map) | black, orange, grey | solid and thick; dotted; dashed; the key; the rows of the hidden table; the two toggles are buttons with `aria-pressed` and a ✓ |
| the population's edges (map) | faint grey | width grows with the number of individuals that use the edge (`data-count`), "thicker = more individuals use them" in the key, the sentence "n edges are in every individual" |
| the optimum and the nearest-neighbour lines (fitness plot) | grey | dotted and dashed, and each labelled in words ("optimum −6,859", "nearest neighbour −9,988"), both named in the plot's own sentence |
| the edge-agreement bars | violet | their height, the share printed under each up to 16 edges, the hidden table with every edge and its count, the counts line |
| the fitness and diversity series | blue, orange, green | as in milestones 1–5: markers (● ■ ▲), dashes, the legend, the plot's sentence and the hidden table |

## Answer

The pass of milestones 1–5 was repeated on the TSP's screens, in projector mode and not, at 1920×1080 and 1366×768. It found and fixed four defects.

**Found and fixed**
- **The replacement narration listed every individual** ("Next population: individuals 706 (elite), 718 (elite), 723, …"): with 20 individuals (the new default) or 60 it overflowed its box. It now lists the first ten and says "… (20 in all)" once there are more than twelve (`describe.ts`, tested; the other problems' narrations with up to twelve individuals are unchanged).
- **A PMX card was cut at the bottom in projector mode** (its mapping and example lines make it the tallest): the header of a tour card keeps each part whole and smaller (18 px, the cut text 16 px) so it fits one line, and in projector mode the strips' cells are square. The operator geometry tests now run in projector mode as well (18 more tests).
- **The drawer's preset select pushed over its own label** when the longest preset name ("berlin52: against the nearest neighbour and the optimum") was chosen: it is limited to 420 px (an ellipsis beyond; no other problem's select reaches that).
- **The route map could not be used for selecting an individual without the table**: a "Selected tour" control (a labelled select: none, or each individual with its length) now sits in the map's toolbar, works from the keyboard and is reflected in the table (▸, highlight) and in the hidden table of the map.

**Tests** (`e2e/tsp-a11y.spec.ts`, 54): names and sentences (every tour, the cards' strips, the plots, the map; real tables for the population, the tours, the metrics, the edge agreement, the map's tours and the lengths beside it); a full generation with the keyboard alone from the problem menu (Tab, Enter, arrows), the route map opened from its tab, the optimal tour toggled with Space, a tour selected with the arrow keys from the map and taken away again with Home, the ribbon followed stage by stage; no control without a name with the menu, the drawer, the map and a selection open, for a circle, a random instance, Two clusters and berlin52; the colour audit above checked in the page (outlines, hatching, ✱ and ↻ in the pseudo-elements, four line styles, dash patterns and widths of the map layers, ✕, the key sentences, the reference lines); reduced motion (no transition or animation on any of 200+ elements, none running); geometry in projector mode at both sizes for ten cases (circle of 5 cities, burma14 and ulysses22 with 60 individuals, ulysses16, a random instance of 15 cities, Two clusters, berlin52 with 12 and 60 individuals, att48 with every tour the same, ulysses16 with every other tour reversed): at the start, after a generation, inside every stage, with a selection, with the route map (also with the optimal tour and a selection, and during a stage), with the drawer open (also with the longest preset chosen: no row's control over its label) and with the problem menu open: nothing overlaps, nothing scrolls sideways or leaves its panel, the current card is whole; the narration inside its box at every micro-step of the first 14 (8 for 60 individuals) micro-steps of every stage of two generations; the top bar for every instance and every preset name, including the longest, projector and not, at both sizes (the brand inside its box, not into the ribbon, the ribbon not into the counter, every stage pill holding its word) and a three-digit generation in the counter; extreme populations (every tour the same, every other tour reversed): one distinct route, agreement 52 of 52, diversity 0, one width of population edge, no NaN in any picture, no error. The table, map, plots and operator geometry specs now also run in projector mode (52 + 18 tests).

**Screenshots** at both sizes, in projector mode: `.scratch/milestone-6-tsp/screenshots/m6-01 … m6-15` (selection, OX, PMX and CX cards for ulysses16, PMX for berlin52, mutation, replacement, the route map idle with the optimal tour and a selection, with crossover marks and with mutation marks, the drawer, the menu, the circle at its end). They are written by `e2e/tsp-screenshots.spec.ts` only when `SHOTS=1`, so an ordinary run leaves them alone.

**Not covered, and why:** "all cities on a line" and "duplicate cities at one place" cannot be made through the app (an instance is one of the catalogue's, a circle or a seeded random one), so they are covered by the unit tests of the picture models (a line of cities lies on one line and at one place makes a dot, neither divides by zero) and the thumbnail.
