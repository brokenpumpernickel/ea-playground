# Evolutionary Algorithms Teaching App

## Project purpose

Build an interactive web app for teaching evolutionary algorithms, starting with genetic algorithms (GAs). Students will also implement algorithms from scratch; this app should help them understand what happens inside the algorithm and connect its mechanics to the changing solutions.

Prioritize strong visualizations, conceptual clarity, and transparent execution over a large feature set or a production optimization framework. It should work well for live classroom demonstrations and individual exploration.

This is an initial project brief, not a fixed specification. Use Claude's grill-me workflow to challenge assumptions and refine unresolved decisions before committing to detailed architecture or scope. Do not silently treat suggestions below as settled implementation choices.

## Core experience

* Provide step-by-step execution through evaluation, selection, parent pairing, crossover/recombination, mutation, and population replacement. Make the current stage and its inputs and outputs obvious.
* Also provide continuous running, pause/resume, adjustable playback speed, and reset. Allow students to inspect a paused state and then continue.
* Distinguish stepping through an operator or stage from advancing a complete generation. Refine the exact step granularity during design.
* Show how both fitness and actual solutions change over time, rather than displaying only the best-fitness curve.
* Keep the current population, chromosomes, decoded solutions, and fitness values inspectable. Show selected parents, offspring, changed genes, and retained elites where relevant.
* Keep visual playback faithful to algorithm state. Animation should explain an operation without obscuring what actually happened.

## GA controls

Expose meaningful controls with clear labels and brief explanations:

* Population size and initialization.
* Selection method, initially including roulette-wheel and tournament selection, with relevant settings such as tournament size. Leave room for additional methods.
* Crossover/recombination type and probability, using operators appropriate to each representation.
* Mutation type and probability, with an explicit distinction between per-individual and per-gene probabilities where applicable.
* Elitism, including an on/off control and a configurable number or proportion of retained individuals.
* Stopping criteria, such as generation limit or reaching a known target.
* Random seed for repeatable demonstrations.

Mutation and crossover must each be independently switchable off. Disabling mutation leaves the chromosome unchanged. Disabling crossover passes copies of the selected parents through to offspring without recombination; selection still runs. Copies must not accidentally share mutable chromosome state.

Make probability semantics visible: explain what a probability applies to and when its random decision is made. Show skipped operations as deliberate bypasses rather than making them disappear from the execution narrative.

Allow optional mechanisms to be enabled and configured as the course evolves. Elitism is an initial requirement; other mechanisms should be added when they serve a clear teaching purpose. Show their effects in the execution view.

Clarify when parameter changes take effect. Avoid silently mixing incompatible settings within a generation; discuss whether changes apply at the next generation boundary or require a reset.

## Initial teaching examples

### 1\. Goldberg's binary x² example

Maximize f(x) = x² for integer x in \[0, 31], encoded as a five-bit chromosome. Use a small, readable population so the entire evolutionary cycle can be followed on screen.

Show chromosome, decoded x, and fitness side by side. Visualize selection probabilities, crossover boundaries, inherited bits, and mutations. This is the introductory example for explaining the mechanics.

### 2\. Knapsack

Use binary inclusion genes and a small set of items with visible weights and values. Display the chosen items, total weight, total value, capacity, and feasibility alongside the chromosome.

Use this example to introduce constraints. Refine the constraint-handling approach explicitly, such as a penalty or repair, and make its effect on fitness or the solution visible. Do not hide infeasibility behind a score.

### 3\. Target string

Evolve a string toward a chosen target. Highlight matching and mismatching characters and show how crossover and mutation change the candidate.

Keep the initial fitness function easy to explain, such as the number of positions matching the target. Make the alphabet and target configurable, with sensible defaults.

### 4\. Two-dimensional fitness landscape

Evolve solutions with two decision variables. Provide a 2-D heatmap and a 3-D surface view of the same fitness landscape, with the population displayed and animated over generations.

Show movement, clustering, diversity, and possible premature convergence. Support pausing and inspecting individuals. Consider population history or trails where they improve understanding without cluttering the view.

Refine the initial landscape functions, variable encoding, bounds, and compatible operators during design. Keep maximization/minimization direction clear and consistent across the surface, colors, and fitness display.

### 5\. Deceptive trap functions

Use a binary chromosome divided into visible blocks and expose each block's fitness contribution. Choose a standard, documented trap definition during refinement and explain why locally attractive partial solutions can lead away from the global optimum.

Use this example to support discussion of schemas, building blocks, linkage, and the schema theorem. Visualize block inheritance and disruption during crossover and mutation. Treat demonstrations as illustrations, not proofs that building blocks always combine successfully or that the schema theorem guarantees optimization success.

## Visualization principles

* Give every example a clear relationship between genotype, decoded solution, and fitness.
* Use motion, highlighting, and lineage to explain causal changes. Avoid decorative animation that makes comparison harder.
* Keep colors and symbols consistent across population tables, operator views, and plots. Do not rely on color alone.
* Show best and average fitness over generations, and useful diversity information where it is meaningful for the representation. Distinguish current-population best from best-so-far.
* Keep scales, optimization direction, and feasibility legible. Explain transformed selection weights when they differ from raw fitness.
* Provide readable classroom-sized labels and controls, accessible interactions, and layouts that remain usable on ordinary student laptops.
* Support unsuccessful runs and stochastic variation as teaching material. Do not imply that every configuration reliably finds the optimum.

## Algorithm transparency and correctness

Keep algorithm state and execution logic separate from presentation so the same run can support stepping, continuous playback, and multiple views.

Record enough information to explain the actual run: operator decisions, selected parents, offspring, mutations, fitness evaluations, and population replacement. Seeded runs should be reproducible under the same configuration and implementation.

Be explicit about representation-specific operators, selection assumptions, constraint handling, boundary handling, and elitism/replacement semantics. In particular, roulette-wheel selection needs valid weights; do not directly use negative or otherwise unsuitable raw fitness values without a visible, defined transformation.

Verify the educationally important behavior: decoding, fitness, operator probabilities and bypasses, population size, elitism, reproducibility, and agreement between displayed events and algorithm results. Validate visual usability through actual rendered views and representative classroom interactions.

## Scope and future direction

Start with a coherent GA experience and the five examples above. Keep the design extensible to other evolutionary algorithms without building a large generalized framework in advance.

TSP is explicitly deferred. Introduce it later with permutation representations and appropriate operators, and potentially revisit it during ant-colony optimization material. Do not include TSP or ant-colony optimization in the initial implementation scope.

## Some decisions to refine with grill-me

* Intended classroom workflow, language, and learner assumptions.
* Technology stack, hosting, and whether everything runs locally in the browser.
* First implementation milestone and order of the five examples.
* Step granularity, event history, and whether backward inspection or replay is needed.
* Default parameters, operator choices per representation, and parameter-change behavior.
* Exact knapsack constraints, landscape functions, and trap definitions.
* Balance between detailed operator inspection and uncluttered continuous visualization.

Resolve these through discussion and small reviewable prototypes. Preserve the project's teaching goals when making implementation tradeoffs.

* ...

## Agent skills

### Issue tracker

Issues and specs are local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.



