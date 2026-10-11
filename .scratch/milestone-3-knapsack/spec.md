# Milestone 3: the knapsack

Status: broken into tickets (17), see `issues/`

Vocabulary follows `CONTEXT.md` (including **Penalty**, **Repair** and **First-fit decoder**, and the new **Feasible** and **Packed set**). Architecture follows ADRs 0001–0004 in `docs/adr/`. Where this spec and those disagree, the ADRs and glossary win and this spec is wrong. Milestones 1 and 2 are complete and published; this milestone builds on the problem registry, the problem-declared columns and the share-link configuration they introduced.

## Problem

The app so far teaches unconstrained problems: every chromosome is a valid answer. Real optimisation problems have constraints, and students meet the central difficulty there: what should the algorithm do with an answer that breaks the rules? A knapsack makes this concrete and small: a bag with a capacity, items with weights and values, and chromosomes that can simply be too heavy.

## Goal

A third problem in the app in which students evolve a packing of a small, visible set of items, see every chromosome's weight, value and feasibility, and compare three standard ways of handling an overweight bag: a **penalty**, **repair** (Lamarckian and Baldwinian), and the **first-fit decoder**. Infeasibility is never hidden behind a score.

## Scope

### In

**Representation and instance**
- One binary gene per item: 1 means "pack it". Alphabet `0, 1`; the existing operators, selection methods, elitism, truncation, links and history apply unchanged.
- A **built-in instance of 12 items** with integer weights and values and a capacity of about 40–50% of the total weight, designed (and verified by a test) so that: the optimum is known (dynamic programming, cross-checked by brute force over all 4,096 bags); packing by best value-per-weight is **not** optimal; and a uniformly random chromosome is infeasible about as often as not. Items are named A, B, C, … in order.
- The instance is **editable** in the drawer's run setup (staged, applied with "Apply and restart", like the target and alphabet): an item table with weight and value per item, add and remove items, and the capacity. Limits: 2 to 20 items, weights whole numbers 1–99, values whole numbers 1–999, capacity a whole number of at least 1 and at most the total weight, at least one item that fits alone. Messages name the item or field that is wrong. The instance is part of the problem's options, so it is carried by share links and presets and validated by the same rules.

**Constraint handling** (a setup option, so changing it is a reset: it changes what fitness means)
Chosen in the drawer's run setup; **the default is the first-fit decoder** (instructor's choice). In every method the packed set, its weight and value, and feasibility are shown, and genes that are 1 but not packed stay visible.
1. **First-fit decoder** (default). The chromosome is never changed. The packed set is built by walking the items in order A, B, C, …: pack an item if its gene is 1 and it still fits, otherwise skip it and continue. Always feasible. Objective = fitness = value of the packed set.
2. **Penalty.** The packed set is exactly the genes set to 1, which may be overweight. Objective = total value of the packed set. `penalty = ρ × (weight − capacity)` when overweight, otherwise 0; `fitness = value − penalty`. ρ ("penalty per unit of excess weight") is a setup setting, shown only for this method; its default is chosen by measurement (see Defaults). Fitness can be negative; roulette selection then uses the existing automatic switch to Shift and says so.
3. **Repair, Lamarckian.** If the genes are overweight, items are dropped until the bag is feasible: always the packed item with the lowest value per unit of weight, ties going to the later item. The **repaired chromosome replaces the original**: the genes of dropped items become 0 in the individual itself. Objective = fitness = value of the repaired bag.
4. **Repair, Baldwinian.** The same repair rule, but the chromosome is left as it was; only the packed set and the score use the repaired bag. Objective = fitness = value of the repaired bag.
- Repair and the decoder apply to the initial population too; the evaluation stage shows what each individual was and what it became or packed.

**Engine** (DOM-free TypeScript, test-first; the run layer does not change)
- `Scores` gains optional problem-specific detail the views and metrics need: whether the individual is feasible (default true when absent, so every existing problem is unchanged), and, for Lamarckian repair, the repaired chromosome. Evaluation may therefore rewrite an individual's chromosome. Offspring are rewritten after evaluation, and the evaluation event records both the chromosome as mutation left it and as repaired, so replaying the events still reproduces the population exactly (`populationFromEvents` must handle it). This is the one real engine change and gets an ADR (0005).
- The problem declares its columns per handling method (Packed, Weight, Value, Feasible, Penalty where it applies, Fitness) through the existing column declaration. Sentences ("packs C, F, K: weight 31 of 30, value 52, overweight by 1 → penalty 10 → fitness 42") come from the problem's score text.
- Metrics gain, for problems that report feasibility: the number of feasible individuals, the best feasible fitness of the generation and the best feasible fitness so far. Existing metrics, and the golden fixtures that record the original nine fields, are unchanged.
- **Stop criteria** "target fitness reached" and "stagnation" use the best *feasible* fitness so far, so an overweight bag that scores well under a too-small penalty never counts as success. For every other problem this is identical to today. The known optimum (the DP value) is the target and the reference line.
- The knapsack declares no landscape (so the function-plot toggle is not offered).

