# Milestone 5: the two-dimensional landscape

Status: draft, awaiting the instructor's approval to break into tickets

Vocabulary follows `CONTEXT.md` (including the new **Real-valued chromosome**, **Bounds**, **Blend crossover (BLX-α)**, **Arithmetic crossover**, **Gaussian mutation**, **Landscape**, **Heatmap**, **Surface** and **Trail**). Architecture follows ADRs 0001–0005 and the new **ADR 0006** (real-valued chromosomes). Where this spec and the ADRs or glossary disagree, they win and this spec is wrong. Milestones 1–4 are complete and published; this milestone builds on the problem registry, the problem-declared columns, the contexts that give views problem-specific information, the schema tracker's pattern of a second view in the stage panel, and the share-link configuration.

## Problem

The four problems so far have discrete genes. Students also need to see an algorithm move through a *continuous* search space: how a population spreads over a landscape, climbs, clusters on several hills, loses diversity and converges, sometimes on the wrong hill, and what the real-valued operators they will implement next (BLX-α, arithmetic crossover, Gaussian mutation) actually do to a population.

## Goal

A fifth problem in which students evolve points (x, y) on a two-dimensional fitness landscape, watch the population on a **heatmap** and on a rotatable **surface** of the same landscape, step through every operator with its real-valued arithmetic visible, and see movement, clustering, diversity and premature convergence, including runs that end on the wrong hill. Higher fitness is always better, in height, colour, table and plot, whatever the underlying function does.

## Scope

### In

**Representation and operators (ADR 0006)**
- Two real genes (x, y) with the function's bounds. Random initialization is uniform inside the bounds. Hand-edited populations are typed as pairs of numbers.
- **Crossover** operators: one-point, two-point and uniform (discrete recombination, as for every problem; with two genes one-point swaps y, two-point is not available), **BLX-α** (per gene: a uniform draw from [min − α·d, max + α·d], d = |a − b|; α is a parameter, default 0.5) and **whole arithmetic crossover** (children λ·A + (1 − λ)·B and (1 − λ)·A + λ·B, one λ per pair, drawn uniformly from [0, 1]). The crossover probability, the bypass (copies of the parents) and "crossover off" behave as for every problem.
- **Mutation**: **Gaussian**, per gene (each gene mutates with probability pm) or per individual (with probability pm one gene, chosen at random, mutates), the step being a normal draw times σ × the gene's range (σ is a parameter, default 0.05). The symbol mutation modes are not offered for this problem.
- **Boundary handling**: values that leave the bounds are clamped, and the events and views say which genes were clamped.
- Selection (roulette with the weight chain, tournament), elitism, truncation, replacement, stop criteria and history work unchanged on the fitness numbers.

**Landscapes** (chosen in the drawer's run setup; part of the problem's options, so reset-needed and carried by links and presets; the bounds belong to the function)
- **Single peak** (maximised): f = exp(−((x − 2)² + (y + 1)²) / 8) on [−5, 5]²; optimum 1 at (2, −1). Smooth, for seeing convergence.
- **Two peaks** (maximised): a broad lower hill and a narrow tall one, on [−5, 5]²: f = 0.6·exp(−((x + 2.5)² + (y + 2.5)²) / 8) + exp(−((x − 3)² + (y − 3)²) / 0.5). The global optimum is the narrow hill (value within 1e-3 of 1, found numerically and asserted by a test), the broad hill is the trap for premature convergence.
- **Rastrigin** (minimised): f = 20 + Σ (x² − 10·cos(2πx)) over x, y on [−5.12, 5.12]²; minimum 0 at (0, 0), many local minima. Fitness = −f.
- **Himmelblau** (minimised): f = (x² + y − 11)² + (x + y² − 7)² on [−5, 5]²; four equal minima of 0 at (3, 2), (−2.805118, 3.131312), (−3.779310, −3.283186) and (3.584428, −1.848126). Fitness = −f.
- For the minimised ones the screen shows the objective f(x, y), the rule "fitness = −f" in the explanation and the column header, and the surface, heatmap, colours and plots are always of **fitness** (higher is better, with the colour scale labelled). Roulette selection uses the weight chain's existing Shift for negative fitness and says so, as it does elsewhere.
- Each function has a known optimum fitness (and for Himmelblau four optimum points), asserted by tests (analytic where possible, a fine grid search and local refinement otherwise).

