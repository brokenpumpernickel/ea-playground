# Milestone 1: Goldberg x² vertical slice

Status: ready-for-breakdown

Vocabulary follows `CONTEXT.md`. Architecture follows ADRs 0001–0003 in `docs/adr/`. Where this spec and those disagree, the ADRs and glossary win and this spec is wrong.

## Problem

Students will implement genetic algorithms themselves and need to see what happens inside one, connecting each mechanic (selection, pairing, crossover, mutation, replacement) to the changing solutions. Existing tools show a fitness curve and hide the mechanics. The instructor teaches mostly from a projector, so the app must be legible at a distance and must let them pause, inspect, step back, and change one thing.

## Goal

A working end-to-end GA teaching app for one example, Goldberg's integer x² maximisation, that exercises the whole engine, history, playback and view stack. It is the foundation the other four examples (target string, knapsack, deceptive trap, 2-D landscape) are added to, and its engine and run layers must not need rework to host them.

## Scope

### In

**Problem: Goldberg x²**
- Maximise f(x) = x² for integer x in [0, 31], a five-bit chromosome, decoded by plain binary.
- Objective value is x². Fitness equals the objective value (identity rule, shown as such).
- Known optimum: 11111 = 31, fitness 961, used as the stop-at-target value.

**Engine** (DOM-free TypeScript under `src/engine`, test-first; see ADR 0002)
- Seeded generator, a small documented algorithm, never `Math.random`.
- Initialization: seeded random, or an explicit list of chromosomes (textbook preset and hand-edited population).
- Selection: roulette-wheel and tournament.
  - Roulette: N − k independent spins over selection probabilities.
  - Tournament: size k (default 2), contestants drawn with replacement, best fitness wins, ties go to the lower population index and the tie-break is recorded.
- Weight transformations: a free-form ordered chain from raw fitness to selection weights. Steps: Identity, Shift (fitness − min + ε), Rank (average rank on ties), Linear ranking (selection pressure s in [1, 2]), Power (exponent). A validator rejects chains whose output is not non-negative with a positive sum, and says why. Unsuitable raw fitness under Identity auto-switches the chain to Shift and records that it did so. Tournament selection ignores the chain and the UI says so.
- Mating pool and pairing: the pool is N − k parents drawn with replacement; pairing takes neighbours in order; an odd pool leaves the last child dropped, recorded explicitly.
- Crossover: one-point, two-point, uniform. Probability applies per pair, one recorded draw per pair. A crossover switch turns it off; disabled crossover, and a pair failing its draw, are both recorded as bypasses that pass through independent copies of the parents (no shared mutable chromosome state).
- Mutation: bit flip, in two modes. Per-gene: one draw per gene. Per-individual: one draw decides whether the individual is mutated, then the operator chooses genes. A mutation switch turns it off, leaving the chromosome unchanged, and the bypass is recorded. Every draw is recorded with its random number and threshold.
- Elitism: count e (proportion shown alongside), top e by fitness with ties to lower index, copied unchanged, still eligible as parents.
- Offspring truncation (optional): λ offspring (default N) generated and evaluated, best N − k survive, discarded ones recorded.
- Replacement: generational with elites carried over. Keep this stage behind a seam so (μ+λ) can be added later without rewriting the stage list.
- Stage order per generation: selection → pairing → crossover → mutation → evaluation of offspring → replacement, after a one-time evaluation of the initial population.
- Stop criteria: generation limit, target reached, stagnation (no best-so-far improvement for a set number of generations).
- Metrics per generation: best of generation, best so far, average, worst; mean pairwise Hamming distance (normalised), number of distinct chromosomes, per-position allele frequencies; evaluation count.
- Determinism (ADR 0001): all random draws for a generation are made up front in a fixed order and recorded as events. Results are identical at every stepping granularity and playback tier.
- History: a snapshot at every generation boundary (population, scores, generator state, active parameters); events for a generation are regenerated from the nearest snapshot on demand.
- Limits: population up to 500, generation limit up to 2,000; beyond that the UI warns.

**Run layers** (`src/run`, algorithm-agnostic per ADR 0003)
- Run, run history, cursor, playback controller with the four tiers, and metric series. They know only cycles, named stages, events, and metrics.

