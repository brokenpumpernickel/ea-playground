# 02 Fitness sharing in the engine

Status: open
Type: task (test-first)
Blocked by: 01
Spec: ../spec.md

## What to build

The triangular sharing kernel, niche counts (the individual itself counts 1), shared weights; roulette spins on the chain's weights divided by the niche counts and tournament compares shared weights (Shift first when fitness can be negative); a `sharing` event (σ, α, the weights before, the niche counts, the shared weights) before the probabilities or tournaments; the tournament event carries each contestant's shared weight; the random draws are exactly those of the same run without sharing.

## Done when

- Hand-worked niche counts on a small population; σ above every distance divides by N and σ below every distance is no change; the minimised functions go through Shift; the draws unchanged; the events agree with the choices; a seeded run reproducible; niching none is bit-for-bit what it was (goldens).

## Comments

## Answer
