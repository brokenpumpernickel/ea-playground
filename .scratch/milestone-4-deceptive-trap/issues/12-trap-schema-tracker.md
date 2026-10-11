# 12 Schema tracker

Status: open
Type: task (test-first)
Blocked by: 09
Spec: ../spec.md

## What to build

The schema tracker as the spec and the mock describe it: a pure model (parse and validate a schema over `1`, `0`, `*`, or "block b solved"; per recorded generation the number of instances, their mean fitness and the population's mean fitness; a sentence saying which way it moved) and a view in the place the mock decided, with the notation explained and the standing wording that one run illustrates a tendency and proves nothing. A view setting: it never changes the run, is not in the share link, resets with the run, and follows the history cursor.

## Done when

- Counts and means equal direct computation over each recorded population (property test); invalid schemas (wrong length, other characters) get a readable message and change nothing; a run with and without the tracker is identical.
- Playwright: type a schema, read the values against the engine, scrub history, reset; keyboard operation and names for every control; geometric test at both sizes with the default and with 30 genes.

## Comments

## Answer
