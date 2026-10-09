# 11 Metrics

Status: open
Type: task (test-first)
Blocked by: 09
Spec: ../spec.md

## What to build

Per-generation metrics recorded with the run:

- Best of generation, best so far (kept distinct), average, worst, and the evaluation count.
- Mean pairwise Hamming distance (normalised to [0, 1]), number of distinct chromosomes, and per-position allele frequencies.
- Metrics are computed from the snapshot, so they can be regenerated with it.

## Tests (write first)

- Hand-computed values on the textbook population (average 292.5, best 576).
- Best so far never decreases, and differs from best of generation after a bad generation (construct one with fixed values).
- A population of identical chromosomes has diversity 0 and 1 distinct chromosome; a maximally spread one has the expected distance.
- Allele frequencies sum correctly per position.

## Comments
