# 10 The Landscape view and its heatmap

Status: open
Type: task (test-first)
Blocked by: 01, 07
Spec: ../spec.md

## What to build

The stage panel's second view "Stage view | Landscape" (as the schema tracker, with the narration bar still visible) and in it the **heatmap** of fitness as decided in the mock: the colour ramp with a labelled scale, isolines at fixed fitness levels with their values (the non-colour carrier), axes with ticks and labels, the optimum mark(s) with a label, the rule "fitness = −f" for the minimised functions, drawn on a canvas from a pure grid model (the fitness grid, the isoline segments, the colour index per cell) that is unit-tested; a text alternative (a sentence naming the function, the bounds, where the optimum is and the range of fitness).

## Done when

- The grid model equals the engine's fitness at every sampled point; isolines lie where the interpolated fitness crosses the level (tested on a function with a known level set); the optimum marks equal the known optima; the colour scale is monotone in fitness.
- Rendered check by reading canvas pixels at known points (the colour at the optimum is the top of the ramp, at the worst corner the bottom, for each function); geometric test at both sizes; reduced motion and projector mode; the other problems' stage panels are unchanged.

## Comments

## Answer
