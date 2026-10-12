# 01 Throwaway mock of the landscape screens

Status: claimed
Type: mock, review (needs instructor)
Blocked by: none
Spec: ../spec.md

## What to build

A static mock (plain HTML, CSS and canvas, hand-made data, thrown away afterwards) of the landscape screens at 1920×1080 in the style of the earlier mocks, reviewed by the instructor. It settles the visual choices before anything is built.

Screens: the **Landscape view** (the stage panel's second view) with the heatmap (colour ramp, labelled scale, isolines with values, axes, optimum mark(s)) and the rotatable surface (shaded height field, markers standing on it, hidden ones behind ridges, rotation buttons) side by side with the same population on both, for each of the four functions (single peak, two peaks, Rastrigin and Himmelblau, the last two drawn as fitness = −f with the rule stated); markers for elites, the best individual, a selected individual (highlighted on both views and in the table), parents of the current pair, children made so far, a mutated child with its before/after arrow, trails of 1, 3 and 5 generations; the population table for the real-valued representation (x, y, f for minimised functions, fitness) and for the binary-coded one (bits grouped by variable with a variable row, decoded x and y, fitness); the **crossover cards** for BLX-α (interval and draws per gene, clamping), arithmetic (λ and both results) and discrete, and for a binary-coded pair with decoded values and the distance moved (plain binary against Gray for the same bit flip); the **mutation cards** for Gaussian (u, z, step, before/after, clamping) and for bit flips with decoded displacement; the diversity plot and the spread panel; the drawer's landscape section (function, representation, bits per variable, operator with α, σ, ε, the restart notice listing what resets); the problem menu with Landscape in it. Also the stress cases: Rastrigin with 60 individuals, Himmelblau with four clusters, and 1366×768.

## Done when

- The instructor has reviewed the mock and decided: the colour ramp and isoline levels, the surface shading and mesh, the marker shapes and what each stage marks, the table cells (the pair cell, the variable row), the operator cards, and any layout change.
- The decisions are recorded in this file and in the spec's "To decide" list; screenshots are kept under `.scratch/milestone-5-landscape/mock/`.

## Comments
