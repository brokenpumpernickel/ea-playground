# 02 Engine: feasibility and repaired chromosomes in the scores and events (ADR 0005)

Status: claimed
Type: task (test-first)
Blocked by: none
Spec: ../spec.md

## What to build

Before touching the engine, run the golden-run tests so that they are the unchanged safety net (milestone 2's fixtures; do not regenerate them).

Then, test-first:
- `Scores` gains optional detail: `feasible` (absent means feasible, so every existing problem is unchanged) and `repaired` (the chromosome after Lamarckian repair, when it differs). Decide and record the exact names and any further optional detail the views will need (the packed set, weight and penalty can stay in the problem's own score text and columns if the engine does not need them).
- Evaluation of offspring may rewrite the individual's chromosome: the individual in the next state carries the repaired chromosome, and the evaluation event records the chromosome as mutation left it and as repaired. The initial population is treated the same way in the setup events.
- `populationFromEvents` and every consumer of evaluation events handle the rewritten chromosome, so that replaying a generation's events still reproduces its population exactly.
- Write ADR 0005 ("Evaluation may rewrite the chromosome"): hard to reverse, surprising, a real trade-off (alternatives: repair as a separate stage; repair inside mutation).

## Done when

- Golden runs pass unchanged, and so do all milestone 1 and 2 tests.
- A test problem (a small fake in the tests, not the knapsack) whose evaluation repairs chromosomes shows: the repaired chromosome is in the individual, in the evaluation event next to the original, in `populationFromEvents`' output, and in the initial population; with repair absent nothing changes.
- A seeded run with repair is identical by micro-step, stage, generation and run-until, and regenerated events equal live ones.
- ADR 0005 is written.

## Comments
