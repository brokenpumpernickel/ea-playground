# 06 Landscape runs: reproducibility, bounds, metrics, the stop within ε

Status: open
Type: task (test-first)
Blocked by: 03, 04, 05
Spec: ../spec.md

## What to build

Run-level tests and whatever small engine additions they need: the diversity measure in decoded space (mean pairwise distance normalised by the diagonal of the bounds, 0 to 1) and the spread (standard deviation of x and of y as a share of each range) in the metrics for the landscape in both representations (and the Hamming diversity of the symbol problems kept for binary-coded runs); the stop criterion "target fitness reached" as "within ε of the optimum fitness" (ε a parameter, default 1e-3 of the function's fitness range) for the landscape, unchanged for the other problems.

## Done when

- A seeded landscape run is identical by micro-step, stage, generation, run-until and every playback tier, for all three representations and all operators; the events alone reproduce every population (also with elites and truncation); every individual of every generation is inside the bounds; odd mating pools, bypasses and size invariants hold.
- Diversity and spread equal a direct computation; the stop within ε fires exactly when the best fitness is within ε of the optimum and never otherwise; the other problems' metrics and stops are unchanged (golden runs).

## Comments

## Answer
