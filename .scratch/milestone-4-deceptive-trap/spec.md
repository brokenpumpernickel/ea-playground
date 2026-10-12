# Milestone 4: the deceptive trap

Status: complete (14 tickets), signed off by the instructor 2026-10-12

Vocabulary follows `CONTEXT.md` (including the new **Block**, **Trap function**, **Deceptive attractor**, **Linkage** and **Schema**). Architecture follows ADRs 0001–0005 in `docs/adr/`. Where this spec and those disagree, the ADRs and glossary win and this spec is wrong. Milestones 1–3 are complete and published; this milestone builds on the problem registry, the problem-declared columns, the contexts that give views problem-specific information (as the knapsack's bag context does), and the share-link configuration.

## Problem

The three problems so far can be climbed: a better neighbour is usually nearby. Students need to see a problem where following fitness uphill leads away from the optimum, and to connect the standard explanation (building blocks, linkage, schemas) to what the operators actually do to a population. Trap functions make this concrete and small: five blocks of four genes, each block scoring best at 1111 but pulled toward 0000.

## Goal

A fourth problem in which students evolve a chromosome divided into visible blocks, see each block's contribution to fitness, watch crossover and mutation keep or break blocks, see the population drawn toward the deceptive attractor, and track a schema over the generations. Demonstrations are illustrations, never proofs: nothing in the app says that building blocks always combine or that the schema theorem guarantees success, and runs that fail are first-class teaching material.

## Scope

### In

**Representation and trap definition**
- Binary alphabet `0, 1`; the existing operators, selection methods, elitism, truncation, links and history apply unchanged.
- The standard **Deb–Goldberg k-bit trap** on every block. With u the number of 1s in a block of k genes: contribution = k if u = k, otherwise k − 1 − u. For k = 4: 1111 → 4, 0000 → 3, 1000 → 2, 1100 → 1, 1110 → 0. Fitness = objective = the sum over blocks; the known optimum is k × m (all ones), and the deceptive attractor (all zeros) scores m × (k − 1). The definition and its source are stated in the drawer help; it is not a free-form function.
- **Setup options** (staged, applied with "Apply and restart", part of the problem's options, so carried by links and presets and validated by the same rules, with messages that name the field): block size k (2 to 8), number of blocks m (1 to 10, at most 30 genes in all), and **linkage**: tight (block b owns genes b·k+1 … b·k+k) or loose (block b owns genes b+1, b+1+m, b+1+2m, …, a fixed deterministic interleave). Defaults: k = 4, m = 5, tight.
- Decoded solution: the number of 1s in each block, written per block ("4 · 0 · 3 · 1 · 2"), so the link between the chromosome and the contributions is visible. (To confirm in the mock.)
- One-point, two-point and uniform crossover and per-individual and per-gene mutation work as for every binary problem; nothing about them changes. Roulette selection works with the non-negative fitness; a population whose total fitness is 0 (every block 1110) is handled by the existing zero-total rule and must be shown to behave as for Goldberg.

**UI**
- The problem menu gains **Trap** (logo `Tr`) with its own defaults, seed and presets, through the existing restart notice.
- **Block row**, printed once above the chromosome columns as the knapsack's item row is: each block bracketed (for loose linkage each gene carries its block's letter or number, and the brackets are replaced by that), with the block's contribution printed under each block of each chromosome in the population table. A block at its optimum (all ones) and a block at the deceptive attractor (all zeros) are distinguished by symbol and text as well as colour.
- **Population table columns:** Decoded (per-block counts) and Fitness; the contributions are carried by the block row beneath each chromosome, so no other column duplicates them.
- **Crossover view:** for each offspring and each block: inherited whole from parent A, whole from parent B, or **split** (genes from both). A split block is marked by shape and word, not colour alone, and the cut line(s) are drawn as for other binary problems. A short per-pair summary says how many blocks were kept and how many split.
- **Mutation view:** a block whose contribution changed because of a flip is marked ("block 3: 1111 → 1110, 4 → 0"); flips that leave the contribution unchanged are not called out.
- **Block states panel** (replaces the gene-share panel beside the diversity plot): for each block, how many of the N individuals have it at its optimum (all ones), at the deceptive attractor (all zeros), or somewhere in between, now and over the generations of the history, with the figures printed. Diversity stays mean pairwise Hamming.
- **Schema tracker** (a view, last in the build order so it can be dropped without touching the rest): the student writes a schema over the chromosome (`1`, `0`, `*`; length checked, with an explanation of the notation) or picks "block b solved"; the app shows, for every generation of the history, how many individuals are instances, the mean fitness of the instances, and the mean fitness of the population, and says in words which way it moved. It is a view setting: it never changes the run, it is not part of the share link, and it resets with the run. The text always states that a rising count in one run illustrates a tendency and proves nothing.
- Fitness plot, stats line, reference line (the optimum), stop criteria (generation limit, optimum reached, stagnation) work as for the other problems; the known optimum is k × m.
- Everything from milestones 1–3's accessibility pass applies: real tables, a name and a sentence for each chromosome (blocks and their contributions), a non-colour carrier for every colour-coded meaning (the audit list is extended), keyboard operation, reduced motion, projector mode, no overflow at 1920×1080 and 1366×768, with the largest instance (6 × 5 = 30 genes) as well as the default.

**Share links and presets**
- Options: k, m, linkage. Validated by the drawer's rules, every bad-option case with a readable message. A hand-edited population (strings of `0` and `1`) is carried as for Goldberg.
- **Presets** (data files, each seed verified by a test that asserts what its text says, claiming only what holds): candidates, to be settled by measurement: **Trap, tight blocks** (one-point crossover, the defaults: usually converges on the attractor); **Trap, loose blocks** (the same, interleaved: how one-point crossover splits blocks); **Bigger population** or **Uniform crossover** (what changes, only if measured); **No mutation**. A preset expected to fail says so.

**Defaults** (chosen by measurement over at least 20 seeds before the instructor approves, as before): population size, selection (tournament size by measurement), crossover and mutation settings, generation limit, and a stagnation window measured so that it does not pause runs that are still moving. The goal is that most runs with the defaults do **not** reach the optimum within the generation limit, so the deceptive behaviour is what students see, while a few do, and a preset or a parameter change visibly helps.

### Out

- Other deceptive or overlapping-block functions, bipolar traps, random linkage, a configurable trap shape, per-block k; more than one schema tracked at once; schema-theorem calculators or bounds; linkage learning algorithms.
- The two-dimensional fitness landscape (the next milestone); TSP and ant-colony optimisation remain deferred.
- Any change to the run layer, history, playback or the share-link format beyond new options.

## Acceptance criteria

1. **Existing problems untouched.** All milestone 1–3 tests pass, golden runs reproduce exactly, and the three existing problems' screens, plots and links are unchanged.
2. **The trap.** Contributions are checked on hand-worked blocks for several k (every u from 0 to k), fitness on hand-worked chromosomes (all ones, all zeros, mixed), for tight and loose linkage; the known optimum equals brute force over all chromosomes for small k × m; the deceptive attractor scores m × (k − 1); the loose linkage's gene ownership is a partition of the genes.
3. **Operators and runs.** A seeded trap run is identical by micro-step, stage, generation, run-until and every playback tier; replaying a generation's events reproduces the population; crossover, mutation, bypasses, elitism, truncation and odd mating pools hold on trap runs as for Goldberg; the zero-total population case is exercised.
4. **Block marks agree with the engine.** For every offspring and block, the crossover view's "whole from A / whole from B / split" equals what the recorded swap mask gives; the mutation view's changed blocks equal a direct recomputation of contributions before and after; the block states panel's counts equal a direct count of the population, per generation, for tight and loose linkage.
5. **Schema tracker.** Counts and mean fitnesses equal direct computation over each recorded population; invalid schemas get a readable message and change nothing; the tracker never changes a run (a run with and without it is identical); the text says what it illustrates and what it does not.
6. **Links and presets.** Every preset of all four problems and generated trap configurations (k, m, linkage, hand-edited populations) round-trip through links with run equality; each bad-option case gives a readable message and applies nothing. Each preset's text is verified by a test on its seed.
7. **Views.** The block row aligns with the gene cells for both linkages; block contributions are printed, not coloured only; the split, whole-from-A/B, changed-block and optimum/attractor marks are each carried by shape and text as well as colour; the drawer's validation messages name the field.
8. **Hosting and review.** The published site opens a trap link as the same run. In a real browser at 1920×1080 in projector mode a full generation can be stepped through, every label is legible, no colour-coded meaning relies on colour alone; the layout is also checked at 1366×768, including the largest instance. The instructor signs off.

## Verification approach

- Golden runs stay the safety net and are run before and after the engine change.
- Vitest, test-first through public interfaces: the trap function and option validation, brute-force optimum, the crossover and mutation block models against the engine's events, the block-state counts, the schema model, the configuration codec for the new options, the presets.
- Property-style tests: for generated k, m, linkage and chromosomes, ownership is a partition, fitness equals the sum of contributions, block marks equal direct recomputation.
- Playwright for scripted scenarios (switch to the trap, load each preset and check its text against the screen and the engine, change k, m and linkage through the drawer, copy a link and open it in a fresh page, track a schema, keyboard-only generation, no overflow at both sizes), and a layout test of every micro-step's narration and tables with the largest instance.
- Measurement scripts (not kept as tests) for the defaults and preset seeds, numbers recorded in the tickets.
- Lessons carried over from milestone 3: every layout claim gets a geometric test at both sizes before the screens are shown to the instructor, including the stress case (here: 6 × 5 genes, loose linkage); screens are reviewed with extreme data, not only the default; a view's width must not depend on the text beside it.

## Build sequence

1. Throwaway static mock at 1920×1080 with hand-made data: block row for tight and loose linkage, population table, crossover view with kept/split blocks, mutation view with a changed block, block states panel, schema tracker, the drawer's trap section. Reviewed by the instructor.
2. Engine: the trap problem (definition, validation, optimum), gene ownership by block, test-first, golden runs unchanged.
3. UI plumbing: registry entry and menu, block context, options in drawer and links, block row and table columns.
4. Crossover and mutation block marks (models and views).
5. Block states panel and plot integration.
6. Defaults by measurement; presets with verified seeds.
7. Schema tracker (model, view, text).
8. Accessibility and projector pass; rendered review and sign-off; the push to `main` redeploys.

## To decide during implementation (record the choice here when made)

- ~~The exact decoded text and the Decoded column.~~ **Decided (ticket 01, instructor):** the decoded text is the number of 1s in each block ("4 · 0 · 3 · 1 · 2"), column header note "1s per block"; the column is dropped above 20 genes (it does not fit).
- ~~How loose linkage is drawn.~~ **Decided (ticket 01, instructor):** style A: the genes keep their true order, every gene column has its block number printed above it (alternate blocks underlined differently), the contributions are a line of text under the chromosome, and one-point cuts stay where they really are. The regrouped style B is dropped.
- ~~Block marks and views.~~ **Decided (ticket 01, instructor):** block all ones `✓ n`, all zeros (deceptive attractor) `▽ n`, otherwise the number; crossover marks `● A` (whole from A), `▨ B` (whole from B), `◧ split`, with a badge "n whole · m split"; the mutation view marks a changed block with an orange badge "✱ block 3: 0100 → 1110 · 2 → 0" **and also says, in a dashed grey badge, when flips inside a block cancel because its number of 1s is unchanged** (this replaces the "not called out" wording above); block states panel with one bar per block (all ones solid, in between empty, all zeros hatched), the counts as text and a history line; the fitness plot gains a dashed "all zeros" reference line beside the optimum line; the schema tracker is a second tab beside "Stage view" and shows the schema's order and defining length.
- ~~Size limit.~~ **Decided (ticket 01, instructor):** at most **30 genes** (k × m ≤ 30; k 2 to 8, m 1 to 10), because 40 genes does not fit the population table at a readable size; the spec's limit of 40 is replaced throughout. With more than 20 genes only the draws that flipped a gene are printed under the genes in the mutation view.
- ~~The defaults and preset seeds.~~ **Decided (tickets 10, 11; instructor approved the measurements):** 5 blocks of 4 tight, population 12, tournament 2, one-point crossover 0.8, per-gene mutation 0.05, no elites, generation limit 100, target 20, stagnation window 70 (2 of 100 seeds reach the optimum). Six presets with seeds found by scanning and every claim tested: Tight blocks (42), Loose blocks (44, population 50), Bigger population (42, 200 individuals), Elitism (42, population 100, one elite), Uniform crossover (10, population 100), No mutation (42).
- ~~Whether "Bigger population" or "Uniform crossover" is demonstrable with a real seed.~~ **Decided (ticket 11):** both are, with statistics over seeds 1 to 100 (83 against 2; 0 against 43) and the pause generation of Run until stop stated where the run stagnates first.

## Comments
