# 05 The route map in the focus view: overlays and the small fitness graph

Status: resolved
Type: task (test-first)
Blocked by: 03, 04 (resolved)
Spec: ../spec.md

## What to build

The map large in the whole area, with the overlays over its corners: the toolbar (toggles, selected tour, zoom buttons, Reset view, Back), the figures card (best now, best so far, average, optimum, nearest neighbour with their gaps, the key) and a simplified fitness graph (best of the generation, best so far, average, the optimum and nearest-neighbour lines, the "now" mark; the plot's sentence and hidden table kept; a way to hide it). The map's stage marks and selection work as in the panel view.

## Done when

- The figures card and the graph equal the metrics at every generation; the overlays stay inside the window and clear of each other at both sizes and in projector mode, at every micro-step of two generations; during Run the map and the graph change at every generation (a test) and Run at its fastest speed stays smooth for 52 cities and 60 individuals (a measured bound); every control named; keyboard only.

## Comments

## Answer

**The picture:** in the focus view the route map is the whole body of the panel (1840 × 734 design px, drawn from the same model as the small map; `route-map-model.ts` gained a `free` box and the constants `focusMap`), with the three overlays laid over its corners as decided after the mock: the **toolbar** top left (Back to the panels, the three toggles, the selected-tour control, + − and Reset view, a new **Graph** toggle), the **figures card** top right (best now, best so far, average, optimum and nearest neighbour with their gaps, the key of the line styles, and the sentence of the stage mark while crossover or mutation is stepped) and the **simplified fitness graph** bottom left (about 440 × 196 px with its header). The map's own sentence and the table of tours are kept for the screen reader but not drawn.

**Clear of the overlays:** at 1× the cities are laid out in a free box that does not meet any overlay: either the tall box between the graph and the card or, for a long thin map such as ulysses16, the wide box above the graph and left of the card; `freeBoxFor` picks whichever gives the larger map (unit-tested: both boxes clear of the three overlays' reserved boxes, the chosen one never gives the smaller map, nothing NaN for cities on a line or at one place). Zoomed in, the picture fills the area and the (slightly transparent) overlays lie over it.

**The graph** (`mini-fitness.ts`, pure and unit-tested; `MiniFitness.svelte`): the three series up to "now" and dimmed after it, the optimum and nearest-neighbour lines with their words, the "now" line and, at "now", a marker of a different shape for each series (● average, ■ best, ▲ best so far, in the header too, so colour is not the only carrier), the two ends of the axis in words, no gridlines or ticks. Its name is the sentence of the full plot (`fitnessSummary` in `plot-models.ts`, extracted from the full plot, which now uses it too), and the full plot with its hidden table stays in the page. A "× hide" on the graph and the **Graph** toggle in the toolbar hide it and bring it back; the choice is kept like the other map settings.

**Tests:** unit (`mini-fitness.test.ts` 8, `route-map-model.test.ts` +4): every vertex is the plot point of its generation, higher fitness is higher, markers on the values, labels apart and inside, no NaN. End-to-end (`e2e/focus-map.spec.ts`, 22): the layout of the picture and the three overlays (corners, apart, inside the picture); for five instances (5, 16, 48 and 52 cities, two clusters) no city and no number lies under an overlay at the start and through two generations of micro-steps; the figures card equals the engine's lengths for generations 0 to 6 and holds the key and the mark sentence; the graph equals the metrics at every generation (the three marker values, the number of vertices of each path, its name equal to the hidden full plot's); hide and bring back; every toolbar control works in the focus view and what was chosen is what the small view shows; wheel, drag, double-click and keys on the large map; **during Run (Fast) the graph and the map's own sentence agree on the generation in every drawn frame and every generation from 1 to 8 is drawn**; **Run at the fastest speed with 52 cities, 60 individuals and the population's edges on: 60 generations in 0.5 s, worst frame gap 112 ms, 95th percentile 109 ms** (bounds asserted: under 1 s and under 250 ms); geometry at both sizes in projector mode and not for 16 and 52 cities (the toolbar one row, every overlay inside its place and inside the picture, apart from each other, nothing scrolling inside them, the narration whole, at every third micro-step of two generations); keyboard-only reach of the controls and every one named. Mutations (no free box, a flipped axis, the nearest label on the wrong side) fail tests. 2,253 unit tests, 945 end-to-end tests (43 skipped without their switches) and `npm run check` pass.
