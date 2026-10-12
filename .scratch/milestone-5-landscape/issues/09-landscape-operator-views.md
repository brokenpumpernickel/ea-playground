# 09 Operator views: real genes, and decoded values for binary-coded ones

Status: open
Type: task (test-first)
Blocked by: 08
Spec: ../spec.md

## What to build

As decided in the mock: the crossover card for **BLX-α** (per gene the interval, the widened interval and the draw), **arithmetic** (λ, both results with the weights) and **discrete** operators on real pairs, with children as pairs and clamped genes marked; the mutation card for **Gaussian** (per gene u, and for a mutating gene the two uniforms, z, the step σ × range × z, before and after, clamping marked), per gene and per individual; and for binary-coded chromosomes the existing crossover and mutation views with each chromosome followed by its decoded (x, y) and, for a child or a mutated gene, how far the point moved in decoded space, in plain binary and in Gray. Pure models first (read from the recorded events only), then the views; bypasses shown as bypasses; the narration sentences.

## Done when

- Models equal a direct recomputation from the events (every number shown is an event's number or a function of them); property tests over generated runs for all operators and representations; rendered checks and geometric tests at both sizes at every micro-step of two generations (no overlap, no clipping, widths stable), with the narration inside its box.
- Other problems' views are unchanged.

## Comments

## Answer
