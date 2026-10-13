# 08 TSP in the registry, links and the drawer

Status: open
Type: task (test-first)
Blocked by: 06, 07
Spec: ../spec.md

## What to build

The problem menu gains **TSP** (logo `Ts`) with its own defaults (provisional until ticket 13), seed and restart notice; the drawer's setup section (the instance grouped by size with its information line, n for the circle, n and the seed for the random one, the instance's optimum and nearest-neighbour length, the TSPLIB attribution), the crossover type (OX, PMX, CX) and probability, the mutation type (swap, inversion, insertion) with its per-individual probability and the sentence saying so, stop criteria including "within ε of the optimum", and the usual pending-change and restart rules; the operators not valid for a permutation are not offered; share links carry the instance and its options and parameters and a hand-edited population exactly; every bad-option case gets a readable message and applies nothing; presets of the other problems unchanged.

## Done when

- Menu, drawer, restart notice, links and validation tests as for the landscape; an operator that does not exist for the representation is refused in the drawer and in links in words; every control has a name; the other problems' menus and links are unchanged.
- Playwright: choosing TSP through the menu restarts through the notice, each control restarts or waits as its label says, a link opens the same run in a fresh page.

## Comments

## Answer
