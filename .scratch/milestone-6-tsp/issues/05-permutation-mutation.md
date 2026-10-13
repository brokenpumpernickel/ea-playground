# 05 Swap, inversion and insertion mutation

Status: open
Type: task (test-first)
Blocked by: 03
Spec: ../spec.md

## What to build

The three permutation mutations as engine operators with their events: **per individual** (one draw u against pm decides; then the positions are drawn in a documented order and recorded), **swap** (two distinct positions exchanged), **inversion** (the slice between two positions reversed, a 2-opt move) and **insertion** (the city at one position removed and put at another). Mutation off leaves the chromosome unchanged; a bypass is recorded as such; the refusal rules as for crossover (flip and Gaussian for a permutation, and these for the others).

## Done when

- Hand-worked cases and property tests: every result is a permutation that differs from the original in exactly the positions the event states (swap: two; inversion: the slice; insertion: the span between the two positions); inversion changes exactly two edges, swap at most four, insertion at most three (for non-adjacent positions), which the event reports as the edges removed and added.
- pm = 0 and pm = 1; n = 3; no shared arrays; reproducible by seed.

## Comments

## Answer
