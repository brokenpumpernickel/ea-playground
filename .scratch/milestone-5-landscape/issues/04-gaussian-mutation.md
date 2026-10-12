# 04 Gaussian mutation and clamping

Status: open
Type: task (test-first)
Blocked by: 02
Spec: ../spec.md

## What to build

Gaussian mutation for real chromosomes with the per-gene mode (each gene mutates when its draw u is below pm) and the per-individual mode (one draw decides whether the individual mutates, then one draw picks the gene), the step being σ × the gene's range × z, z from a normal draw made from two uniform draws (Box–Muller, in a documented order, neither cached for later), the new value clamped to the bounds with clamped genes recorded. The event records every draw (u, the two uniforms, z, the step, before, after, clamped). `σ` is a parameter (positive, default 0.05); pm, the modes, the bypass and "mutation off" behave as for symbols; the symbol mutation (flip or replace) is refused for a real problem and Gaussian for a symbol problem, in words.

## Done when

- Hand-worked cases; the recorded step equals σ × range × z with z equal to the Box–Muller value of the recorded uniforms; property tests: results are inside the bounds, an unchanged gene is exactly unchanged, a clamped gene equals its bound, per-gene probabilities hold over many draws (statistically, with a fixed seed), per-individual mutates at most one gene.
- Seeded runs reproduce; the draws do not depend on how the run is advanced (micro-step, stage, generation).
- Symbol mutation and golden runs are unchanged.

## Comments

## Answer
