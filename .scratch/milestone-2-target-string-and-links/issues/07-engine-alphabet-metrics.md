# 07 Engine: per-position symbol counts and general diversity

Status: resolved
Type: task (test-first)
Blocked by: 05
Spec: ../spec.md

## What to build

Metrics that make sense for any alphabet:

- Per-position symbol counts (for each gene position, how many individuals have each symbol), added to `GenerationMetrics`. The existing `alleleFrequencies` stays for binary problems and is derived from the counts.
- Diversity (mean pairwise normalised Hamming distance) computed from the counts: pairs that differ at a position = `(N² − Σ c²) / 2`, divided by the number of pairs and the length. It must give identical values for binary (golden tests) and agree with a direct pairwise computation for larger alphabets.
- Distinct chromosomes and best/worst/average stay as they are.

## Done when

- Golden metrics unchanged.
- Tests comparing the count-based diversity with a brute-force pairwise computation on random populations over alphabets of 2, 3 and 27 symbols; the all-equal and all-different extremes; a population of one.

## Comments

## Answer

`metricsOf(state, alphabetSize = 2)` now also returns `symbolCounts[gene][symbol]`, and computes diversity from them: at each position the pairs that differ are `(N² − Σ c²) / 2`, summed over positions and divided by the number of pairs and the length. For two symbols this is exactly the old `k·(N − k)` formula, so every golden metric is unchanged. `alleleFrequencies` stays (the share of symbol 1 at each position) and is derived from the counts. A gene outside the alphabet it is measured against is refused with a clear message instead of being miscounted. The result is cached per state and alphabet size.

While generalising I found and fixed a latent bug: the distinct-chromosome count joined genes as digits, so over an alphabet of more than ten symbols `[1, 12]` and `[11, 2]` would have counted as the same chromosome; genes are now joined with a separator (binary counts are unchanged).

`golden-support.ts` records the metrics as they were when the fixtures were made (nine named fields), so the new field does not count as a change to a binary run; the fixtures themselves have no diff. The UI's two callers (the session and the plot model) pass the problem's alphabet size.

Tests (`metrics-alphabet.test.ts`, 12): counts on a hand-worked population; counts add up to the population size over 27 symbols; binary allele frequencies as before; the out-of-alphabet refusal; the count-based diversity equals comparing every pair for 50 random populations each over 2, 3 and 27 symbols; the extremes (identical, all different) and a population of one; a worked example; the digit-ambiguity case; and the cache not returning a stale answer for a different alphabet size. All 885 tests (including the 45 golden), `npm run check` and the 93 Playwright tests pass.
