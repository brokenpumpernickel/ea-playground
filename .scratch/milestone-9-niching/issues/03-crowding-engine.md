# 03 Deterministic crowding in the engine

Status: open
Type: task (test-first)
Blocked by: 01
Spec: ../spec.md

## What to build

Selection becomes a random order in which every individual is a parent once (an odd population adds one extra random parent) with its events; pairing, crossover, mutation and evaluation as today; the crowding replacement: each child duels the nearer parent (the matching with the smaller total distance, the first matching on equal totals), replaces it only if strictly better (ties keep the parent), the children take their parents' places; `duels` in the replacement event; elites and truncation ignored; the population size constant.

## Done when

- A hand-worked pair; matching by total distance; strict improvement and the tie; size constant; every individual a parent once and the odd case; events replay to the population; reproducible; the run layer's playback tiers agree.

## Comments

## Answer
