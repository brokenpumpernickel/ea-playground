# 11 The surface view

Status: open
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
