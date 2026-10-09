# 03 Engine core: generator, Goldberg problem, population

Status: resolved
Type: task (test-first)
Blocked by: 02
Spec: ../spec.md

## What to build

The smallest slice of `src/engine` that produces an evaluated initial population:

- A small documented seedable generator (pick the algorithm and record it in the spec's "To decide" list). Never `Math.random`.
- The Goldberg problem: five-bit chromosome, plain-binary decoding to x in [0, 31], objective value x², fitness equal to objective value, known optimum 11111 = 31 (fitness 961).
- Individuals (chromosome, decoded solution, objective value, fitness) per `CONTEXT.md`.
- Initialization from the seeded generator, or from an explicit list of chromosomes (validated for length and alphabet).
- The setup stage that evaluates the initial population, recorded as events.

## Tests (write first)

- Decoding and fitness table for all 32 chromosomes.
- Same seed gives the same initial population; different seeds differ.
- Explicit initialization with the textbook population gives fitness 169, 576, 64, 361.
- Rejects wrong-length or non-binary chromosomes with a clear message.

## Answer

Done test-first, one red → green cycle per seam (seams agreed with the instructor before any test was written): generator, Goldberg problem, initialization, setup events. 32 tests pass across the engine; `npm run check` is clean.

Public interface (`src/engine/index.ts`):

- `createRng(seed)` → `{ next(): number in [0, 1) }`, mulberry32. Pinned against an independent Python implementation of the algorithm.
- `goldberg`: `chromosomeLength` 5, `evaluate(chromosome)` → `{ decoded: x, objective: x², fitness: x² }`, `knownOptimumFitness` 961 (checked as the maximum over all 32 chromosomes).
- `initialize(problem, init, rng)` → `{ population, events }`, with `init` either `{ kind: 'random', size }` or `{ kind: 'explicit', chromosomes: ['01101', …] }`.
- `Individual` = `{ id, chromosome, decoded, objective, fitness }`; ids are 1..N. Chromosomes are `readonly Bit[]`, so copies cannot share mutable state.
- `SetupEvent` = `{ stage: 'setup', kind: 'evaluated', individual }`, one per individual in population order; a test checks the events equal the population exactly.

Decisions made here:

- Random initialization draws gene by gene, individual by individual; a gene is 1 when its draw is below 0.5. Seed 42 with N = 3 and five genes gives 01001, 01001, 10011 (pinned in a test), so the draw order is part of the contract.
- Error messages name the chromosome (1-based) and the problem, e.g. `Chromosome 2 has 4 genes, but this problem needs 5` and `Chromosome 2 ("11x00") may only contain the characters 0 and 1`. Population size must be a whole number of at least 1; the 500 limit belongs to ticket 12.
- `Problem` is a small interface (`chromosomeLength`, `evaluate`) with one implementation. It was not generalised further, per ADR 0003.

Notes for later tickets:

- `parseBits` is lenient (it turns any non-`1` character into 0); validation happens in `initialize`. Anything that parses user text elsewhere must validate first.
- The generator exposes only `next()`. Ticket 12 needs to read and restore its 32-bit state for snapshots, so it will add that.
- The id counter will need to be part of the snapshot state in ticket 12, since offspring ids continue from the population's.

## Comments