**UI**
- The problem menu gains **Knapsack** (logo `Kn`), with its own defaults, seed and presets, through the existing restart notice.
- **Item row**, printed once above the chromosome columns as the target row is for strings: each item's letter with its weight and value under it, so every gene cell lines up with its item. A filled cell is "in the bag"; a gene that is 1 but was not packed (decoder, or Baldwinian repair) is marked as skipped by shape (a dashed filled outline and the word "skipped" in its description), not only by colour.
- **Population table columns:** Packed (the letters), Weight, Value, Feasible (✓ or ✗ with the word), Penalty (penalty method only), Fitness. A **capacity bar** shows weight against capacity, with overflow drawn as a hatched segment and its number, never colour alone.
- **Stage views:** the evaluation view shows, per individual, the chromosome, what was dropped or skipped and why (the rule applied), and the score as above; Lamarckian repair shows `before → after` on the chromosome with the changed genes marked (the ✱ is for mutation; repair uses its own mark, ✂, with the same non-colour treatment). Crossover and mutation views are unchanged (binary).
- **Bottom strip:** the gene-share panel becomes **Chosen per item**: the share of the population that has each item's gene set to 1, labelled by item letter. The fitness plot gains **best feasible so far** as a further line when the method is the penalty (otherwise it would coincide with best so far); the legend and a hidden table carry it. The stats line says how many of the N individuals are feasible. Diversity stays mean pairwise Hamming.
- **Drawer:** an Instance section (item table, capacity, with live validation) and a Constraint handling selector with a one-line explanation of each method, and ρ for the penalty. Staged and applied with "Apply and restart". Operator parameters, presets and warnings behave as before.
- Everything from milestones 1 and 2's accessibility pass applies: real tables, a name and a sentence for each chromosome (which items are in the bag, which were dropped or skipped, weight against capacity), a non-colour carrier for every colour-coded meaning (the audit list is extended), keyboard operation, reduced motion, projector mode, no overflow at 1920×1080 and 1366×768.

**Share links and presets**
- The configuration's options for this problem: the items (weight and value each), the capacity, the handling method and ρ. Validated by the drawer's rules; every bad-option case gets a readable message. The link carries a hand-edited population (strings of `0` and `1`) as for Goldberg.
- **Presets** (data files, each seed verified by a test that asserts what its text says, claiming only what holds):
  1. **Evolve a bag**: the defaults (first-fit decoder), reaching the optimum or close to it.
  2. **Penalty too small**: the population converges on an overweight bag that scores best; the optimum is "cheated". Shows the reference line being exceeded and the infeasible winner.
  3. **Penalty too large**: infeasible bags are wiped out and the run settles on a poor feasible bag (only if a verified seed shows it; otherwise the claim is reduced to what the seed shows).
  4. **Repair: Lamarckian** and 5. **Repair: Baldwinian**: the same instance, seed and parameters; what differs between them (for example diversity or the packed sets) is stated only if measured for these seeds.

**Defaults** (chosen by measurement over at least 20 seeds before the instructor approves, as for the string): handling first-fit decoder; population size, selection (tournament, size by measurement), crossover and mutation settings; stop criteria: generation limit, optimum reached (best feasible), and a stagnation window measured so that it does not pause successful runs. The goal is that most seeds reach the optimum or come within one item of it in a classroom-sized run, but not all, so unsuccessful runs remain teaching material. ρ's default is measured so that a bag that is only slightly overweight is not a bargain, while the "too small" and "too large" presets use clearly different values.

### Out

- Other constraint-handling methods (adaptive penalties, feasibility-first selection, multi-objective views); other repair rules than the one stated.
- Item names other than A, B, C, …; fractional weights or values; more than one constraint; a quantity per item (the 0/1 knapsack only).
- The other two examples (deceptive trap, 2-D landscape), later milestones; TSP and ant-colony optimisation remain deferred.
- Any change to the run layer, history, playback or share-link format beyond new options.

## Acceptance criteria

