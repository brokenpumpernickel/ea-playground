# 06 The TSP problem, its instances and distance rules

Status: resolved
Type: task (test-first)
Blocked by: 03
Spec: ../spec.md

## What to build

The `tsp` problem: the closed tour length as objective, fitness = −length, the decoded text (the canonical route), columns (the tour length, the gap to the optimum, Fitness with the note "= −length"). **Distance rules** exactly as TSPLIB publishes them (EUC_2D: Euclidean rounded to the nearest integer; ATT: the pseudo-Euclidean with its rounding; GEO: the great-circle formula on degrees and minutes, truncated) plus real Euclidean for the own instances. **Instances** as data files with name, comment, distance type, coordinates, source and optimal tour: **burma14, ulysses16, ulysses22, att48, eil51, berlin52** (TSPLIB, Reinelt 1991), and the own **Circle** (n 5 to 15; the optimum is the perimeter), **Two clusters** (fixed, 12 cities) and **Random** (n 5 to 15, a seed; uniform in a square). **Held–Karp** for the exact optimum of the own random and cluster instances (and burma14), **brute force** for n ≤ 8 to check it, the **nearest-neighbour tour** from city 1 (ties to the lower number), the default ε, and option validation with readable messages (an unknown instance, n out of range).

## Done when

- Each distance rule on hand-worked pairs; every stored TSPLIB optimal tour recomputes to the published optimum (ulysses16 6859, ulysses22 7013, att48 10628, eil51 426, berlin52 7542) and burma14's 3323 is found by Held–Karp; Held–Karp equals brute force on every instance of up to 8 cities and on seeded random ones; the circle's optimum equals its perimeter; a seeded random instance is identical on every call; the nearest-neighbour tour is hand-worked on a small instance; fitness = −length for every individual.
- The data files carry their source and the instance information line says which distance rule applies.

## Comments

## Answer
`src/engine/tsp.ts` (options `{ instance, n, seed }`, default `ulysses16` pending ticket 13) and the data files `src/engine/tsplib/*.json` (burma14, ulysses16, ulysses22, att48, eil51, berlin52: name, comment, rule, source "TSPLIB (G. Reinelt, 1991): <name>.tsp and <name>.opt.tour", the published optimum, the coordinates, the optimal tour). Built test-first in `src/engine/tsp.test.ts` (34 tests):

- **Distance rules** as TSPLIB publishes them, on hand-worked pairs: EUC_2D (nearest whole number, halves up), ATT (√((dx² + dy²)/10), rounded to the nearest and up when that rounded down: 4, 8, 10, 5 for the worked cases), GEO (great circle on degrees.minutes with R = 6378.388 and π = 3.141592, truncated plus one: one degree on the equator is 112; two equator pairs pin the two constants, since with R = 6378.4 the first would be 1066 and with π = 3.14159 the second would be 911) and plain Euclid for the own instances; all symmetric.
- **Optima**: the stored optimal tour of ulysses16, ulysses22, att48, eil51 and berlin52 is a permutation whose length under the implemented rule is exactly the published 6859, 7013, 10628, 426 and 7542; burma14 has no tour file, and Held–Karp finds its published 3323 (the instance stores that tour). Held–Karp equals brute force on seeded random instances of 1 to 8 cities (and with tied integer distances) and refuses more than 16 cities in words; the circle's optimum is its perimeter n·2R·sin(π/n) and Held–Karp agrees (n = 5 to 13); the two-cluster instance (12 cities, the optimum visits each group in one stretch) has the optimum 548.3163389389227, found by Held–Karp and, independently, by brute force over all 11! tours once, off line; a random instance (n 5 to 15, uniform in 100 × 100 to one decimal, x then y per city from the seed, so more cities extend the same list) is reproducible and its optimum is Held–Karp's (checked against brute force at 9 cities, and 15 cities work).
- **Nearest neighbour** from city 1 (ties to the lower number), hand-worked on a line; every instance has one, berlin52's is 8,980.
- **The problem**: a permutation problem with fitness = −length (never −0), the decoded text the canonical route, `knownOptimumFitness` = −optimum (the optimal tour scores exactly that on every instance), columns Length (objective), Gap ("to 7,542") and Fitness ("= −length") with thousands separators, whole numbers for TSPLIB and one decimal for the own instances, `scoreText` ("length 8,980, 19.1% over the optimum 7,542", "length 7,542, the optimum"), `gapOf`, `lengthOf`, a population of it can be started and scored, and the default ε (0.5 for whole-number distances, so "within ε" means the optimum; a millionth of the optimum for real ones).
- **Options** validated in words under their fields: an unknown instance (with the choices), the number of cities (5 to 15, circle and random only), the seed (0 or more, random only); `tspProblem` throws the first message.

Mutation-checked (23 mutants over the rules, the constants, the Held–Karp edge cases, the nearest-neighbour tie rule, the validation, the random coordinates and cache key, the gap, the columns, the default ε and the canonical decoded text): each fails a test; four survived at first (the two GEO constants, the random rounding and the "the optimum" sentence), and tests were added that kill them. The only intentional equivalence is Held–Karp's tie rule, which changes the tour found but not its length. Golden runs unchanged; `npm run check` clean; the whole unit suite passes.
