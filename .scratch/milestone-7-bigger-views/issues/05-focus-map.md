# 05 The route map in the focus view: overlays and the small fitness graph

Status: open
Type: task (test-first)
Blocked by: 03, 04
Spec: ../spec.md

## What to build

The map large in the whole area, with the overlays over its corners: the toolbar (toggles, selected tour, zoom buttons, Reset view, Back), the figures card (best now, best so far, average, optimum, nearest neighbour with their gaps, the key) and a simplified fitness graph (best of the generation, best so far, average, the optimum and nearest-neighbour lines, the "now" mark; the plot's sentence and hidden table kept; a way to hide it). The map's stage marks and selection work as in the panel view.

## Done when

- The figures card and the graph equal the metrics at every generation; the overlays stay inside the window and clear of each other at both sizes and in projector mode, at every micro-step of two generations; during Run the map and the graph change at every generation (a test) and Run at its fastest speed stays smooth for 52 cities and 60 individuals (a measured bound); every control named; keyboard only.

## Comments

## Answer
