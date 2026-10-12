# 12 The population on the views: markers, selection, stage marks, trails

Status: open
Type: task (test-first)
Blocked by: 09, 11
Spec: ../spec.md

## What to build

The population on both the heatmap and the surface, as decided in the mock: a marker per individual at its decoded point (shape and outline, not colour alone) with its id; elites, the best individual of the generation, a selected individual (a click on a marker, a click on a table row or the keyboard equivalent highlights it on both views and in the table); the stage marks while stepping (the parents of the current pair, the children made so far, a mutated child with an arrow from before to after, clamped genes noted); **trails** of the last 1, 3 or 5 generations as fading marks (off by default); a text alternative (a sentence of where the population is and where the best is, and a hidden table of positions and fitness); markers hidden when behind a ridge on the surface. Follows the history cursor.

## Done when

- The marker positions equal the recorded populations (data attributes) for every generation shown, in both representations; the highlighted individual is the same in the table and on both views; stage marks equal the events at the cursor; trails equal earlier populations; no marker is drawn outside the plot.
- Keyboard operation of the selection; no control without a name; reduced motion; geometric tests at both sizes at every micro-step of two generations with 12 and 60 individuals.

## Comments

## Answer
