# 02 Fitness sharing in the engine

Status: resolved
Type: task (test-first)
Blocked by: 01
Spec: ../spec.md

## What to build

The triangular sharing kernel, niche counts (the individual itself counts 1), shared weights; roulette spins on the chain's weights divided by the niche counts and tournament compares shared weights (Shift first when fitness can be negative); a `sharing` event (σ, α, the weights before, the niche counts, the shared weights) before the probabilities or tournaments; the tournament event carries each contestant's shared weight; the random draws are exactly those of the same run without sharing.

## Done when

- Hand-worked niche counts on a small population; σ above every distance divides by N and σ below every distance is no change; the minimised functions go through Shift; the draws unchanged; the events agree with the choices; a seeded run reproducible; niching none is bit-for-bit what it was (goldens).

## Comments

## Answer

**Built** (`niching.ts`, `selection.ts`, `tournament.ts`, `generation.ts`): `sharingKernel` (Goldberg's triangular kernel, 1 − (d/σ)^α, 0 from the radius on), `nicheCounts` (the sum of the kernel over the population, the individual itself counting 1), and `shareWeights`, which divides the weights that were going to be used by the counts and returns a `sharing` selection event (method, σ, α, the individuals, the weights before, the niche counts, the shared weights, whether fitness was shifted). In `runGeneration`, with sharing on: **roulette** runs its chain as before, the sharing event follows the chain's, and the wheel spins on the shared weights (its `probabilities` event shows them); **tournament** compares shared weights, computed from fitness as it is when no fitness is zero or negative and otherwise through the Shift step (fitness − lowest + 1), the setup event says `comparesShared` and every contestant carries its `shared` weight; a tie goes to the lower population position as before. Elites are still the best by raw fitness. A wrong configuration is refused in words before anything is drawn (σ, α, a problem with no distance). Deterministic crowding is the next ticket and is refused for now. The narration (`describe.ts`) has a sentence for the sharing event and for tournaments that compare shared weights.

**Tests** (`sharing.test.ts` 19, `niching-run.test.ts` 14): the kernel; niche counts hand-worked on four points of a line (0, 1, 3, 3.5; σ = 2: counts 1.5, 1.5, 1.75, 1.75; with α = 2: 1.75, 1.75, 1.9375, 1.9375); a radius smaller than every distance gives 1 for all, one larger tends to the population size, copies at one place count each other in full, the count is between 1 and N; the event order (weight chain, sharing, probabilities), the counts equal the individuals' decoded points', the wheel's weights equal the shared weights; tournaments compare shared weights (a lone modest individual beats a crowded better one; equal shared weights go to the lower position and are a tie); the Shift for a minimised function; **the random draws are exactly those of the same run without sharing** (same number, same r values for the spins); **niching none and no niching are the same run, event for event**; elites by raw fitness; with a crowded niche the narrow hill is picked more often than without sharing; a seeded run reproducible; refusals in words. The run layer: a seeded run with sharing (roulette and tournament) is identical by micro-step, stage, generation and run-until (regenerated events equal live ones) and at every playback tier, the events replay to the population, the size never changes, the same seed the same run. Mutations (no division, no shift, tournament on raw fitness) fail tests; the kernel at exactly σ is an equivalent mutant (1 − 1 = 0 either way). 2,302 unit tests and `npm run check` pass.