**UI**
- The problem menu gains **Landscape** (logo `Ls`) with its own defaults, seed and presets, through the existing restart notice.
- **Population table columns:** x, y (three decimals; full precision in the data), the objective f(x, y) (only for minimised functions, where it differs from fitness), Fitness. The chromosome cell shows the pair "(2.134, −0.871)" with its accessible name, not bits.
- **Landscape view**, a second view of the stage panel ("Stage view | Landscape", as the schema tracker is for the trap), with the narration bar still visible so stepping makes sense:
  - **Heatmap** of fitness over the bounds with a labelled colour scale (a perceptual ramp with a non-colour carrier: isolines at fixed fitness levels with their values), axes with ticks, and the optimum marked (×, with its label; four marks for Himmelblau).
  - **Surface** of the same landscape as a shaded height field in perspective, drawn on a canvas by this app (no dependency; the single-file `file://` build is unchanged), rotated by dragging or by the arrow keys on the focused view (with buttons for left, right, up, down and reset), the population standing on it as markers that are hidden when behind a ridge, the optimum marked.
  - **The population on both**: each individual a marker with its id (shape and outline, not only colour); elites ◆ marked, the best individual of the generation marked, a selected individual highlighted on both views and in the table (click a marker or a table row, or the keyboard equivalent), and while stepping, the individuals the current stage deals with are marked: parents of the current pair, the children produced so far, mutated children with an arrow from before to after, clamped genes noted.
  - **Trails**: an option to show the last 1, 3 or 5 generations of the population as fading marks (the individuals' positions only, not lineage), off by default.
  - A text and table alternative for both views (the hidden table of positions and fitness; a sentence saying where the population is and where the best is).
- **Operator views** for real genes: the crossover card shows parents A and B as pairs, the operator and its draws (BLX-α: for each gene the interval and the draw; arithmetic: λ and both results; discrete: the cut or mask as for symbols) and the children as pairs with clamped genes marked; the mutation card shows per gene the draw u, and for a mutating gene the normal draw, the step σ × range × z and the before/after, with clamping marked; bypasses are shown as bypasses.
- **Metrics:** best, average and worst fitness as before; **diversity** is the mean pairwise distance in decoded space normalised by the diagonal of the bounds (0 to 1), the diversity plot's label says so; the strip beside it shows the population's **spread** (standard deviation of x and of y as a share of each range) in place of the allele panel; "distinct" counts distinct points.
- **Drawer setup**: function, and for the run parameters crossover operator (with α), mutation σ (and the mode), the usual probabilities, elitism, selection, stop criteria; stop criterion "target fitness reached" is **within ε of the optimum fitness** (ε a parameter, default 1e-3 of the fitness range of the function, shown), since an exact optimum is never reached by real numbers.
- Everything from milestones 1–4's accessibility pass applies: real tables, a name and a sentence for each individual, a non-colour carrier for every colour-coded meaning (the audit list extended), keyboard operation (including the surface and the marker selection), reduced motion (no rotation animation, no trail fading), projector mode, no overflow at 1920×1080 and 1366×768 for every stage, the landscape view, the drawer and the menu.

**Share links and presets**
- Options: the function. Parameters: the operator, α, σ and ε as for any parameter. The link carries a hand-edited population (pairs of numbers) exactly. Every bad-option case gets a readable message.
- **Presets** (data files, each seed verified by a test that asserts what its text says), candidates to be settled by measurement: **Single peak** (converges quickly), **Two peaks, premature convergence** (a seed that settles on the broad hill, and the statistics over seeds), **Rastrigin** (many local minima: the population splits across them), **Himmelblau** (four optima: clustering), **Mutation too small** (σ so small the population stalls), **Arithmetic crossover** (the population contracts toward its centre; diversity falls fast), **BLX-α** (α = 0.5 against α = 0: with α = 0 the children stay inside the parents' box, so the search cannot expand). A preset expected to fail says so.

**Defaults** (measured over at least 20 seeds before the instructor approves, as before): population size, selection, crossover operator, α, σ, pm and pc, elites, limits and a stagnation window measured so it does not pause a run that is still moving, so that the default function finds its optimum in most but not all runs and the harder functions show the deceptive behaviour.

### Out

- Binary-coded or Gray-coded landscapes; user-defined functions or bounds; more than two variables; constraints; multi-objective views.
- Evolution strategies (self-adaptive σ), differential evolution, CMA: later algorithms. Other real-valued operators (simulated binary crossover, polynomial mutation).
- Lineage lines across generations (only trails of positions); animated interpolation between generations (markers jump, with trails showing where they came from).
- Any change to the run layer, history, playback or the share-link format beyond new options and parameters.

## Acceptance criteria

1. **Existing problems untouched.** All milestone 1–4 tests pass, the golden runs reproduce exactly (populations, events, original metrics), and the other four problems' screens, plots and links are unchanged.
2. **Landscape functions.** Values checked on hand-worked points for each function; each known optimum (and Himmelblau's four) verified numerically; bounds as stated; fitness = f or −f as stated; every individual of every run is inside the bounds.
3. **Operators.** Hand-worked cases and property tests: BLX-α children lie in the widened interval and inside the bounds after clamping; α = 0 gives children inside the parents' box; arithmetic crossover gives λ·A + (1 − λ)·B and its mirror, with λ recorded; Gaussian mutation step equals σ × range × z with z from the two recorded uniform draws (Box–Muller, documented order); clamping is recorded and exact; per-gene and per-individual probabilities and bypasses behave as for the symbol operators; discrete operators work on real vectors; no two individuals share a chromosome array.
4. **Reproducibility and agreement.** A seeded landscape run is identical by micro-step, stage, generation, run-until and every playback tier; replaying a generation's events reproduces the population; every event's numbers agree with the displayed operator views.
5. **Views agree with the engine.** The marker positions on the heatmap and surface equal the recorded populations (data attributes), the optimum marks equal the known optima, the highlighted individual is the same on the table and both views, stage marks equal the events at the cursor, trails equal earlier populations; the surface's projection is unit-tested (a point projects where the maths says; a hidden point is hidden).
6. **Links and presets.** Every preset of all five problems and generated landscape configurations (functions, operators with α and σ, hand-edited populations) round-trip through links with run equality; every bad-option case gives a readable message and applies nothing; each preset's text is verified by a test on its seed.
7. **Accessibility.** The audit table extended and checked, keyboard-only operation of the surface and marker selection, no unnamed controls, reduced motion, projector mode, no overflow or overlap at both sizes including the landscape view.
8. **Hosting and review.** The published site opens a landscape link as the same run; in a real browser at 1920×1080 in projector mode a full generation can be stepped through with the landscape view open, every label is legible, no colour-coded meaning relies on colour alone; the layout is also checked at 1366×768; the instructor signs off.

## Verification approach

- Golden runs stay the safety net and are run before and after the engine change.
- Vitest, test-first through public interfaces: the functions and optima, the operators and their events, the real-valued initialization, formatting and parsing, metrics and stops, the codec, the presets, the projection and hidden-point logic, the view models.
- Property tests over generated runs: everything inside the bounds, replay equals live, the operator identities above.
- Playwright for scripted scenarios, with geometry tests at both sizes and at every micro-step of several generations (the lessons of milestones 3 and 4: overflow of rows inside cards, widths that do not move, narration inside its box, run with the extreme data), a rendered check of the surface by reading pixels at the marker positions where meaningful, and screenshots reviewed by a person.
- Measurement scripts (not kept) for the defaults, α, σ and the preset seeds, with the numbers recorded in the tickets.

## Build sequence

1. Throwaway static mock at 1920×1080: the landscape view (heatmap and surface with markers, trails, selection), the population table with real columns, the crossover cards for BLX-α, arithmetic and discrete, the mutation cards with Gaussian steps and clamping, the diversity and spread panels, the drawer's landscape section. Reviewed by the instructor.
2. ADR 0006 accepted; golden runs re-checked; engine: the real representation (bounds, initialization, formatting), crossover operators, Gaussian mutation, clamping, all test-first with no change to existing problems.
3. The landscape problem: the four functions, optima, scores, columns, validation.
4. UI plumbing: registry, menu, options and parameters in drawer and links, table and chromosome cells, metrics and the stop target within ε.
5. Operator views for real genes.
6. The landscape view: heatmap, then the surface (projection, shading, drag and keys), markers, selection, stage marks, trails, text alternatives.
7. Defaults by measurement; presets with verified seeds.
8. Accessibility and projector pass; rendered review and sign-off; the push to `main` redeploys.

## To decide during implementation (record the choice here when made)

- The exact colour ramp and isoline levels of the heatmap, and the surface's shading and mesh resolution, settled in the mock.
- How the population table's chromosome cell shows a pair and how a hand-edited population is typed.
- The defaults, α, σ and the preset seeds, by measurement.
- Whether each preset's demonstration is real for some seed, as before: reduce the claim to what holds, or drop the preset.

## Comments
