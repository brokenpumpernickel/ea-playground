# 02 Engine: feasibility and repaired chromosomes in the scores and events (ADR 0005)

Status: resolved
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

## Answer

Golden runs were run first (45 tests, unchanged) and pass unchanged afterwards, as do all 1019 earlier unit tests.

**Names and shapes (recorded in ADR 0005, `docs/adr/0005-evaluation-may-rewrite-the-chromosome.md`):**
- `Scores.feasible?: boolean`: absent means feasible. It lands on the `Individual` through the existing spread, so it is in populations and in the evaluation and setup events.
- `Scores.repaired?: Chromosome`: what `evaluate` returns for Lamarckian repair. It is never a field of an `Individual` (`Individual extends Omit<Scores, 'repaired'>`): the engine stores the repaired chromosome as `individual.chromosome`.
- `SetupEvent.repairedFrom?` and `EvaluationEvent.repairedFrom?: Chromosome`: the chromosome as it was given or as mutation left it, present only when repair actually changed something.
- `evaluated(problem, chromosome, identity)` in `initialize.ts` is the single place that scores a chromosome and builds the individual (used by setup and by evaluation of offspring), so both treat repair the same way. When nothing is repaired the individual and event are exactly what they were; there is no new key.
- Packed set, weight and penalty stay in the problem's own columns and score text; the engine needs nothing more.
- A problem whose evaluation repairs must do so deterministically (no draws): the engine passes it no generator. Recorded in the ADR.

**Tests** (`src/engine/repair.test.ts`, 8, written first and red before the change; the fake problem clears ones beyond three): the initial population is repaired and the setup event keeps the typed chromosome (and an unrepaired individual has no `repairedFrom` key and no `repaired` field); every evaluation event shows the chromosome as mutation left it next to the repaired individual (the run really exercised repair), only ones were cleared, later populations hold repaired chromosomes; `populationFromEvents` reproduces every population; micro-steps, stages, generations and run-until agree with regenerated events equal to live ones; Goldberg events carry neither `repairedFrom` nor `feasible`; a problem reporting `feasible` has it on every individual in states and events.

State: 1027 unit tests, `npm run check` clean.
