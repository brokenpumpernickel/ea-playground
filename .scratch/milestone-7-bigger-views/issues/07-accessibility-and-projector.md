# 07 Accessibility and projector pass for the bigger views

Status: resolved
Type: task
Blocked by: 02, 03, 04, 05, 06
Spec: ../spec.md

## What to build

The pass of milestones 1–6 on the new controls and views: names and sentences, the colour audit (the overlays add no colour-only meaning), keyboard-only enter, zoom, pan, reset, step a generation and leave, no control without a name, reduced motion, no overflow or overlap at 1920×1080 and 1366×768 in projector mode and not for the map (5, 16 and 52 cities, 12 and 60 individuals) and the landscape (every function and representation), the top bar. Screenshots for the review.

## Done when

- The audit list extended in this file; Playwright for each item; screenshots at both sizes under `.scratch/milestone-7-bigger-views/screenshots/`.

## Comments

## Audit list: every meaning carried by colour or position in the new overlays, and what carries it besides

| meaning | colour | the carrier that is not colour |
|---|---|---|
| the graph's three series (average, best of the generation, best so far) | blue, orange, green | the shape of the marker at "now" (● circle, ■ square, ▲ triangle), the same glyphs in the graph's header with their words, the dash of the best-so-far line (7 4), and the graph's name (the sentence of the full plot with the three values) |
| the optimum and nearest-neighbour lines | grey | dotted and dashed, and each labelled in words with its value ("optimum −7,542", "nearest neighbour −8,980") |
| a toggle that is on (Population's edges, City numbers, Optimal tour, Graph, Zoom to population, a trail length) | tinted | ✓ before the label (where there is one), `aria-pressed`, and the two agree (tested) |
| a control that cannot be used now (Zoom out and Reset view at 1×, Zoom in at the limit) | grey | the `disabled` attribute |
| the zoom of the map | — | the corner note ("zoomed 4×, drag to move"), the map's name and sentence ("Zoomed 4×: a part of the map is shown."), `data-zoom` for a test; the heatmap's axes relabelled and its sentence ("Zoomed in: x from … to …") |
| the line styles of the map (shared, from A, from B, new, removed, added, best, selected, optimal) | as in milestone 6 | unchanged: line style, width and the key in the figures card, the mark sentence |
| the overlays themselves (a translucent card over the picture) | — | a border and a shadow as well as the tint; the overlay text is 4.5:1 or better against the surface in both themes (tested for every text element, the key's coloured glyphs excepted: they are graphics with their meaning written beside them, and one of them, the orange ┈, is 4.4:1) |
| which figure is which in the landscape | — | the captions ("Heatmap …", "Surface of the same landscape …") and the marks' shapes, as in milestone 3 |

## Answer

The pass of milestones 1 to 6 was repeated on the new controls and views (`e2e/focus-a11y.spec.ts`, 59 tests, one minute): **names and sentences** (no unnamed control with the focus view, the problem menu and the drawer open, for the map and the landscape; the map frame, picture, graph, hide button, zoom buttons, the landscape's two figures and the Back button have names; the hidden panels keep their sentences and tables and the visible card agrees with the hidden sentence); **the colour audit** above (shapes, dashes, words, ✓ with aria-pressed, disabled controls, and the contrast of every text element of the three overlays in the light and the dark theme, projector mode and not); **keyboard only** (from the Route map tab, Tab to Expand, Enter, into the map, + + +, an arrow, 0, `g` for a generation with the picture following, Esc, E and E again; and in the landscape E, + + on the heatmap, Shift+arrow, + on the surface, an arrow, Reset view by Enter, `g`, Esc); **reduced motion** (entering, leaving and zooming leave no running animation and no transition on any element of the overlays or the map, for the map and the landscape); **the top bar** in the focus view with a three-digit generation after Run to stop (the brand, the ribbon and the counter apart, inside 1920 px at 1366 × 768 in projector mode); and **geometry** at 1920 × 1080 and 1366 × 768, projector mode and not: the map for 5 cities, 16 cities with 12 individuals, 52 cities with 12 and with 60 individuals (the toolbar one row even with a 60-option selected-tour menu, every overlay inside the body and clear of the narration, no scrolling inside an overlay, no dot, number or ✕ outside the picture, at the start, every sixth micro-step of the first generations, with a selected tour and the optimal tour, and zoomed), and the landscape for each of the four functions in the real-valued and the Gray-coded representation (figures and overlays apart, the narration whole, at the start, through two generations, zoomed in with Zoom to population and with trails of five generations).

**Found by the pass:** the first draft of the tests compared the overlays with the map's whole picture (a mistake of the test, not of the page: the overlays lie on the picture; the apart-from-cities check is in ticket 05's tests), counted the key's coloured ┈ glyph (4.4:1) as text, and the dark-theme test did not cope with the theme being remembered between pages; no defect of the page was found, which is the result of building each ticket with its own geometry tests.

**Screenshots** (`e2e/focus-screenshots.spec.ts`, written only with `SHOTS=1`) in `.scratch/milestone-7-bigger-views/screenshots/`: `m7-01` the map of ulysses16, `m7-02` berlin52 with the crowded middle, `m7-03` berlin52 zoomed into it with readable numbers, `m7-04` a crossover step with the origins of the child's edges, `m7-05` the map without the graph and the numbers, `m7-06` the landscape with trails, `m7-07` the landscape zoomed (heatmap inside the population, surface closer), `m7-08` the dark theme, `m7-09` and `m7-10` the map and the landscape on a 1366 × 768 laptop in projector mode.
