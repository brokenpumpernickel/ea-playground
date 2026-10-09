# 09 Full generation: elitism, offspring evaluation, replacement, stop criteria

Status: resolved
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

## Answer

Done test-first in vertical slices (decisions, interface and seams agreed with the instructor beforehand): provenance, hand-computed generation, elitism, bookkeeping and determinism, stop criteria, replacement seam. 235 engine tests pass (79 for this ticket); `npm run check` and `npm run build` are clean.

Public interface (`src/engine/index.ts`):

- `startRun(problem, init, rng)` → `{ state, events }` (the setup events from ticket 03).
- `runGeneration(state, config, rng)` → `{ state, events, stops }`. It never modifies the state it is given.
- `RunState` = `{ generation, population, nextId, evaluations, bestFitnessSoFar, lastImprovementGeneration }`, a plain value that is exactly what ticket 12 needs to snapshot (plus the generator's state and the active parameters).
- `GenerationConfig` = `{ problem, selection: { method: 'roulette', chain }, crossover, mutation, elites, replacement?, stop }`.
- `stopReasons(state, stop)` → the criteria that currently hold, for any state (including scrubbed-to or initial ones).
- `generationalReplacement(elites)` and the `ReplacementStrategy` interface (`offspringCount(N)`, `replace(population, offspring)`).
- `Individual` gained `origin`: `{ kind: 'initial' }` or `{ kind: 'offspring', generation, offspring, parentAId, parentBId, recombined, flipped }`.

Behaviour, as decided:

- **Stage order and events:** weight chain → selection spins → pairing → crossover → mutation → evaluation of offspring → replacement, in one flat event list. The weight-chain event comes first inside the selection stage. Each evaluation event carries the new `Individual` (ids continue from `nextId`).
- **Draw order:** selection spins (`matingPoolSize(offspringCount)`), then crossover pair by pair, then mutation offspring by offspring. Pairing, evaluation and replacement draw nothing. A test counts the draws and checks later decisions continue the same sequence. The mock's worked example runs as an exact script of 27 draws and gives the hand-computed population (625, 144, 729, 576) with provenance.
- **Elitism:** the best `e` by fitness, ties to the lower index, best first, same individuals (same id) carried over unchanged and placed first, still eligible as parents. With N = 4, e = 1 there are three offspring: four spins, the last pair's second child is recorded as discarded by crossover and never evaluated.
- **Invariants checked** for every N in 1–8 and e in 0–N over six generations: size N, ids unique, `evaluations = N + g(N − e)`, `nextId` consistent. Best so far never decreases and only moves the improvement marker on strict improvement; best of generation can fall below it.
- **Stop criteria are reported, never enforced:** generation limit (generation ≥ limit), target reached (best so far ≥ target), stagnation (no strict improvement of best so far for the window). Listed in a fixed order, still reported after they fire, and stepping on keeps working. Configuration is validated up front. Defaults (limit 50, stagnation window 10) are recorded in the spec and belong to the app's default configuration, not the engine.
- **Replacement seam:** the default is generational with elites, but a `(μ+λ)`-style strategy defined in a test plugs in via `config.replacement` and changes how many offspring are made and who survives. Ticket 10's offspring truncation is the next strategy to use it.
- **Errors:** an elite count outside 0..N and an unusable weight chain throw `Error`s with readable messages (the chain's own reason). Negative fitness runs through ticket 05's automatic switch, recorded in the weight-chain event.

Notes for later tickets:

- Ticket 10 (truncation) should be a second `ReplacementStrategy` (or an option of the generational one) with `offspringCount` returning λ; the mating pool already comes from `offspringCount`, so λ parents are drawn and λ offspring evaluated before `replace` chooses the best N − e.
- Ticket 11 (metrics) can read everything from `RunState` and the events; `evaluations` is already there.
- Ticket 12 needs the generator's state to be readable and restorable (noted in ticket 03), and must store the active config next to each state for regeneration. `runGeneration` is already a pure function of (state, config, generator state).
- The mock's stage-view needs are met by the events as they stand. One gap to decide in ticket 12 or 14: events are per-generation and carry no generation number themselves; the cursor knows which generation they belong to.
- Tournament selection (ticket 06) extends `SelectionConfig`; the loop only needs a branch where it calls `rouletteSelect`.

## Comments
