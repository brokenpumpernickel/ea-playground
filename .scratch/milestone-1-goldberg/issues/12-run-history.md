# 12 Run, history, snapshots and regeneration

Status: resolved
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
- The run contract (cycle, stage and event types) is defined in `src/run`, and the GA engine implements it; `src/run` never imports `src/engine` (enforced by `npm run check`). Run-layer tests use a small fake engine.

## Answer

Done test-first in slices (design, stepping semantics and seams agreed with the instructor beforehand). 300 tests pass in total (62 new for this ticket: 45 in the run layer against a fake algorithm, 17 for the GA adapter); `npm run check` and `npm run build` are clean. Three deliberate breakages (regenerating with the wrong cycle's parameters, truncation that forgets to drop snapshots, stage-forward going to the start of a stage) were each caught by the tests, then reverted.

Layout:

- `src/run/contract.ts`: the `Algorithm<Setup, Params, State, Event>` contract (`start`, `step`, `microStepOf`, `setupDifferences`, `warnings`).
- `src/run/run.ts`: `createRun(algorithm, { setup, params, seed }, { eventCacheSize })`.
- `src/run/rng.ts`: the generator moved here from `src/engine` (it is shared, ADR 0003) and gained `state()`. Resuming is `createRng(savedState)`. `src/engine` imports it from `../run/rng`.
- `src/run/fake-algorithm.ts`: the fake used by the run layer's tests.
- `src/engine/algorithm.ts`: `gaAlgorithm`, `GaSetup` (problem, init), `GaParams` (everything else in the generation config), `populationFromEvents`, `supportedLimits`.
- `src/run/index.ts` and `src/engine/index.ts` export the public surface. `src/run` never imports `src/engine` (`npm run check`).

Run API (`Run`):

- State: `seed`, `setup`, `lastCycle`, `parameters` (pending if any), `pendingParameters`, `cursor`, `snapshot(c)`, `events(c)`, `layout(c)`, `view()`, `warnings()`.
- Moves: `forwardMicro`, `backMicro`, `forwardStage`, `backStage`, `forwardCycle`, `backCycle`, `moveTo(position)`, `runUntil(condition, { maxCycles })` (default 2,000; returns `condition` or `max-cycles` and the number of cycles).
- Changes: `setParameters(params, { confirmDiscard })`, `setSetup(setup)`, `reset({ setup, params, seed })`.

Semantics, as agreed:

- **Positions** are `(cycle, stage, micro)`; micro 0 means the stage was just entered. The run starts at the end of cycle 0 (the evaluated initial population). Stages with no events in a cycle are absent from its layout (with every individual an elite, only selection and replacement remain), and navigation steps over them.
- **Forward by stage or cycle goes to the end** of the current stage or cycle, or of the next one if already there; **back goes to the previous end**. Stepping forward at the live end makes the next whole cycle, with any pending parameters applied to it. Moves return false only when there is nowhere to go.
- **History** is one snapshot per cycle (state, generator state, the parameters that made it, stop reasons). Events are regenerated from the previous snapshot and cached for the last few cycles; the layout of each cycle is cached too. A test counts calls to `step` to prove far-back scrubbing really regenerates, and checks regenerated events equal the live ones, including after earlier parameter changes and in the real GA.
- **`view()`** returns the cycle's start state (undefined for cycle 0), end state, the events visible so far (all earlier stages, plus this stage's whole-stage events and its micro-steps up to the cursor), the stage name, its micro-step count and the cycle's stop reasons. Scrubbing to every position visited live (in a scrambled order, with and without the cache) shows exactly what the live run showed.
- **Parameters:** at the live end `setParameters` returns `pending` and nothing already made changes. Scrubbed into the past it returns `needs-confirmation` with the cycles that would be discarded and changes nothing; with `confirmDiscard: true` it truncates to the cursor's cycle (kept), leaves the cursor, and the new parameters govern the next cycle. A continued run equals a fresh run with the same change at the same boundary (tested).
- **Setup:** `setSetup` never applies anything; a different setup returns `reset-required` with the names that differ (GA: `problem`, `populationSize`, `initialization`). `reset` keeps seed, setup and parameters unless given new ones; a plain reset reproduces the same run. "New seed" is the caller's job: the run layer must not use unseeded randomness, so ticket 14's button supplies the number.
- **Limits** are warnings from the algorithm: population above 500 and a generation limit above 2,000. They never stop anything (a 501-individual run works).
- **Replay:** `populationFromEvents(before, events)` rebuilds a population from events alone (setup events give the initial population; a replacement event names the next one, drawn from carried-over individuals and evaluated offspring). Tested for every generation of 10-generation runs with and without elites, so displayed events agree with engine results.
- **Micro-steps in the GA:** selection has one per spin (the weight table and probability table are whole-stage events, visible on entering the stage), pairing and crossover one per pair, mutation and evaluation one per offspring, replacement one, setup one per individual. These match the mock's "Micro-step 2 of 4" counts.

Notes for later tickets:

- Ticket 13 (playback) builds on `forward*`/`runUntil`/`warnings`; it must not be given a `Math.random`-based "new seed", and the UI's new-seed button needs its own source of a number.
- Ticket 14 should read `view()`; the events carry no generation number themselves, but `view().position.cycle` does. Cycle 0's stage is `setup` and its events' micro-steps are the individuals' ids.
- The `View.before` state for a stage in the middle of a cycle is the start of that cycle; the left tables in the mock are derived from `before` plus the visible events.
- Metrics (ticket 11) are not part of the contract yet; the contract's `Snapshot` could gain a metrics field, or plots can derive series from snapshots. That decision belongs to ticket 11.
- `eventCacheSize` defaults to 4; a long scrub across many cycles regenerates one cycle per event lookup.

## Comments