1. **Existing problems untouched.** All milestone 1 and 2 tests pass, and the golden runs reproduce exactly (populations, events and the original nine metrics); Goldberg's and the target string's screens, plots and links are unchanged.
2. **Instance numbers.** Weight, value and feasibility are checked on hand-worked bags of the built-in instance (empty, full, exactly at capacity, one over). The DP optimum equals brute force on the built-in instance and on generated small instances; value-per-weight greedy is shown not to be optimal on the built-in one.
3. **Handling methods.** Hand-worked cases for each: penalty arithmetic (exactly at capacity has no penalty; one unit over costs ρ); first-fit decoder skips an item that does not fit and still packs a later one that does, genes of skipped items stay 1; repair drops the lowest value-per-weight item first, ties to the later item, and stops as soon as the bag fits; Lamarckian writes the repaired chromosome back and the evaluation event records before and after; Baldwinian leaves the chromosome and scores the repaired bag; the decoder and both repairs always produce feasible packed sets; the decoder and Baldwinian repair never change a chromosome.
4. **Reproducibility and agreement.** A seeded knapsack run is identical by micro-step, stage, generation, run-until and every playback tier, for every handling method; replaying a generation's events reproduces the population (including Lamarckian rewriting) and agrees with the displayed evaluation.
5. **Feasibility metrics and stops.** Feasible counts and best-feasible values equal what a direct count gives. Under a penalty small enough that an overweight bag beats the optimum, "target reached" does not fire for it, and the reference line is exceeded visibly. For problems without feasibility everything is as before.
6. **Operators.** Crossover, mutation (with their bypasses), elitism, truncation, odd mating pools and size invariants hold on knapsack runs as for Goldberg.
7. **Links and presets.** Every preset of all three problems and generated knapsack configurations (item sets, capacities, methods, ρ, hand-edited populations) round-trip through links with run equality; each bad-option case gives a readable message and applies nothing. Each preset's text is verified by a test on its seed.
8. **Views.** Item row aligned with the gene cells; table columns per method; the feasible mark, capacity bar, skipped and repaired genes each carried by shape and text as well as colour; chosen-per-item equals the population's actual counts; the fitness plot's feasible line equals the metrics; the drawer's validation messages name the item or field.
9. **Hosting and review.** The published site opens a knapsack link as the same run. In a real browser at 1920×1080 in projector mode a full generation can be stepped through, every label is legible, and no colour-coded meaning relies on colour alone; the layout is also checked at 1366×768. The instructor signs off.

## Verification approach

- **Golden runs stay the safety net** for the engine change: they are run before and after, unchanged.
- Vitest unit tests, test-first through public interfaces: the instance and its validation, DP versus brute force, each handling method on hand-worked cases, the evaluation event and `populationFromEvents` with repair, the feasibility metrics and stop criteria, the configuration codec for the new options, the presets.
- Property-style tests: for generated instances and chromosomes, every decoder/repair output is feasible, repair never drops more than needed, DP equals brute force.
- Playwright for scripted scenarios: switch to the knapsack, load each preset and check its text against the screen and the engine, change the handling method and the instance through the drawer, copy a link and open it in a fresh page, keyboard-only generation, no overflow in projector mode at both sizes. Screenshots at 1920×1080 and 1366×768 reviewed by a person.
- Measurement scripts (not kept as tests) for the defaults, ρ, the stagnation window and the preset seeds, with the numbers recorded in the tickets.

## Build sequence

1. Throwaway static mock of the knapsack screens at 1920×1080 with hand-made data (item row, table per handling method, capacity bar, skipped and repaired genes, evaluation view, chosen-per-item, fitness plot with the feasible line, the drawer's instance section), reviewed by the instructor.
2. Golden runs re-checked; ADR 0005; engine: `Scores` detail (feasible, repaired chromosome), evaluation rewriting, replay, feasibility metrics, feasible-aware stop criteria, all test-first with no change to existing problems.
3. The knapsack problem (instance, DP, the four handling methods, columns, score text) and its validation.
4. UI: registry entry and menu, item row, columns, capacity bar, evaluation view with repair, chosen-per-item, plot line, drawer sections.
5. Link options, defaults by measurement, presets with verified seeds.
6. Accessibility and projector pass; rendered review and sign-off; the push to `main` redeploys the site.

## To decide during implementation (record the choice here when made)

- The exact built-in instance (weights, values, capacity) satisfying the three design conditions.
- The defaults (population size, tournament size, operator settings, ρ, stagnation window) and the preset seeds, by measurement.
- ~~The mark for a gene dropped by repair and for a skipped gene; where the capacity bar goes.~~ **Decided (ticket 01, instructor):** a gene that is 1 but not in the bag (decoder, Baldwinian repair) is a ✕ in a dashed, plain cell; a gene Lamarckian repair rewrote to 0 has a dotted orange outline with ✂ above it; there is no separate before/after box (the ✂ marks and the "what happened" column carry it); the capacity bar is small in each table row and stacked per item in the evaluation view; there is no Packed column (the filled cells are the packed items); cells are 23 px wide in the knapsack tables.
- Whether penalty-too-large is demonstrable with a real seed; if not, the preset is dropped or its text reduced to what holds.

## Comments
