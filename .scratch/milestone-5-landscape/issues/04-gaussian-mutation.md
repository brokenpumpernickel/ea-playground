# 04 Gaussian mutation and clamping

Status: resolved
Type: task (test-first)
Blocked by: 02
Spec: ../spec.md

## What to build

Gaussian mutation for real chromosomes with the per-gene mode (each gene mutates when its draw u is below pm) and the per-individual mode (one draw decides whether the individual mutates, then one draw picks the gene), the step being σ × the gene's range × z, z from a normal draw made from two uniform draws (Box–Muller, in a documented order, neither cached for later), the new value clamped to the bounds with clamped genes recorded. The event records every draw (u, the two uniforms, z, the step, before, after, clamped). `σ` is a parameter (positive, default 0.05); pm, the modes, the bypass and "mutation off" behave as for symbols; the symbol mutation (flip or replace) is refused for a real problem and Gaussian for a symbol problem, in words.

## Done when

- Hand-worked cases; the recorded step equals σ × range × z with z equal to the Box–Muller value of the recorded uniforms; property tests: results are inside the bounds, an unchanged gene is exactly unchanged, a clamped gene equals its bound, per-gene probabilities hold over many draws (statistically, with a fixed seed), per-individual mutates at most one gene.
- Seeded runs reproduce; the draws do not depend on how the run is advanced (micro-step, stage, generation).
- Symbol mutation and golden runs are unchanged.
- A whole-generation test on the real sphere (tournament selection, BLX-α and arithmetic crossover, mutation on and off): population size kept, genes inside the bounds, reproducible by seed. It could not be written in ticket 03 because the generation still called the symbol mutation, which refuses a gene without an alphabet; the generation must pass the bounds to the mutation as it now does to the crossover.

## Comments

## Answer
`mutate(offspring, config, rng, alphabetSize, bounds?)` is Gaussian when the problem has bounds and flip/replace otherwise; `MutationConfig` gains an optional `operator` (`'flip' | 'gaussian'`, absent means the representation's own) and `sigma` (default `defaultSigma` = 0.05). The generation passes `problem.bounds` to both crossover and mutation. Tests: `src/engine/mutation-real.test.ts` (25).

- **Draws**: the decision draws are exactly the symbol ones (per gene: one `u` per gene, all of them; per individual: `u`, then `r` when `u < pm`), then for each mutating gene in order `u1` and `u2`. `z = √(−2 ln(1 − u1)) · cos(2π u2)` (1 − u1 keeps `u1 = 0` at z = 0 instead of an infinity; the second value of the pair is not kept); step = σ × (hi − lo) × z; raw = before + step; the result is raw clamped to the gene's bounds.
- **Event**: `sigma` and, when some gene mutated, `gaussian`: per mutating gene `{gene, u1, u2, z, range, step, before, raw, after, clamped}`; `flipped` lists the genes chosen to mutate (even if clamping left the value where it was); the usual `geneDraws`, `individualDraw`, `chosenGene`, `decision`, `before`/`after`. Switched off draws nothing and gives a copy (bypass), as for symbols.
- **Refusals in words**: flip for a real problem ("Flip mutation is for symbol chromosomes; use Gaussian mutation for a real-valued problem"), Gaussian for a symbol problem, σ not greater than 0 or not finite, probability outside 0 to 1.
- Hand-worked cases (step 0.5 × z at range 10, z = ±1, 0, ±2; clamping at both bounds; per-gene ranges; per-individual); property tests over 400 draws (recorded z, step, raw and clamp equal the formulas; an unchanged gene is exactly unchanged; a clamped gene equals its bound; per-individual changes at most one gene); statistics with a fixed seed (z mean and standard deviation, fraction of mutating genes ≈ pm); whole generations on the real sphere with each crossover operator (and none) and mutation on and off: size kept, genes inside the bounds, reproducible by seed.
- Mutation-checked (range dropped from the step, cos replaced by sin, clamp removed, ln u1 instead of ln(1 − u1)): each fails tests.

Golden runs unchanged; 85 files / 1512 unit tests pass; `npm run check` clean.
