# 01 Throwaway mock of the focus view

Status: resolved
Type: prototype (needs instructor review)
Blocked by: none
Spec: ../spec.md

## What to build

A static page at 1920×1080 that shows the focus view: the route map of ulysses16 and of berlin52 over the whole centre of the screen with the overlays (toolbar, figures card, simplified fitness graph, narration bar), a zoomed-in state with the numbers at full size, and the landscape's heatmap and surface side by side with the same overlays. Real instance data, real tours, a hand-made run; nothing in it is app code. A README names the decisions it proposes (the overlay places and sizes, the key, whether the graph can be hidden).

## Done when

- The instructor has reviewed the screenshots and accepted or changed each proposal; the choices are recorded in the spec's "To decide" list.

## Comments

## Answer

The mock is in `../mock/` (README and four 1920×1080 screenshots; the script that made them is kept as `make-screenshots.spec.ts.txt`). The instructor reviewed it and answered **"All recommended"**: the toolbar top left, the figures card top right, the fitness graph bottom left (about 440 × 150 px, no tick numbers), `E` (and Esc) for the focus view, and a "× hide" on the graph with a "Graph" toggle to bring it back. Recorded in the spec's "To decide" list. The mock's artefacts (the optimum row's tooltip over the card, the landscape titles scaled up with the figures, the shrunk graph's small text, the 16-city tour's corner under the card) are not decisions; tickets 04 to 06 must avoid them (the map is fitted to the area the overlays leave free).
