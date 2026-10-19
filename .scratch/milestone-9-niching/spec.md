# Milestone 9: niching on the landscape (fitness sharing and deterministic crowding)

Status: specified from the instructor's request and the grill (Q1 to Q8, all recommended: "Yes to all"). Next: the tickets in order.

Vocabulary follows `CONTEXT.md`. New terms for the glossary when built: **niche**, **fitness sharing**, **niche count**, **deterministic crowding**, **duel**.

## Problem

On the *Two peaks* landscape a narrow tall hill (top 1 at (3, 3)) stands beside a broad low one (top 0.6 near (−2.5, −2.5)). A plain GA settles on the broad hill in most runs (with seeds 1 to 100, 84 of 100 end there with the existing preset's settings) and so converges on the suboptimal solution. The instructor wants to add two classical niching mechanisms, **fitness sharing** and **deterministic crowding**, and see whether they avoid or reduce that.

What a throwaway simulation (a stand-alone mini-GA with the app's settings, seeds 1 to 100; not app code) said before building: today's default finds the narrow hill in 19 runs of 100 and holds both hills in none; deterministic crowding finds it in 39 (population 12), 63 (30) and 89 (60) and holds both hills in 32, 66 and 92; fitness sharing with roulette selection holds both hills in 31 of 100 (population 30) and 62 to 67 (population 60) for σ of 2 to 3, but with tournament-of-2 selection it barely helps. Finding the narrow hill at all is partly the luck of the starting population. These numbers are to be re-measured with the real implementation (ticket 07).

## Goal

1. A **Niching** setting for the landscape problems: none, fitness sharing or deterministic crowding.
2. **Fitness sharing** as a visible last step of the selection weights, with a radius σ and a shape α.
3. **Deterministic crowding** as a faithful Mahfoud variant: every individual is a parent once, and each child duels the nearer of its parents.
4. A readout of **how many individuals are near each peak**, so that "both hills held" is seen, not guessed.
5. Two presets with measured, asserted texts.

## Decisions (grill, all as recommended)

- **Scope and distance.** Landscape problems only, in all three representations; the distance between two individuals is the Euclidean distance between their decoded (x, y) points, in x, y units. The engine takes the distance from the problem (an optional `distance`), so another problem could provide one later.
- **One choice.** `Niching: none / fitness sharing / deterministic crowding`, mutually exclusive. With sharing, elitism stays and picks elites by raw fitness. With crowding, elitism and offspring truncation are switched off, with a one-line reason in the drawer (crowding is not generational replacement and never loses a niche's best).
- **Fitness sharing.** Goldberg's triangular kernel sh(d) = 1 − (d/σ)^α for d < σ and 0 otherwise (α = 1 by default), niche count mᵢ = Σⱼ sh(dᵢⱼ) with the individual itself counting 1, shared weight = weight ÷ mᵢ. It is a final step of the selection weights: roulette spins on the shared weights (the weight chain's output divided by the niche counts), tournament compares shared weights (with the Shift step applied first when fitness can be negative: Rastrigin and Himmelblau). The selection view shows columns "niche count" and "shared". Defaults σ = 2.0 and α = 1. The drawer says sharing works best with roulette selection and a population of 30 or more.
- **Deterministic crowding (Mahfoud).** Selection takes every individual exactly once in random order (no selection pressure; an odd population adds one extra random parent, as for roulette); pairing, crossover, mutation and evaluation as today; replacement: each child duels the nearer parent (the matching of the two children to the two parents with the smaller total distance), replaces it only if strictly better, ties keep the parent; the population size is constant and the children take their parents' places. The replacement view shows every duel: parents, children, who faced whom, the distances, the winner. A hybrid with tournament or roulette selection is out of scope.
- **Peak occupancy.** The landscape function info gains its known peaks (single peak, two peaks, Himmelblau); a readout counts the individuals within 1.5 units of each peak's top ("broad hill 9 · narrow hill 2"), in the metrics and in the focus view's info box, with a table for the screen reader. A history plot of the counts may come later.
- **Views.** Sharing: the table columns above and a σ-radius ring round the selected individual on the heatmap. Crowding: the duel table, the losers marked with the existing discarded mark (✕). Shape and words carry the meaning, not colour alone.
- **Timing and defaults.** The niching choice, σ and α take effect at the next generation boundary like the other selection settings (the pending chip). Defaults: niching none and population 12, so every existing run and every share link is unchanged and old links open as before.
- **Presets.** "Two peaks: fitness sharing" and "Two peaks: deterministic crowding", population 40, on a seed where the plain run lands on the broad hill; the texts say only what the real implementation measures over seeds 1 to 100, with the honest caveats (sharing with tournament-2 does not help; crowding at population 12 helps modestly). No in-app multi-seed runner for now.

## Scope

### In
Everything above, with unit and end-to-end tests, the accessibility and projector pass of earlier milestones, and the published-site check.

### Out
- Niching for the other problems; a hybrid of crowding with tournament or roulette selection; an in-app multi-seed experiment runner; a history plot of the peak counts; other niching methods (clearing, speciation, restricted tournament).
- Changes to the share-link format other than an optional field.

## Acceptance criteria

1. **Nothing else changes.** With niching none (the default, and absent in every old link) every run, event, snapshot and golden file is exactly what it was; all milestone 1 to 8 tests pass; the other problems have no Niching control.
2. **Fitness sharing.** Niche counts and shared weights are hand-worked on a small population; sharing with σ larger than every distance divides by the population size, with σ smaller than every distance divides by 1 (no effect); roulette and tournament use the shared weights; Shift is applied first for the minimised functions; the random draws are unchanged by sharing (same number, same meaning); the events agree with the engine's choices.
3. **Deterministic crowding.** A hand-worked pair (the matching by total distance, strict improvement, ties to the parent); the population size is constant, every individual is a parent once (an odd population: once plus one extra), the replaced slots are those of the parents, elites and truncation are ignored; the events replay to the population; reproducible for a seed.
4. **Reproducibility and agreement.** A seeded run is identical stepwise, by stage, by generation and by every playback tier; every displayed number (niche counts, shared weights, distances, winners) equals the engine's events.
5. **Peaks.** The known peaks agree with the function (the top of each hill found numerically, as for the optimum); the occupancy counts equal a recount from the individuals' decoded points.
6. **Links and drawer.** Every niching setting round-trips in a share link as the same run; a bad setting is said in words and applies nothing; the controls follow the pending-change rules.
7. **Evidence.** The presets' texts are asserted number by number on their seeds and over seeds 1 to 100.
8. **Accessibility and hosting.** Names, sentences and tables for the new columns, ring, duels and readout; keyboard only; reduced motion; the colour audit; no overflow or overlap at 1920×1080 and 1366×768 in projector mode and not; the published site checked; the instructor steps through both mechanisms on the Two peaks landscape.

## Verification approach

Vitest, test-first: the distance and the peaks; the niche counts and shared weights; the crowding matching and duels; the engine with niching off equal to before; the run layer (snapshots, playback tiers); the drawer model and links. Playwright: the drawer controls, the selection view with sharing, the replacement view with crowding, the ring, the readout, geometry at both sizes, a classroom scenario, the published site. Measurement: the statistics of the presets over seeds 1 to 100.

## Build sequence

1. Foundations: the problem's distance, the peaks of the functions, the niching configuration and its validation (no behaviour change).
2. Fitness sharing in the engine.
3. Deterministic crowding in the engine.
4. Share links and the drawer.
5. The views: sharing columns and ring, the duel table.
6. The peak-occupancy readout.
7. The presets and their statistics.
8. Accessibility and projector pass; rendered review and sign-off.

## To decide during implementation (record the choice here when made)

- The "near a peak" radius (proposed 1.5 for every peak) and the peak names ("broad hill", "narrow hill"; Himmelblau's four by their numbers).
- The tolerance of "strictly better" for floating-point ties (proposed: exact comparison, as elitism's).

## Comments
