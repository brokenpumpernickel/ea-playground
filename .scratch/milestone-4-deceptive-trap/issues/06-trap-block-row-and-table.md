# 06 Block row, population table and chromosome names

Status: open
Type: task (test-first)
Blocked by: 01, 04
Spec: ../spec.md

## What to build

As decided in the mock (ticket 01): the block row above the chromosome columns, aligned with the gene cells for both linkages; the block contributions printed beneath each chromosome's blocks; the optimum and attractor marks (shape and word as well as colour); the table's Decoded and Fitness columns; an accessible name and sentence for each chromosome ("blocks 4 · 0 · 3 · 1 · 2, contributions 4 · 3 · 0 · …"). Pure models first (the block row, the per-chromosome block states), then the views, applied to every table that shows chromosomes (population, parents, evaluation, replacement).

## Done when

- Unit tests of the models and the server-rendered views against the engine's per-block numbers; rendered checks that the block row lines up with the gene cells (tight and loose, 20 and 30 genes); a geometric test at 1920×1080 and 1366×768 that no table is wider than its panel and no label overlaps another, for the default and for 6 × 5 loose.
- The other problems' tables are unchanged.

## Comments

## Answer
