# 03 Zoom and pan in the page

Status: resolved
Type: task (test-first)
Blocked by: 02 (resolved)
Spec: ../spec.md

## What to build

The wheel zooms about the pointer, a drag pans, a double-click and a Reset view button return to the whole map, + − arrows 0 do the same from the keyboard on the focused map, and the toolbar has the buttons so nothing is mouse-only; the corner note says the zoom. The picture keeps the sizes of dots, lines and numbers while zooming; zoom and pan are kept while stepping, playing and scrubbing and reset when the instance changes.

## Done when

- Playwright: wheel about a pointer keeps the city under it, drag, double-click, buttons and keys; sizes unchanged on screen (data attributes); kept across steps, play and scrub; reset with the instance; no marker or label outside the picture at any zoom at both sizes; reduced motion (no animated zoom); the map's name and sentence say the zoom; every control named.

## Comments

## Answer

## Answer

**In the page** (`RouteMapView.svelte`, state in the stage panel): the map sits in a focusable group (`data-testid="route-map-frame"`, named with its keys) and its view is a `MapView` kept by the stage panel, so it survives steps, stages, playing, scrubbing, the other tab and a restart of the same instance, and starts over when the instance changes (the key is the instance's name, number of cities and places). The wheel zooms about the pointer (a non-passive listener, `preventDefault`, so the page does not scroll; `exp(−deltaY × 0.002)` per notch, 1× to 40×), a drag pans (pointer capture; `user-select: none` on the map, because without it a second drag in a row was cancelled by the browser's text selection: found by the test), a double-click and the **Reset view** button return to the whole map, **+** and **−** buttons zoom about the middle, and from the keyboard on the focused map `+`/`=`, `−`, `0` and the arrow keys do the same (the arrows only while zoomed, so at 1× they still step the run; while zoomed they move the picture and do not step it). The three buttons are named and disabled when they have nothing to do. Cities are placed with `toScreen`; a city is drawn only when its whole dot is inside the picture, with its number placed by `labelPlacement`; the ✕ of a removed edge only when inside; lines are clipped by the picture. Dots, lines, rings and numbers keep their size. The corner note says "x → · y ↑ · zoomed 4×, drag to move" (with a halo so it can be read over lines), the map's name and its sentence add "Zoomed 4×: a part of the map is shown." and are the sentence alone at 1×. The line "gap = how much longer than the optimum" moved from the toolbar (where the three new buttons made the toolbar wrap) to under the figures.

**Tests** (`e2e/tsp-zoom.spec.ts`, 25 tests, plus 8 in `tsp-numbers.spec.ts`): the start (1×, nothing said, focusable and named, buttons' states); the wheel about the pointer for 16 and 52 cities, in and out and at another place of the picture, checked as an exact scaling of the page about the pointer position the page itself saw (the browser rounds the pointer to whole pixels, which a test of "the city stays" would amplify at 40×), and `preventDefault`; the limit at 40× however far the wheel turns; marks keep their sizes (radii, stroke widths, number size) and the distance between cities grows with the zoom; a drag moves the picture with the pointer and, repeated, stops with the picture's edges at the window's in both directions; double-click, the buttons and Reset view; the keys (and that they do not step the run, and that at 1× they do); persistence across a micro-step, a generation, play, scrubbing both ways, the other tab and a restart, and the restart with another instance through the drawer; name and sentence; stage marks while zoomed (child, removed and added layers, the mark sentence); reduced motion (no running animation, no transition); every control named; and at both sizes, in projector mode and not, for 16 and 52 cities, after seven zooms and drags (to the corners, to 40×, out again) and through 120 micro-steps of a zoomed map, no dot, number, note or ✕ outside the picture. Mutations (no `preventDefault` on the wheel, drawing every city, arrows swallowed at 1×) each fail a test; "a release applies the last position" turned out to be unnecessary and was not kept.

**Also changed:** `tsp-map.spec.ts` and the other specs address the run's Reset button with `exact: true`, because "Reset view" now also matches the substring. 2,234 unit tests, 904 end-to-end tests (43 skipped without their switches) and `npm run check` pass.
