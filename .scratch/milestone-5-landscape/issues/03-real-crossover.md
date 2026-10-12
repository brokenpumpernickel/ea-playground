# 03 Crossover for real genes: BLX-α, arithmetic, discrete

Status: open
Type: task (test-first)
Blocked by: 02
Spec: ../spec.md

## What to build

The crossover operators for real chromosomes, with their draws recorded in the crossover event as the symbol operators record theirs: **BLX-α** (per gene, in gene order, one uniform draw from [min − α·d, max + α·d], d = |a − b|, clamped to the bounds with the clamped genes named; α is a parameter, 0 or more, default 0.5), **whole arithmetic crossover** (one λ per pair, drawn uniformly from [0, 1]; children λ·A + (1 − λ)·B and (1 − λ)·A + λ·B), and one-point, two-point and uniform discrete recombination working on real vectors exactly as on symbols (with two genes, two-point is refused in words). The crossover probability draw, the bypass (copies of the parents, with no operator draws) and "crossover off" behave as for every problem; parameters are validated per representation (a real-only operator for a symbol problem is refused, and the reverse).

## Done when

- Hand-worked cases for each operator; property tests over generated parents: BLX-α children lie in the widened interval and, after clamping, in the bounds; α = 0 gives children inside the parents' box; arithmetic children are exactly λ·A + (1 − λ)·B and the mirror, and inside the parents' box; the recorded draws reproduce the children; clamping is recorded and exact.
- Bypass and "off" give copies with no operator draws; children never share arrays with parents; the draw order is documented in the event type.
- Symbol crossover and golden runs are unchanged.

## Comments

## Answer
