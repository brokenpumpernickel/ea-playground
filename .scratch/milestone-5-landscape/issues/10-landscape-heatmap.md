# 10 The Landscape view and its heatmap

Status: resolved
Type: task (test-first)
Blocked by: 01, 07
Spec: ../spec.md

## What to build

The stage panel's second view "Stage view | Landscape" (as the schema tracker, with the narration bar still visible) and in it the **heatmap** of fitness as decided in the mock: the colour ramp with a labelled scale, isolines at fixed fitness levels with their values (the non-colour carrier), axes with ticks and labels, the optimum mark(s) with a label, the rule "fitness = −f" for the minimised functions, with the **Zoom to population** toggle (off by default: rescales the heatmap to the population's bounding box plus a margin, axes relabelled, the optimum marks kept when inside), drawn on a canvas from a pure grid model (the fitness grid, the isoline segments, the colour index per cell) that is unit-tested; a text alternative (a sentence naming the function, the bounds, where the optimum is and the range of fitness).

## Done when

- The grid model equals the engine's fitness at every sampled point; isolines lie where the interpolated fitness crosses the level (tested on a function with a known level set); the optimum marks equal the known optima; the colour scale is monotone in fitness.
- Rendered check by reading canvas pixels at known points (the colour at the optimum is the top of the ramp, at the worst corner the bottom, for each function); geometric test at both sizes; reduced motion and projector mode; the other problems' stage panels are unchanged.

## Comments

## Answer
The stage panel's second view for a landscape, "Stage view | Landscape" (as the trap's schema tracker is), with the narration bar still visible below it, and in it the heatmap.

- **Pure grid model** (`landscape-grid.ts`, no drawing): `fitnessGrid` (the engine's fitness at evenly spaced points, corners included), `isolines` (marching squares with linear interpolation) at `isolineLevels` (20, 40, 60 and 80% of the function's fitness range), the viridis `ramp` / `colourAt` (worst fitness at the bottom, best at the top, values outside cut to the ends; lightness only ever rises), `optimumMarks` (the known optima inside the region shown), `zoomRegion` (the bounding box of the population plus a margin of a fifth of the box, at least a tenth of the range wide, never past the bounds) and `landscapeSentence` (function, fitness range, bounds, optimum or "four optima", "fitness = −f" for the minimised ones, and what a zoom shows). `LandscapeInfo` gained `id`, `fitnessAt`, `optima` and `fitnessRange`.
- **Drawing** (`heatmap-draw.ts`, `Heatmap.svelte`): a canvas where every pixel is the colour of the fitness at the point it stands for, white isolines labelled with their values (the non-colour carrier), axes with ticks and labels, the optimum marked ✕ in white with a dark outline and labelled "optimum" ("optima" for Himmelblau's four), and the colour scale with its ends and middle labelled and "fitness = −f" for the minimised functions. The pixel/point mapping (`pixelOf`, `pointAt`) is exported for the layer drawn over the heatmap in later tickets. It is redrawn when the function or the region changes, not when the run steps. The canvas is hidden from screen readers and wrapped in an image whose name is the sentence, which is also printed under the view.
- **View** (`LandscapeView.svelte`, `StagePanel.svelte`): the tab pair appears for a landscape only; "Zoom to population" is a toggle (off by default, `aria-pressed`) that rescales the heatmap to the population's box, relabels the axes and keeps the optimum mark when it is inside; both the tab and the zoom are view settings that start over with the run, and stepping keeps them. `PopulationRow` carries the decoded `values` for the zoom.
- **Tests**: `landscape-grid.test.ts` (17: the grid equals the engine's fitness at sampled points for every function and over a zoomed region; isolines lie where the interpolated fitness crosses the level, checked against the true circles of the single peak on a fine grid and against the level on a coarse one; the ramp is monotone and the ends are the worst and best; marks equal the known optima; zoom margins, clipping and degenerate populations; the sentences), `heatmap-draw.test.ts` (4) and `e2e/landscape-heatmap.spec.ts` (13): for each function, 100+ canvas pixels read back and compared with the engine's colour at the point each stands for (any pixel that differs must be within reach of an isoline label), the optimum's neighbourhood at the top of the ramp and the worst corner at the bottom, the ✕ marks (four for Himmelblau), the colour scale dark to light, the zoom region equal to the model's with the mark kept and the picture the engine's over the new region, the sentence as the picture's name, the tab absent for the other problems, the view inside its panel and clear of the narration for every function, zoomed and not, at 1920×1080 and 1366×768 with and without projector mode, and restart returning to the stage view. Mutation-checked (midpoint interpolation, margin, levels, optimum filter, grid order): each fails tests.

Not in this ticket: the surface (11), the population drawn on both (12), reduced motion beyond having no motion (16).

Golden runs unchanged; `npm run check` clean; 98 unit-test files / 1788 tests pass; the whole end-to-end suite (477 tests) passes.
