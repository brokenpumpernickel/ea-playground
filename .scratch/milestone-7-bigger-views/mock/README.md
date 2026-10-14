# Mock of the focus view (throwaway)

Made by `make-screenshots.spec.ts.txt` (a Playwright script, kept as text so it does not join the test suite): it opens the real built app in projector mode at 1920×1080, takes the real route map, landscape figures, figures and narration, and re-arranges them into the proposed layout. Nothing here is app code, and the picture is a rough one: the figures are scaled copies of the small ones, so some details are artefacts of the mock and are **not** proposals (see the last section).

Screenshots in `screenshots/`:

| file | shows |
|---|---|
| `a-map-ulysses16.png` | the map of 16 cities at generation 62, the population's edges on, the layout |
| `b-map-berlin52.png` | 52 cities at generation 120, the crowded middle (numbers collide here, which is what the zoom is for) |
| `c-map-berlin52-zoomed-4x.png` | the same, zoomed 4× into the crowded middle: the numbers readable, dots and lines at their normal size, the "zoomed 4×" note |
| `d-landscape-himmelblau.png` | the heatmap and the surface side by side, each about twice its ordinary size |

## What replaces what

Kept: the top bar (problem, stage pills, generation), the transport with the speed control, the history strip. Replaced: the stage panel, the population table, the legend line and the three plots. The narration becomes a slim bar under the figure, so stepping stays readable.

## Proposals to accept or change

1. **Toolbar**: one row on the top left of the figure: *Back to the panels (E)*, the toggles (population's edges, optimal tour, **city numbers**), the selected-tour control, + and − zoom, *Reset view*, *Graph*. For the landscape: Back, *Zoom to population*, *Reset view*, trails, + and −, *Graph*.
2. **Figures card**: top right, about 330 px wide: best now, best so far, average, optimum, nearest neighbour with their gaps, and the key of the line styles (for the landscape: the generation's statistics).
3. **Fitness graph**: bottom left, about 440 × 150 px: the lines, the "now" mark and the reference lines with their words, without tick numbers; its sentence and the hidden table stay in the page for a screen reader.
4. **Hiding the graph**: a "× hide" on the graph and the *Graph* toggle in the toolbar bring it away and back.
5. **Key**: `E` enters and leaves; Esc leaves.
6. **Zoom**: wheel about the pointer, drag to pan, double-click or *Reset view* to return, + − 0 and the arrow keys when the figure has focus; a corner note says "zoomed 4× · wheel to zoom, drag to move, double-click to reset".

## Artefacts of the mock, not proposals

- The *published* tooltip of the optimum row and the key text in the figures card overlap or are cramped: the real card is laid out for this size.
- The landscape's titles are scaled up with the figures and run under the card and out of their boxes: in the build the figures are drawn at the larger size, with titles at their normal size.
- The graph is the ordinary one shrunk, so its text is small: the build draws the simplified graph at its own size (reference-line labels at 14 px or more).
- The first-draft overlay for 16 cities hides the top right corner of the tour under the card: in the build the map is fitted to the area left free by the card and the toolbar, so the whole tour is clear of the overlays.
