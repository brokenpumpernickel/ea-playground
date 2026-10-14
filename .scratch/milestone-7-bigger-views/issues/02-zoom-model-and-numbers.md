# 02 The zoom model and the city-number toggle

Status: open
Type: task (test-first)
Blocked by: 01
Spec: ../spec.md

## What to build

A pure model of the map's view: zoom about a point (the point stays under the pointer), limits 1× and 40×, pan with clamping so the picture cannot be dragged out of sight, reset, zoom by a step about the centre, the on-screen size rule (dots, lines, rings, numbers keep their size), and which numbers are shown at which zoom (the milestone 6 sizes for the whole map, full size once zoomed in far enough). The **City numbers** toggle in the map's toolbar, on by default, kept with the other two toggles across steps and restarts.

## Done when

- Unit tests of the model (zoom about a point, limits, pan clamps, reset, step zoom, number sizes by zoom and city count, never a label outside the picture); the toggle hides and shows every number and survives steps and a restart (Playwright); the ordinary view is otherwise unchanged.

## Comments

## Answer
