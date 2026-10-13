# 06 The TSP problem, its instances and distance rules

Status: open
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
