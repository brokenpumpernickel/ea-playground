# 11 Metrics

Status: resolved
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

## Answer

Done test-first (decisions, interface and seams agreed with the instructor beforehand). 353 tests pass in total (21 new, in `src/engine/metrics.test.ts`); `npm run check` and `npm run build` are clean. A deliberate breakage of the diversity formula (counting `k × size` instead of `k × (size − k)` pairs) was caught by six tests, then reverted.

Public interface (`src/engine/index.ts`): `metricsOf(state: RunState): GenerationMetrics`, where `GenerationMetrics` is `{ generation, best, worst, average, bestSoFar, evaluations, diversity, distinct, alleleFrequencies }`.

Definitions, as agreed:

- `best`, `worst`, `average`: maximum, minimum and mean fitness of the **current population**. `best` and `worst` give the min–max band for the fitness plot.
- `bestSoFar` and `evaluations` come straight from the run state, so `best` can fall below `bestSoFar` (tested with a generation made of four copies of the 64-fitness individual after a best of 576).
- `diversity`: the mean Hamming distance over all pairs of individuals divided by the chromosome length, so 0 for identical chromosomes and 1 for a complementary pair. One individual has no pairs, so 0. The textbook population gives 17/6/5 ≈ 0.567; two zeros and two ones give 4/6.
- `distinct`: the number of different chromosomes (genes only; equal fitness does not make two chromosomes the same).
- `alleleFrequencies`: per gene, the share of individuals with a 1. The textbook population gives 0.5, 0.75, 0.25, 0.25, 0.5, exactly the mock's strip.
- An empty population is refused with `Cannot compute metrics for an empty population`.

Notes:

- **Linear time.** Diversity is computed from per-gene counts (k ones among N individuals give k(N − k) differing pairs at that gene), so it costs N × L, not N² × L. A test compares it with a direct pairwise calculation on 60 random populations of 1–40 individuals at two chromosome lengths. Timing probe (not kept as a test, since timing tests flake): building and scoring 2,000 populations of 500 took under a second in total.
- **Memoized per state object.** States are never modified, so `metricsOf` caches in a `WeakMap`; asking again for the same state returns the same object, and a plot redrawing after one more generation only computes the new point. Entries disappear with the states.
- **Derived, not stored.** The run contract and `Snapshot` are unchanged. A series is `run.snapshot(c).state` mapped through `metricsOf`; the same seed gives the same series (tested through the run layer with the event cache off). ADR 0003's "metrics per cycle" is satisfied per algorithm for now; a generic contract hook can be added when a second algorithm shows what it needs.
- The mock's "evaluations 4" and "4 of 4 distinct" readouts come straight from these fields.

Notes for later tickets:

- Ticket 18 builds the plots from `metricsOf` over `run.snapshot(0..lastCycle)`. For the dimmed future (generations after the cursor) it can use the same series and just style the part beyond the cursor.
- Metrics are for binary chromosomes (Hamming, share of ones). The other examples need their own versions: target string (distinct characters per position), trap (the same, with block fitness), landscape (distance to centroid, per-variable standard deviation). That belongs to their milestones.

## Comments
