# 11 The route map

Status: resolved
Type: task (test-first)
Blocked by: 08, 09
Spec: ../spec.md

## What to build

The second view of the stage panel ("Stage view | Route map"), with the narration bar still visible: the cities as numbered dots (the numbers dropped or shrunk when crowded), GEO instances drawn longitude across and latitude up, the population's edges faint with width by the number of individuals that use them (toggle, on), the best tour bold, the selected individual's tour orange and dotted, the optimal tour dashed grey (toggle, off), the side column of best now, best so far, average, optimum and nearest neighbour with the gap; the stage marks (crossover: the child's edges shared / from A / from B / new, the kept slice ringed; mutation: removed edges dashed with ✕, added edges bold, the end cities ringed, the population's edges dimmed); a sentence and a hidden table of tours as the text alternative; the view stays when the run restarts.

## Done when

- Every drawn edge equals the tour it belongs to (data attributes), the edge widths equal the population's edge counts, the best, selected and optimal tours are the right ones, stage marks equal the events at the cursor, the same individual is highlighted in the table and on the map; GEO and ATT instances draw where their coordinates say; no marker or label outside the picture at both sizes at every micro-step of two generations; the other problems have no route map.

## Comments

## Answer

The stage panel of a TSP run has a second tab, **Route map** (beside **Stage view**; the narration bar stays below it, the heading says "Route map" and, while crossover or mutation is the stage, "Route map · crossover"). Other problems have no such tab.

- **The picture** (`RouteMapView.svelte`, drawing rules in `route-map-model.ts`): the cities as numbered dots in a 740 × 292 box with 24 px clear on every side, one scale across and up, centred, north up (GEO instances therefore have longitude across and latitude up, and say so in a note in the corner; the others say "x → · y ↑"). Labels are 13 px up to 16 cities, 11 up to 30, 9 up to 52, none beyond; a label sits up and to the right of its city, or down and to the left near an edge, so none leaves the picture.
- **Layers**, each line a `<line>` carrying its two cities (`data-edge="3-9"`, from 1), its layer and, for the population, its count: the population's edges faint, their width 1 + 5 × (individuals using the edge) ÷ (individuals) (toggle, on); the best tour of the generation bold (the first of equal fitness); the selected individual's tour orange and dotted (the same individual is highlighted in the table, whose ▸ marks it, and listed in the hidden table); the optimal tour dashed grey (toggle, off; TSPLIB's tour or the exact one of an own instance).
- **Stage marks**, from the events at the cursor:
  - **Crossover:** the first child of the current pair, its edges by origin — shared by both parents (grey, solid), from A only (blue, solid), from B only (green, dashed), new (orange, dotted) — with the kept or taken slice of OX and PMX ringed; CX has no slice to ring; a bypass draws the copy. The sentence says "Pair 3: O5's edges by origin: 9 shared by both parents, 5 from A only, …, 1 new. The slice (positions 17 to 19) is ringed." The best and selected tours are not drawn while a child is, the population's edges are.
  - **Mutation:** the offspring's tour with the removed edges dashed and crossed out (✕ at their middle), the added edges bold, the other edges grey and the cities at the ends ringed, the population's edges dimmed; an unchanged offspring or a switched-off mutation is drawn as it is and the sentence says so.
  - Every mark has a dash, a width, a ✕ or a ring besides its colour, and the key under the picture says which.
- **Beside the map:** best now, best so far, average (length and the gap, "+42.6%"), the optimum ("published" or "exact") and the nearest-neighbour tour with its gap, as a real table.
- **Text alternative:** the map is named by a sentence ("berlin52: 52 cities, EUC_2D. Generation 3: the best tour is …, … over the optimum 7,542; k edges are in every individual."), which is also on the screen with the mark's sentence under it, and a hidden table lists the best, the selected and the optimal tour in full with length and gap (in a box of its own: a 52-city route in one row had widened the panel).
- **The view stays when the run restarts** with its two toggles; a problem without a tour starts the views over.

Tests: `route-map-model.test.ts` (25: layout, population counts and widths, best/selected/optimal, crossover classification and ringing for OX, PMX and CX, bypass, mutation edges and rings, the figures, the sentence and the table); `e2e/tsp-map.spec.ts` (29): the tab exists for TSP only; at generations 0, 1, 4 and 8 for 5, 16 and 52 cities every population edge, its count and width, the best tour, the figures beside the map equal the engine's; the selected tour and the table highlight, the optimal toggle, the population toggle; cities drawn where GEO, EUC_2D and ATT coordinates say (one scale, longitude across); for OX, PMX and CX at 16 and 52 cities every micro-step of two generations compared with the events (child edges and origins, the ringed slice, the removed/added/unchanged edges, the ringed ends, the dimmed population, no best/selected layer while marking); the sentence and the hidden table; restart keeps the view; keyboard operation and no unnamed control; at 1920×1080 and 1366×768 every marker and label inside the picture, nothing leaving the panel, the sentence clear of the narration, at every micro-step of two generations for 5, 16 and 52 cities with both toggles on and an individual selected. Mutation checks: ten mutants (width formula, tie rule, margin, origin classes, ring off-by-one, added/unchanged, child index, published/exact, the sentence) all fail a test except one equivalent (the "edges in every individual" count is the same whichever tour it is taken from).

Not done here: selecting an individual by clicking the map (the id in the table is the way; ticket 15 decides whether the audit needs more), and the plots under the panels (ticket 12).
