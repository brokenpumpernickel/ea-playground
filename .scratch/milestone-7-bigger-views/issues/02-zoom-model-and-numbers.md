# 02 The zoom model and the city-number toggle

Status: resolved
Type: task (test-first)
Blocked by: 01 (resolved)
Spec: ../spec.md

## What to build

A pure model of the map's view: zoom about a point (the point stays under the pointer), limits 1× and 40×, pan with clamping so the picture cannot be dragged out of sight, reset, zoom by a step about the centre, the on-screen size rule (dots, lines, rings, numbers keep their size), and which numbers are shown at which zoom (the milestone 6 sizes for the whole map, full size once zoomed in far enough). The **City numbers** toggle in the map's toolbar, on by default, kept with the other two toggles across steps and restarts.

## Done when

- Unit tests of the model (zoom about a point, limits, pan clamps, reset, step zoom, number sizes by zoom and city count, never a label outside the picture); the toggle hides and shows every number and survives steps and a restart (Playwright); the ordinary view is otherwise unchanged.

## Comments

## Answer

**The model** is `src/ui/map-zoom.ts`, pure and tested without a browser (`map-zoom.test.ts`, 19 tests): a view is a zoom and the point of the laid-out picture at the middle of the window (`wholeView`, `resetView`); `toScreen` places a point; `zoomAbout` zooms by a factor with the point under the pointer staying under it, limited to 1× and 40× (a notch at the limit changes nothing, and a factor cut short by the limit still keeps the point still); `zoomBy` is a step about the middle (for + and − and the buttons); `panBy` moves the picture with a drag; `clampView` keeps the window inside the picture in all four directions, so the picture cannot be dragged out of sight (and at 1× there is nothing to pan); the picture is zoomed and not the drawing, so dots, lines, rings and numbers keep their size on screen (the view moves places, never radii). `cityNumberSize(cities, zoom, show)`: the sizes of milestone 6 for the whole map (13, 11 and 9 px by 16, 30 and 52 cities, none above 52), full size (13 px) from 2× on even for 52 cities and for more than 52, none when switched off. `labelPlacement` (moved out of the page, with its rule that a number is up and right of its city or down and left near an edge) is tested over a grid of every visible city, three font sizes and numbers of one to three digits: the label always lies inside the picture. `visibleCity` draws a city only when its whole dot is inside the picture (no marker cut or outside). `zoomNote` is the corner text ("zoomed 4×, drag to move"). The page does not use zoom, pan or `visibleCity` yet; that is ticket 03.

**The toggle:** a **City numbers** button (✓ when on, `aria-pressed`, `data-testid="toggle-numbers"`) beside the two other toggles, on by default, kept in the stage panel with them: through steps, stages, the other tab and a restart, and started over (on) when the problem has no tour. Off: no number is drawn and every dot stays; the map's name and sentence are the same. `e2e/tsp-numbers.spec.ts` (8 tests): on by default with one number beside every dot, in order, at 13 px (16 cities) and 9 px (52); off: no number, every dot, the sentence and the label unchanged, and back on; off through a step, a generation, 40 micro-steps (crossover and mutation marks), the other tab and a restart; started over by another problem; keyboard (Space, Enter) and its name; the toolbar without overflow or overlap at both sizes, projector mode and not.

**Checks:** seven mutations of the model (limit one over, no pointer compensation, drag sign, the full-size threshold, the visible rule, no vertical clamp, the right-edge rule) each fail a test. 2,234 unit tests, 881 end-to-end tests (43 skipped without their switches) and `npm run check` pass; the ordinary view is unchanged except for the one button.