**UI** (`src/ui`, Svelte 5, Vite; SVG for operator views)
- Stage ribbon showing the six stages and the current one, the generation number, and transport controls: next micro-step, next stage, next generation, run, pause, run until, speed, reset, new seed.
- Playback tiers selectable on one slider: slow (micro-step), medium (stage), fast (generation, animating only population and plots), maximum (no animation). Pausing freezes at the current event.
- Stage views: weight-transformation table and roulette wheel or tournament brackets (selection); mating pool and pairs; crossover with cut points or uniform mask and inherited bits per parent; mutation with the draws and flipped genes; evaluation of offspring; replacement showing elites, survivors, and discarded individuals.
- Population table showing chromosome, decoded x, objective value, fitness, selection weight and probability side by side, with symbols and labels (elite, parent, offspring, mutated gene) in addition to colour.
- Fitness plot: average with min-to-max band, best of generation and best so far as distinct lines with distinct markers. Separate diversity plot below it. Allele-frequency strip.
- Scrub bar over the run history. Scrubbing back and changing a parameter truncates later generations after a notice naming them.
- Parameter drawer, collapsed by default, with a plain-language explanation for each control and what its probability applies to and when the draw is made. Operator parameters show as pending until the next generation boundary; population size, initialization, and seed require a reset.
- Presets menu with a one-sentence lesson per preset: Textbook population, No crossover, No mutation, High mutation. Expected-failure presets say so.
- Hand-edited initial population.
- Projector mode: larger base font (roughly 20 px body text at 1080p) and heavier lines. Layout also works at 1366×768.
- Keyboard control for stepping and playback, with the keys labelled on screen; reduced-motion handling that replaces animation with instant state changes carrying the same highlights.
- Tables use real table markup.

**Defaults** (Goldberg example)
- N = 6, one-point crossover, pc = 0.8, per-gene pm = 0.05, elites 0, roulette with Identity, offspring truncation off.
- Textbook preset: N = 4, initial population 01101, 11000, 01000, 10011 (x = 13, 24, 8, 19), one-point crossover, pc = 1.0, pm = 0.001, no elites.

### Out

- The other four examples.
- Share-by-link (first item of milestone 2).
- Deployment to a host.
- Drag-and-drop reordering in the transformation chain editor (an ordered list with move buttons is enough).
- Steady-state or (μ+λ) replacement, stochastic universal sampling, tournament without replacement.
- Screen-reader narration of animations.
- Phones, accounts, telemetry, any runtime network request.

## Acceptance criteria

1. **Textbook numbers.** The textbook preset shows fitness 169, 576, 64, 361; total 1170; average 292.5; maximum 576; selection probabilities about 0.144, 0.492, 0.055, 0.309.
2. **Reproducibility.** The same configuration and seed produce identical populations, events, and metrics when run by micro-step, stage, generation, run-until, and at every playback tier.
3. **Event/result agreement.** Replaying a generation's recorded events reproduces exactly the population the engine produced.
4. **Bypasses.** With crossover off, every offspring is an independent copy of a selected parent and selection still ran. With mutation off, every chromosome is unchanged. Both are visible in the stage views as deliberate bypasses. Mutating or recombining an offspring never alters its parent.
5. **Probabilities.** Over a fixed seed and many draws, observed crossover and mutation rates fall within a stated tolerance of the configured values, in both mutation modes.
6. **Sizes and elitism.** Population size is N after every generation; the elite count is respected; with truncation on, exactly N − k offspring survive and discards are listed; an odd mating pool shows its dropped child.
7. **Weights.** Invalid chains are rejected with a reason; negative raw fitness auto-switches to Shift and shows a banner; the displayed weights and probabilities equal the ones used for selection.
8. **Scrubbing.** Scrubbing to any generation shows the same state the live run showed; scrubbing back, editing a parameter, and stepping truncates later generations after a notice.
9. **Rendered review.** In a real browser at 1920×1080 in projector mode, a full generation can be stepped through, every label is legible at a distance, and no colour-coded meaning relies on colour alone. The instructor signs off. The layout is also checked at 1366×768.

## Verification approach

- Vitest unit tests on the engine, written test-first through its public interface: decoding and fitness tables, each operator's off-switch, copy independence, elite counts, size invariants, truncation, chain validation, tie-breaks, determinism across granularities.
- Statistical tests for the probability criteria.
- A replay test for event/result agreement.
- Playwright for a scripted classroom scenario (open the textbook preset, step to the end of a generation, scrub back, change a parameter) with 1080p screenshots reviewed by a person.

## Build sequence

1. Throwaway static mock of the Goldberg screen at 1920×1080 with hand-made data, reviewed by the instructor. It settles layout and stage views and reveals what events the views need.
2. Engine, test-first, shaped by the event needs the mock revealed.
3. Run layers.
4. Real UI on the engine, stage by stage.
5. Presets, projector mode, accessibility pass, rendered review.

## To decide during implementation (record the choice here when made)

- ~~The specific seedable generator algorithm.~~ **Decided (ticket 03): mulberry32**, one 32-bit state, so snapshots can store it. A random gene is 1 when its draw is below 0.5.
- ~~Defaults for ε in Shift, selection pressure s in Linear ranking, the Power exponent~~ **Decided (ticket 05): ε = 1, s = 1.5, exponent = 2.** Still open: the stagnation window.
- Exact key bindings.
- The symbol set for elite, parent, offspring, mutated gene, and bypass.

## Comments
