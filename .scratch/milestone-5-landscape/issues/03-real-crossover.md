# 03 Crossover for real genes: BLX-α, arithmetic, discrete

Status: resolved
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
`CrossoverOperator` gains `'blx-alpha'` and `'arithmetic'` (real-only, listed in `realOnlyOperators`); `crossover(population, pairs, config, rng, bounds?)` takes the problem's bounds (the generation passes `problem.bounds`) and `CrossoverConfig` an optional `alpha` (default `defaultAlpha` = 0.5). Tests: `src/engine/crossover-real.test.ts` (22).

- **BLX-α**: after the pair's draw u, for each gene in order the draw for O1 then the draw for O2 (1 + 2 × genes draws); each child gene is `from + u × (to − from)` on `[min − α·d, max + α·d]`, clamped to the gene's bounds. The event records `alpha` and a `BlendGene` per gene (parents, d, widened interval, both draws, raw values, clamped flags); each child carries `clamped` per gene, and `sources` is empty because a blended gene is not a copy.
- **Arithmetic**: after the pair's draw, one λ; O1 = λ·A + (1 − λ)·B, O2 = (1 − λ)·A + λ·B; the event records `lambda`. Clamping is applied here too only as a guard against rounding and is recorded.
- **Discrete** (one-point, two-point, uniform) work on real vectors unchanged; with two genes two-point is refused with the existing words.
- **Bypass and off** give fresh-array copies with no operator draws and no `blend`/`lambda` in the event; a real-only operator for a symbol problem is refused in words even when crossover is switched off; α must be a number of 0 or more. (The reverse refusal, a symbol-only operator for a real problem, has nothing to refuse: the symbol operators are the discrete ones.)
- Hand-worked cases for each operator, clamping at both bounds, α = 0, equal parents, λ = 0 and 1; property tests over 300 generated pairs (BLX-α inside the widened interval and the bounds, the recorded draws reproduce the children and the clamp flags, arithmetic equals the formula and stays inside the parents' box, no shared arrays).
- Mutation-checked (mirror weights swapped, interval widened, clamp removed): each fails tests. A whole-generation test needs the mutation stage to accept real genes, so it moved to ticket 04's "Done when".

Golden runs unchanged; 84 files / 1487 unit tests pass; `npm run check` clean.
