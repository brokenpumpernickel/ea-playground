# 06 Tournament selection

Status: resolved
Type: task (test-first)
Blocked by: 04
Spec: ../spec.md

## What to build

Tournament selection as a second selection method behind the same mating-pool interface:

- Tournament size t (default 2), contestants drawn with replacement, best fitness wins.
- Ties go to the lower population index, and each tournament records its contestants, their fitness, the winner, and whether a tie-break decided it.
- The weight-transformation chain is not used; the selection result records that tournament selection compares fitness directly, for the UI to say so.

## Tests (write first)

- A tournament over fixed contestants picks the best; a tie picks the lower index and records it.
- t = 1 behaves like uniform random selection; large t almost always picks the best in the population.
- Same seed gives the same pool; pool size is N − k.

## Answer

Done test-first, in slices: hand-computed run, ties, probabilities and extremes, validation, generation loop, run layer (decisions, interface and seams agreed with the instructor beforehand). 516 tests pass in total (62 new: 22 in `tournament.test.ts`, 35 in `generation.test.ts`, 5 in `algorithm.test.ts`); `npm run check` and `npm run build` are clean. Four deliberate breakages (ties to the earliest contestant, tie-break flagged for a repeated individual, the worst contestant winning, one draw per tournament instead of `size`) were each caught, then reverted.

Public interface (`src/engine/index.ts`):

- `tournamentSelect(population, size, count, rng)` → `{ pool, events }`, the same shape as `rouletteSelect`.
- `SelectionConfig` is now `{ method: 'roulette', chain } | { method: 'tournament', size }`; `runGeneration` branches on it. The engine takes the size explicitly; the default of 2 belongs to the app's default configuration.
- Events: `TournamentSetupEvent` (`kind: 'tournament-setup'`, `size`, `usesWeightChain: false`) opens the stage, then one `TournamentEvent` per tournament: `tournament` (from 1), `contestants` (`individualId`, `fitness`, `r` each), `winnerId`, `tieBreak`. There are no weight-chain, probabilities or spin events with tournament selection.

Behaviour, as agreed:

- **Drawing:** each tournament draws `size` numbers in order; each picks population position `floor(r × N)`, with replacement, so an individual can appear twice. A size larger than N works. A guard against the index reaching N turned out to be unnecessary: floor((1 − 2⁻⁵³) × N) cannot reach N for any N below 2⁵³ because the product never rounds up to N, and a test checks every N up to 200.
- **Winner:** best fitness; among equals the **lower population position**, so the winner never depends on contestant order. `tieBreak` is true only when two or more *different* individuals share the best fitness (the same individual drawn twice is not a tie-break, and a tie below the best is not one either).
- **Fitness is compared directly:** negative fitness works with no chain and no automatic switch. Wins follow the expected probabilities (7/16, 5/16, 3/16, 1/16 for N = 4, t = 2, from an independent formula) over 20,000 tournaments for sizes 1, 2 and 3; size 1 is uniform random selection.
- **Draw order:** exactly `size × count` draws, in order, and later stages continue the same sequence. A generation's draws are `pool × size` for tournaments, then crossover, then mutation (counted with a counting generator). With one elite and four individuals, three offspring need four tournaments (the odd-count rule from ticket 04).
- **Validation:** size must be a whole number of at least 1, the count a whole number of at least 0, and the population non-empty, each with a readable message.
- **In the loop:** a hand-computed generation (pool 1, 2, 1, 2 → offspring 01100, 11001, 00101, 11000; fitness 144, 625, 25, 576) from 31 scripted draws; size and id invariants for every N in 1–6 and e in 0–N; works with offspring truncation; the same seed gives an identical run.
- **Through the run layer:** the selection stage has one micro-step per tournament (`microStepOf` maps tournament events to their number); entering the stage shows only the preamble and each micro-step adds one tournament; replay of events reproduces every population; micro, stage, cycle and until-style advancing, and event regeneration, all give identical runs; switching from roulette to tournament at a boundary changes the next generation only.

Notes for later tickets:

- Ticket 15 (selection views) draws the brackets from `contestants` (each with its `r`, id and fitness), `winnerId` and `tieBreak`, and shows the note from the `tournament-setup` event ("tournament selection compares fitness directly, so the weight chain is not used"). The mock's "Tournament would ignore this chain" line is the same point.
- Ticket 20 (drawer): a tournament-size field (default 2) appears when the method is tournament; the weight-chain editor can show its note and stay disabled. Changing selection method or size is a pending parameter, not a reset.
- The default selection in the app's configuration is still roulette with `[{ step: 'identity' }]`.

## Comments
