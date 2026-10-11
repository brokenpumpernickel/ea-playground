# 07 Engine: per-position symbol counts and general diversity

Status: open
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
