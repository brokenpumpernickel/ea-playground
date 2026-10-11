# 02 Golden-run fixtures for the binary engine

Status: open
Type: task (test-first)
Blocked by: none
Spec: ../spec.md

## What to build

Before any engine change, record the exact output of the existing engine as test fixtures, so the generalisation in tickets 05–07 can be proven not to change a single binary run.

For fixed seeds, record populations after every generation, the recorded events of selected generations, and the metrics, for: the default configuration; each of the four Goldberg presets; both mutation modes; elites 0 and 2; offspring truncation on; tournament and roulette (with a Rank and Linear ranking chain); one-point, two-point and uniform crossover; and an odd mating pool. Store them as JSON fixtures next to a test that regenerates the run and compares everything, field by field, with a readable diff on failure.

## Done when

- The golden tests pass on the current engine and fail (proven once by a deliberate change, then reverted) when any draw, field or value changes.
- They run as part of `npx vitest run`, take only a few seconds, and are documented in a comment saying how to regenerate the fixtures and why that must never be done to make a failure go away.

## Comments
