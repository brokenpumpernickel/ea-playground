# 02 The real-valued representation in the engine

Status: resolved
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
A `Problem` with `bounds` (one `{lo, hi}` per gene) is a real-valued problem and has an empty alphabet; `isRealProblem` asks. Genes are the numbers themselves in `Chromosome`. Built test-first in `src/engine/real.test.ts` (14 tests, with a small `realSphere` problem in `test-support.ts`):

- **Initialization**: `lo + u·(hi − lo)`, one draw per gene in gene order, individuals in order (so the first individual does not depend on the population size); reproducible by seed; always inside the bounds; no two individuals share an array.
- **Hand-edited populations**: `parseReal` reads numbers separated by spaces or commas with `-` or `−`, decimals and exponents, and refuses words, `Infinity`, `NaN`, `1..2`, empty text; the refusals name the chromosome and say what is wrong ("may only contain numbers separated by spaces", "has 1 number, but this problem needs 2", "gene 1 (6) is outside its bounds from −5 to 5" from `checkReal`).
- **Formatting**: `formatReal(c, 3)` shows three decimals with a real minus sign (never "−0.000"); `formatReal(c)` is the exact form for data and share links and round-trips exactly.
- **Metrics**: `metricsOf(state, alphabetSize, bounds?)` and the new `metricsOfProblem(state, problem)`. For a real problem best/worst/average/distinct are as before, `symbolCounts` and `alleleFrequencies` are empty (absent, not invented), and diversity is the mean pairwise distance with each gene scaled to its bounds, divided by the diagonal of the unit box (0 for identical points or a single individual, 1 for opposite corners). The two UI callers (`session.svelte.ts`, `plot-models.ts`) now use `metricsOfProblem`.

Mutation-checked: dropping the division by the diagonal and drawing from `0..hi` instead of `lo..hi` each make tests fail. Golden runs unchanged; 83 files / 1465 unit tests pass; `npm run check` clean; build and the app and plots end-to-end specs pass. ADR 0006 is now accepted.
