# 12 Run, history, snapshots and regeneration

Status: open
Type: task (test-first)
Blocked by: 09
Spec: ../spec.md

## What to build

The algorithm-agnostic run layer in `src/run` (ADR 0001, ADR 0003), knowing only cycles, named stages, events and metrics:

- A run that advances by micro-step, by stage, by generation, and "until" a condition, over any engine that provides the cycle/stage/event contract (the GA engine is the first provider).
- History: a snapshot at every generation boundary (population, scores, generator state, active parameters), and events for a generation regenerated from the nearest snapshot on demand.
- A cursor over history that can move to any generation, stage, or micro-step.
- Pending parameters: changes recorded as pending and applied at the next generation boundary. Changes to problem, representation, population size, initialization or seed require a reset. Reset keeps the seed; "new seed" draws one.
- Scrubbing back and changing a parameter truncates later generations and continues from that point, returning which generations will be discarded so the UI can show a notice.
- Limits: population up to 500, generation limit up to 2,000, with a warning result beyond them.

## Tests (write first)

- Stepping by micro-step, stage, generation, and run-until all produce identical populations, events and metrics for the same seed.
- Replaying a generation's recorded events reproduces exactly the population the engine produced.
- Events regenerated from a snapshot equal the events recorded live, including after a parameter change earlier in the run.
- Scrubbing to any point shows the state the live run showed there.
- Pending changes apply only at the boundary; reset-required changes are refused until a reset.
- Truncation lists the discarded generations and leaves a reproducible run.
- `src/run` has no import from `src/engine` internals other than the contract.

## Comments
