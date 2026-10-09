# 07 Crossover

Status: resolved
Type: task (test-first)
Blocked by: 04
Spec: ../spec.md

## What to build

The crossover stage over the pairs from pairing:

- Operators: one-point, two-point, uniform. Cut points and the uniform mask are drawn up front and recorded, along with which parent each child gene came from.
- Probability applies per pair: one recorded draw (random number and threshold) per pair.
- A crossover switch. When it is off, and when a pair fails its draw, the pair is recorded as a bypass and the children are independent copies of the parents.
- An odd pool's dropped child (from 04) is recorded as discarded.

## Tests (write first)

- Each operator on fixed parents and fixed cut points or masks gives the hand-computed children and inheritance map.
- Bypass: with the switch off, children equal the parents, are distinct objects, and mutating a child does not change the parent or the other child. The selection stage still ran.
- A pair failing its draw is a recorded bypass, not a missing event.
- Over many seeded draws the observed fraction of recombined pairs matches pc within a tolerance.
- pc = 0 and pc = 1 behave as always-bypass and never-bypass.

## Answer

Done test-first (decisions, interface and seams agreed with the instructor beforehand). 128 engine tests pass (26 for this ticket); `npm run check` is clean.

Public interface (`src/engine/index.ts`):

- `crossover(population, pairs, config, rng)` → `{ offspring, events }`, with `config = { enabled, operator: 'one-point' | 'two-point' | 'uniform', probability }`.
- `offspring`: `Child = { offspring (1-based across the generation), pair, chromosome, sources: ('A' | 'B')[] }`. Pair k makes offspring 2k − 1 and 2k. The dropped second child of an odd count is left out.
- One `CrossoverEvent` per pair: both parent ids, operator, `decision` (`recombined` / `bypassed`), `reason` (`switched-off` / `draw-failed`), `draw { u, threshold }` (absent when switched off), `cuts` (one-point, two-point) or `mask` (uniform), and both children with `sources` and `discarded`.

Decisions made (the draw order is part of the reproducibility contract):

- **Per pair:** one draw `u` first; recombine only when `u < pc` (a draw equal to pc is a bypass; pc = 0 never recombines, pc = 1 always does). A bypassed pair draws nothing more.
- **Operator draws, in order:** one-point draws one number, cut = 1 + floor(r × (L − 1)) genes to the left; two-point draws a first cut the same way, then a second from the remaining positions, and sorts them (the genes between the cuts are swapped); uniform draws one number per gene and swaps the gene when the draw is below 0.5.
- **Crossover switched off draws nothing at all** (not even `u`), and every pair is a bypass with reason `switched-off`. The stricter alternative, burning the draws so later stages see the same numbers either way, was rejected as harder to explain.
- **Child 1** takes parent A's genes except where swapped; **Child 2** is the complement. A bypass makes them copies of A and B. Every child records which parent each gene came from.
- **Fresh arrays always:** bypass and recombined children never share an array with a parent or each other, even when both parents are the same individual (tested by mutating through a cast).
- **Validation:** probability must be in [0, 1] (checked even when switched off); one-point needs at least 2 genes and two-point at least 3 (checked only when enabled); a pair naming an individual not in the population is refused.
- Tested against Goldberg's own example (11000 × 01101, cut after gene 4 → 11001, 01100) and the mock's worked example; rates checked statistically (recombination fraction matches pc; one-point cuts spread evenly over 1..L − 1; two-point cuts always distinct and in range; uniform masks about half swapped).

Other changes:

- `src/engine/test-support.ts` holds the shared `scripted(...draws)` generator (it also reports how many draws were used); selection's tests now use it instead of a private copy.

Notes for later tickets:

- Offspring have no id or fitness yet; ticket 09 assigns ids (continuing from the population's) and evaluates them. `Child.offspring` is the number the views show as O1, O2, ….
- The generation loop should call `matingPoolSize(offspringCount)`, `rouletteSelect`, `pair`, then `crossover`, and hand `offspring` chromosomes to mutation (ticket 08).
- Ticket 16's view reads `decision`, `reason`, `draw`, `cuts`/`mask` and each child's `sources` (plain = from A, hatched = from B in the mock).

## Comments
