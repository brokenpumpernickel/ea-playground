# 17 Evaluation and replacement views

Status: open
Type: task
Blocked by: 14, 10
Spec: ../spec.md

## What to build

The evaluation-of-offspring and replacement stage views, matching the approved mock:

- Evaluation: each offspring's chromosome, decoded x, objective value and fitness.
- Replacement: the flow from the old population and offspring to the new population, showing elites carried over (star symbol and label), offspring that survive, and, with truncation on, the offspring discarded with the reason (rank below N − k, tie-break when one applied).
- Where the stop criteria are reported, the run shows which fired, without blocking further stepping.

## Done when

- The displayed new population equals the engine's after replacement, with and without elites and with and without truncation.
- A Playwright test checks the displayed elites, survivors and discards for a seeded run.

## Comments
