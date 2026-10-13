# 03 The permutation representation in the engine

Status: open
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
