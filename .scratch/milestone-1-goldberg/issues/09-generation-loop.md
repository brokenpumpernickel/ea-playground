# 09 Full generation: elitism, offspring evaluation, replacement, stop criteria

Status: open
Type: task (test-first)
Blocked by: 04, 07, 08
Spec: ../spec.md

## What to build

Connect the stages into a complete, deterministic generation (ADR 0001):

- Stage order: selection → pairing → crossover → mutation → evaluation of offspring → replacement.
- Elitism: top e by fitness, ties to lower index, copied unchanged and still eligible as parents. The mating pool is N − k parents. The elite count is a number, with the equivalent proportion available for display.
- Generational replacement behind a seam, so a different replacement can be added later without changing the stage list.
- Stop criteria: generation limit, target reached, stagnation (no best-so-far improvement for a window; default recorded in the spec). A stop condition is reported as an event and does not stop the engine from being stepped further.
- All of a generation's random draws are made up front in a fixed order, so the generation's events are a pure function of the starting snapshot and parameters.
- A seeded run to a fixed generation limit.

## Tests (write first)

- Population size is N after every generation, for several N and e.
- Elites are present unchanged in the next population and in the right positions; e = 0 gives none.
- A hand-built generation on the textbook population with fixed random values gives the hand-computed next population.
- Stop criteria fire at the right generation, and stepping continues after they fire.
- Same configuration and seed give an identical run twice.

## Comments
