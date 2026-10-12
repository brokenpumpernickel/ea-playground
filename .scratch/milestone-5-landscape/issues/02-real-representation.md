# 02 The real-valued representation in the engine

Status: claimed
Type: task (test-first)
Blocked by: 01
Spec: ../spec.md

## What to build

ADR 0006 accepted and the engine able to hold a problem whose genes are numbers inside bounds, with no change to any existing problem (golden runs unchanged, run before and after): the `Problem` declares its representation (symbols with an alphabet, or real with per-gene bounds); uniform random initialization inside the bounds (one draw per gene, in gene order, recorded as the initial events already are); hand-edited initial populations of numbers validated against the bounds with readable messages; formatting and parsing of a real chromosome (numbers separated by spaces, three decimals shown, full precision kept); copies of chromosomes never shared; the places that read `problem.alphabet` (metrics' allele counts, parsing, initialization) ask for the representation first and a real problem is not given an alphabet.

## Done when

- Initialization draws are uniform inside the bounds and reproducible by seed; every initial gene lies within its bounds; hand-edited populations outside the bounds or of the wrong length are refused in words.
- Formatting and parsing round-trip exactly for the numbers the app produces (shown to three decimals, stored in full).
- Metrics (best, average, worst, distinct points) work for a real problem; the allele frequencies are absent rather than invented.
- Golden runs reproduce exactly; `npm run check` clean; ADR 0006 status changed to accepted.

## Comments

## Answer
