# 11 The surface view

Status: resolved
Type: task (test-first)
Blocked by: 10
Spec: ../spec.md

## What to build

The rotatable **surface** of the same landscape beside the heatmap, drawn by this app on a canvas (no dependency): a pure projection model (azimuth and elevation, perspective, depth ordering of the mesh quads by the painter's algorithm, the same shading and colour ramp as the heatmap by fitness, the mesh resolution decided in the mock) with a function that says where a point (x, y, fitness) lands on the screen and whether a ridge hides it; rotation by dragging, by the arrow keys on the focused view and by buttons (left, right, up, down, reset) with names; no rotation animation under reduced motion.

## Done when

- The projection is unit-tested (a point projects where the maths says for several angles; the corners keep their order under rotation; a point behind a ridge is reported hidden and one in front is not); the shading is monotone in fitness along a ridge.
- Rendered check by reading pixels at known projected positions; the controls work by keyboard and by buttons; the view keeps its size from generation to generation; geometric tests at both sizes.

## Comments

## Answer
The rotatable surface of the same landscape beside the heatmap, drawn on a canvas by this app (no dependency; the single-file `file://` build is unchanged).

- **Projection model** (`surface-projection.ts`, pure): the camera (azimuth, elevation; starts at the mock's −0.7 and 0.9 rad), `rotate` (left and right turn by 0.25 rad, up and down tilt by 0.125 rad, reset), `dragBy` (right turns right, up tilts up) with the tilt kept between 0.08 and 1.45 rad and the azimuth free; the perspective projection of (x, y, fitness) onto the canvas (the mock's formula with a weaker perspective and a smaller, higher picture, because the mock's pushed the near corner of the floor off the bottom; a test now requires the four floor corners and the highest point to be on the canvas at the starting camera for every function); the 44 × 44 mesh sorted from the farthest to the nearest (painter's algorithm); each cell's colour is the heatmap's ramp of its fitness times a lighting factor from a fixed light (0.72 in shade to 1.12 in full light, 1.02 on level ground); an **item buffer** (`rasterise`) saying which cell is on top at each pixel and `isHidden`, which says a point of the surface is hidden when a different cell than its own or its neighbours' covers its pixel (a pixel no cell covers hides nothing: the apex of a narrow hill is above the mesh, and a point off the canvas is out of view, not behind anything). The markers of the next ticket use it.
- **Drawing and controls** (`surface-draw.ts`, `Surface.svelte`, `LandscapeView.svelte`): every cell filled and faintly edged, the floor's frame with x and y named, the optimum ✕ at its height; dragging turns the surface (the pointer is captured), the arrow keys turn it while it has focus (and then do not step the run; with the focus elsewhere they step as always), and a row of named buttons in the toolbar ("Rotate the surface left", "Rotate the surface right", "Tilt the surface up", "Tilt the surface down", "Reset the view of the surface"); there is no animation, so reduced motion changes nothing; the camera is a view setting that survives switching tabs, steps and generations and starts over with the run.
- **Also fixed on the way** (heatmap): isoline labels collided near a narrow hill ("0.80" printed over "0.60"); `placeLabels` (pure, tested) puts each label on its own line near the anchor, clear of the edges, of the other labels and of the optimum marks, or omits it.
- **Tests**: `surface-projection.test.ts` (17: the camera and its limits; a point lands where the formula says for several angles, including the plan view; the floor's corners keep their order under every rotation as a ring that never crosses itself; the mesh is 44 × 44 and ordered back to front with the engine's fitness at every corner; shading bounds and real variation, level ground exactly 1.02, a lit flank brighter than the far one; the base colour monotone in fitness along a ridge; a point behind a ridge is hidden, one in front and the hill's own top are not, and seen from above nothing is hidden; the item buffer's codes; the starting view fits the canvas), `landscape-grid.test.ts` (labels, 21 in all), and `e2e/landscape-surface.spec.ts` (15): the surface beside the heatmap with the five named buttons, buttons, arrow keys and dragging against the model's own steps, the clamp of the tilt, 100+ canvas pixels per function read back at cell centres and compared with the cells' colours (for the starting camera and a turned one) and the optimum mark white at its projected point, the canvas keeping its size from generation to generation and when turned, restart returning the camera, and heatmap, surface and controls inside the panel and clear of the narration for every function in the starting camera and the extreme tilts and turns at 1920×1080 and 1366×768 with and without projector mode. Mutation-checked (sort order, rotation sign, the empty-pixel rule, depth sign, constant lighting, drag): each fails tests.

Not in this ticket: markers on the surface and heatmap (12), a table of positions (12), the metrics panels (13).

Golden runs unchanged; `npm run check` clean; 99 unit-test files / 1809 tests pass; the whole end-to-end suite (492 tests) passes.
