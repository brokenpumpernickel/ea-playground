# 03 The permutation representation in the engine

Status: resolved
Type: task (test-first)
Blocked by: 01
Spec: ../spec.md

## What to build

ADR 0007 accepted and the engine able to hold a permutation problem, with no change to any existing problem (golden runs unchanged, run before and after): the `Problem` declares `permutation: true` beside symbols and real; Fisher–Yates initialization (n − 1 uniform draws in a documented order, recorded as the initial events already are); hand-edited initial populations typed as city numbers ("1 5 3 2 4") validated with readable messages (a missing city, a repeated city, a number out of range, the wrong count); formatting and parsing of a tour (cities shown from 1, stored from 0); the **canonical route** (starting at city 1, in the direction whose second city is lower) and the undirected **edge set** as pure functions; copies of chromosomes never shared; the places that read `problem.alphabet` or compare chromosomes ask for the representation first. The metrics gain the permutation branch: distinct routes (by canonical route), the edge-based diversity (the mean share of edges two individuals do not have in common, 0 to 1) and the edge-agreement shares of the best tour, with the symbol and real measures absent rather than invented.

## Done when

- Initialization is a uniform random permutation, reproducible by seed, with the draws recorded; every initial individual is a permutation; hand-edited populations that are not permutations are refused in words.
- Formatting and parsing round-trip exactly; the canonical route of a rotation and of a reversal is the same route; the edge set ignores direction and rotation.
- The metrics are hand-worked on small tours (diversity 0 for identical routes and for rotations of one route, 1 for tours with no edge in common; the agreement shares).
- Golden runs reproduce exactly; `npm run check` clean; ADR 0007 status changed to accepted.

## Comments

## Answer
A `Problem` with `permutation: true` is a permutation problem (`isPermutationProblem`): its genes are the cities 0 to n − 1 (shown from 1), it has no alphabet and no bounds. Built test-first in `src/engine/permutation.test.ts` (24 tests, with a `tourLine(n)` problem in `test-support.ts`: n cities on a line, the shortest tour out and back):

- **Initialization**: a Fisher–Yates shuffle, for i from n − 1 down to 1 one draw u gives j = ⌊u·(i + 1)⌋ and genes i and j swap, so n − 1 draws per individual and none for one city; individuals in order, so the first individual does not depend on the population size; hand-worked against scripted draws; every individual a permutation for n = 2, 3, 5, 12 and 52 over many seeds, no shared arrays, reproducible by seed, and over 600 draws all 24 orders of four cities occur.
- **Hand-edited populations**: `parseTour` reads whole city numbers from 1 separated by spaces or commas (a word, a decimal or a sign gives nothing); `checkTour` names in words a city that appears twice or more, a number that is not one of the cities, and the missing cities; the refusals name the chromosome ("Chromosome 2: city 2 appears twice; city 3 is missing", "Chromosome 2 has 3 cities, but this problem needs 4"). `formatTour` is the exact form (cities from 1) and round-trips for every permutation of five cities.
- **Routes and edges**: `canonicalRoute` (starting at city 1, in the direction whose second city is lower; every rotation and reversal gives the same route, the input is untouched, tiny tours handled), `edgeKey` (the same in both directions) and `tourEdgeSet` (n edges for n cities, one for two, none for one).
- **Metrics**: `metricsOfProblem` takes the permutation branch: best, worst, average and best so far in fitness as ever; `diversity` is the mean over all pairs of 1 − (edges in common) / (edges per tour), computed from edge counts (c·(c − 1)/2 pairs share an edge that c individuals have) and checked against the direct pairwise computation on random populations; `distinct` counts distinct routes; the symbol counts and allele frequencies are empty; `tour.agreement` has, for each edge of the generation's best tour in tour order (the first if several tie), the share of the population that has it, and `tour.bestRoute` is that tour. (Edge agreement is of the generation's best tour, not the best so far: the run state does not keep the best-so-far individual. The glossary and spec say so.) Hand-worked cases: a rotation is the same route (diversity 0, three chromosomes but two routes), tours with no edge in common give 1.

Mutation-checked (12 mutants: the shuffle's loop bound and draw range, the canonical direction and its tiny-tour guard, the repeated-city and tour-length checks, the edge-set guard, the diversity's denominator and pair count, the tie rule, distinct counting, the agreement's denominator): each fails a test. Golden runs unchanged; 105 unit-test files / 1913 tests pass; `npm run check` clean; ADR 0007 is now accepted.
