# 10 Offspring truncation

Status: resolved
Type: task (test-first)
Blocked by: 09
Spec: ../spec.md

## What to build

The optional offspring-truncation mode in the generation loop:

- λ offspring (default N, freely configurable) are generated and evaluated; the mating pool is then λ parents.
- Replacement keeps the best N − k offspring by fitness, ties in order of generation, with the tie-break recorded.
- Discarded offspring and the reason are recorded as events.
- Off by default, in which case N − k offspring are generated and all survive.

## Tests (write first)

- With truncation on and λ > N − k, exactly N − k offspring survive and they are the best ones; discards are listed.
- Tie-breaks follow the order of generation.
- With truncation off, behaviour is unchanged from ticket 09.
- λ = 2N works; population size is N after every generation.
- Determinism holds with truncation on.

## Answer

Done (decisions, interface and seams agreed with the instructor beforehand). 454 engine and run-layer tests pass in total (101 new: 96 in `generation.test.ts`, 5 in `algorithm.test.ts`); `npm run check` and `npm run build` are clean. Four deliberate breakages (ties broken in reverse generation order, one offspring too many kept, survivors left in generation order, no λ validation) were each caught by several tests, then reverted.

Process note: the first red test (the mock's worked example) was followed by a green step that implemented the whole policy at once (ranking, ordering and the λ check), so the later tests passed immediately and act as regression guards, with the breakages above as proof they bite. This is a departure from one-test-one-implementation.

Public interface (`src/engine/index.ts`):

- `GenerationConfig.truncation?: { enabled, lambda }` (and so `GaParams.truncation`). Off by default; λ is remembered while off and ignored. A custom `replacement` strategy still wins.
- `generationalReplacement(elites, { lambda? })`: with `lambda`, λ offspring are made and the best N − e survive.
- `ReplacementStrategy.replace` may return a `ranking: RankedOffspring[]` (`{ individualId, offspring, rank, kept }`), and the replacement event carries it as an optional `ranking` field, in rank order. Without truncation there is no `ranking`.

Behaviour, as agreed:

- **The mock's example reproduces exactly.** N = 4, e = 1, λ = 4 with the same 27 scripted draws gives population ids 2, 7, 5, 8 (fitness 576, 729, 625, 576; Σ 2506, average 626.5), ranking #1 O3 (729), #2 O1 (625), #3 O4 (576), #4 O2 (144, discarded), `evaluations` 8, `nextId` 9.
- **λ rules:** a whole number of at least N − e, otherwise `λ must be a whole number of at least N − e = 3, so there are enough offspring to fill the population`. λ = N − e is allowed (nothing is discarded, but survivors are ordered best first). λ = 0 is fine when e = N (offspring are made and none can be kept).
- **Survivor order:** elites (best first), then kept offspring best first, ties going to the earlier-made offspring (tested with duplicate offspring). Without truncation the offspring keep generation order, as before.
- **Every offspring is scored.** All λ get ids and scores and count in `evaluations` and `nextId`, including discarded ones; they appear as evaluation events and in the ranking, and nowhere in the new population. `populationFromEvents` still replays truncated generations exactly.
- **Odd λ** draws one extra parent and drops the last pair's second child before scoring, so exactly λ are evaluated.
- **Elites** are carried over unchanged and first, and stay eligible as parents.
- Draw order and counts hold with λ offspring (`matingPoolSize(λ)` spins, crossover per pair, mutation per offspring gene), checked with a counting generator. Same config and seed give an identical truncated run. Invariants (size N, unique ids, `evaluations = N + g × λ`, `nextId`, best-so-far monotone) hold for every N in 1–6, e in 0–N and λ in {N − e, N − e + 1, 2N} over six generations.
- **Through the run layer:** with λ = 8 the layout is 8 spins, 4 pairs, 4 crossovers, 8 mutations, 8 evaluations and 1 replacement. Truncation switched on at a boundary changes the next generation only (the earlier snapshots keep their own parameters).

Notes for later tickets:

- Ticket 17 reads `ranking` for the replacement view: rank, kept or discarded per offspring, in rank order. The mock's "Offspring ranked by fitness" column and "✓ kept #1 / ✕ discarded #4" badges come straight from it. With truncation off there is no `ranking`, so the view should show the offspring as made.
- Ticket 20's controls: a toggle plus λ, with the rule "at least N − e" visible next to λ. A λ that is too small throws when the generation is made, so the drawer should validate it before the student can apply it (the same message is available by calling `generationalReplacement(e, { lambda }).offspringCount(N)`).
- `CONTEXT.md` now records λ ≥ N − k and the survivor order.

## Comments
