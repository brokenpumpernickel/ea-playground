# Milestone 7: bigger views (zoom, city numbers, focus mode)

Status: specified from the instructor's requests after the milestone 6 step-through and the grill (Q1 to Q7, all recommended, with one clarification: the focus view takes the whole area of the panels, the plots included, with a simplified fitness graph laid over it). Next: a mock of the layout (ticket 01), reviewed by the instructor, then the other tickets.

Vocabulary follows `CONTEXT.md` (the **route map**, the landscape's **heatmap** and **surface**). New terms for the glossary when built: **focus view** (a figure given the whole centre of the screen).

## Problem

The route map and the landscape's two figures are small. They sit in a panel of about 740 × 290 px (the map) or two plots beside each other, with the stage panel, the table and the three plots all competing for the screen. For a class looking at a projector, the picture is the lesson, and on 52 cities (or a population that has clustered on a landscape) the details are too small to see. The map also cannot be zoomed, and its city numbers cannot be turned off when they get in the way.

## Goal

1. A **toggle for the city numbers** on the route map.
2. **Zoom** of the route map with the scroll wheel (and pan by dragging), operable from the keyboard as well.
3. A **focus view**: one click (or a key) makes the route map take the whole centre of the screen, replacing the stage panel, the table and the three plots, with the top bar, the transport, the narration and the history strip kept, so a run can still be stepped or played, and the picture updates as it runs. A **simplified fitness graph** lies over a corner of it.
4. The same focus view for the **landscape** (the f(x, y) problems): the heatmap and the surface side by side, each about twice as large, with wheel zoom and the same small fitness graph.

## Scope

### In

**The route map**
- A **City numbers** toggle in the map's toolbar, on by default, kept with the two other map toggles (population's edges, optimal tour) across steps, restarts and the focus view. Off: no number is drawn and the dots stay. On: the numbers keep the sizes of milestone 6 in the whole map, and a map zoomed in far enough shows the numbers at full size even for 52 cities, where the whole map drops or shrinks them.
- **Zoom and pan**: the scroll wheel zooms about the pointer (1× to 40×), dragging pans, a double-click or a **Reset view** button returns to the whole map. For the keyboard: the map takes focus, + and − zoom about its centre, the arrow keys pan, 0 resets; the same buttons are in the toolbar so that nothing is mouse-only. Dots, lines, rings, ✕ marks and numbers keep their on-screen size while the map zooms (it is a zoom of the picture, not of the drawing), so a zoomed-in map is as legible as a whole one. Zoom and pan are kept while stepping, playing and scrubbing and reset when the instance changes or the run restarts with another instance; they are not part of a share link.
- The labels stay inside the picture at every zoom and pan; the note in the corner says what the axes are, and says the zoom ("zoomed 4×, drag to move").

**The focus view**
- An **Expand** button in the corner of the route map and of the landscape view (and the key `E`) puts the figure in the whole area now taken by the stage panel, the population table, the legend line and the three plots; **Esc**, the same button (now "Back to the panels") or `E` returns. The top bar, the transport, the speed control, the history strip and the narration stay; the narration is a slim bar under the figure. Pressing Run, Step, Stage or Generation works as ever, the figure updates at the speed of the playback, and **Run to stop** and the scrub bar work.
- Over the figure, as overlays that do not cover its middle: the **toolbar** (toggles, the selected-tour control, zoom buttons, Reset view, Back), the **figures card** (best now, best so far, average, optimum, nearest neighbour with the gaps; the lines of the map's key), and a **simplified fitness graph** (about 380 × 190 px, a corner): the best of the generation, the best so far, the average, the optimum line (and the nearest-neighbour line for the TSP), the "now" mark, with the plot's own sentence and numbers still available (the hidden tables and the sentences of the full plots are kept, since the plots themselves are hidden).
- The focus view is a view setting like the others (kept across steps and restarts, reset by another problem), not part of a link and not part of a preset.
- What is hidden while it is open (the operator cards, the table, the edge agreement and diversity plots) is one click or `E` away; the map's stage marks still show what the step did and the narration says it in words.

**The landscape**
- Expanded: the heatmap and the surface side by side, each about twice as large as now, the population marks as they are (trails, selection, parents and offspring); the same toolbar, figures card (best now, best so far, average, the optimum, the function) and fitness graph overlay as the map.
- **Wheel zoom and drag to pan on the heatmap** (kept with the existing "Zoom to population", which becomes the way to zoom to where the population is; the two compose: Reset view returns to the whole domain); the surface keeps drag-to-rotate and the arrow keys and gets **wheel zoom** (the camera comes closer); Reset view resets both.

**Real time**
- No new machinery: the views are derived from the session, so they redraw on every step, and Run plays through the same steps. A test shows the expanded map and the expanded landscape change at every generation during Run, and the cost of a redraw at the largest case (52 cities, 60 individuals, about 1,500 population edges) is checked to keep Run at its fastest speed smooth.

### Out

- Focus view for the other problems (their plots stay as they are), for the diversity and edge agreement plots, or for the operator cards.
- Touch gestures (pinch), saving the zoom in links, animation of the zoom, a minimap, drawing tools.
- Changes to the engine, the run layer, history or the share-link format.

## Acceptance criteria

1. **Nothing else changes.** All milestone 1–6 unit and end-to-end tests pass; the golden runs reproduce exactly; the other problems' screens are unchanged (their plots, panels and links); the panels of the TSP and the landscape in the ordinary view are unchanged except for the new buttons.
2. **City numbers.** The toggle hides and shows every number, survives steps, restarts and the focus view, and the map's name and sentence do not depend on it; zoomed in, the numbers of a 52-city map are shown at full size and stay inside the picture.
3. **Zoom and pan.** The model is tested without a browser (zoom about a point keeps that point still, limits 1× and 40×, pan clamps so the picture cannot be lost, reset); in the page, the wheel zooms about the pointer, a drag pans, the double-click and the button reset, the keys do the same; dots, lines and numbers keep their on-screen size; zoom survives steps, play and scrubbing and resets with the instance; no marker or label outside the picture at any zoom, at both sizes.
4. **Focus view.** It replaces exactly the panels named, keeps the top bar, transport, history and narration (the narration inside its box at every micro-step); Esc, `E` and the button leave it; it is kept across steps and restarts, and reset by another problem; every overlay stays inside the window and clear of the middle of the figure at both sizes and in projector mode; the figures card and the fitness graph equal the metrics at every generation; the hidden tables and sentences of the plots that are hidden are still there.
5. **Landscape.** The expanded heatmap and surface show the same population as the ordinary view (the marks, the selection and the trails equal the engine's); wheel zoom and drag on the heatmap and wheel zoom on the surface work and reset; zoom to population still works and composes.
6. **Real time and accessibility.** Run, Step, Stage, Generation, Run to stop and the scrub bar work in the focus view and the picture changes at every generation of a run; every control has a name; keyboard only: enter the focus view, zoom, pan, reset, step a generation, leave; reduced motion (no animation of the zoom or of the entering); the colour audit holds (the new overlays add no colour-only meaning); no overflow or overlap at 1920×1080 and 1366×768 in projector mode and not.
7. **Hosting and review.** The published site; the instructor steps through a full generation in the focus view in projector mode for the map and for a landscape.

## Verification approach

- Vitest, test-first: the zoom/pan model (pure), the overlay's graph model (from the plot model), the focus state in the session, the figures card.
- Playwright: wheel, drag, double-click, keys; entering and leaving; a full generation and a Run in the focus view; geometry at both sizes and in projector mode, at every micro-step of two generations for the narration and the overlays; real-time change during Run; screenshots for the review.

## Build sequence

1. Throwaway static mock at 1920×1080 of the focus view (map, zoomed map, landscape), reviewed by the instructor.
2. The zoom/pan model and the city-number toggle (ordinary view).
3. Zoom and pan in the page (wheel, drag, keys, buttons, persistence).
4. The focus view shell: state, the layout, entering and leaving, the narration bar.
5. The route map in the focus view: the overlays and the small fitness graph.
6. The landscape in the focus view and its zoom.
7. Accessibility and projector pass.
8. Rendered review and sign-off; the push to `main` redeploys.

## Decided (after the mock, ticket 01: "all recommended")

- **Overlays:** the toolbar on the top left of the figure, the figures card on the top right (about 330 px wide), the simplified fitness graph on the bottom left (about 440 × 150 px, lines, the "now" mark and the reference lines with their words, no tick numbers). The map is fitted to the area the overlays leave free, so that no part of the tour lies under one of them.
- **Key:** `E` enters and leaves the focus view; Esc leaves it.
- **Graph:** a "× hide" on the graph hides it and a "Graph" toggle in the toolbar brings it back.

## Comments
