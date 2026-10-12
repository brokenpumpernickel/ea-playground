# Milestone 6: the travelling salesperson (permutation GA)

Status: spec drafted from the grill (Q1 to Q8, all recommended, plus the instructor's addition of TSPLIB instances such as berlin52); next: the mock, then tickets.

Vocabulary follows `CONTEXT.md` (including the new **Permutation chromosome**, **Tour**, **Edge**, **Order crossover (OX)**, **Partial-mapped crossover (PMX)**, **Cycle crossover (CX)**, **Swap**, **Inversion** and **Insertion mutation**, **Edge agreement**, **Gap to the optimum** and **Nearest-neighbour tour**). Architecture follows ADRs 0001–0006 and the new **ADR 0007** (the permutation representation), proposed with this spec. `CLAUDE.md` deferred TSP "until later"; this is that milestone. Ant-colony optimisation stays deferred.

## Problem

Every problem so far has independent genes: bits, letters, numbers. Students also need to see what happens when a solution is an *ordering*, where every city must appear exactly once, so that ordinary crossover and mutation break the chromosome, and the operators have to be designed around the constraint. The travelling salesperson problem is the standard stage for that, and it is the instance the later ant-colony material will return to.

## Goal

A sixth problem in which students evolve tours through a set of cities, watch the population's tours on a **route map**, step through order, partial-mapped and cycle crossover and through swap, inversion and insertion mutation with every slice, mapping and cycle visible, and compare a run with the **known optimum** (exact for every instance, including real TSPLIB instances such as berlin52) and with a greedy baseline. Higher fitness is always better: fitness = −tour length.

## Scope

### In

**Representation and operators (ADR 0007)**
- A **permutation chromosome**: n genes, each a city, every city exactly once. Cities are numbered 1 to n on screen (as in TSPLIB) and 0 to n − 1 in the data. The tour is **closed** (the last city returns to the first). The chromosome is the full permutation, so a rotation or a reversal of the same route is a different chromosome with the same length; the table also shows the **canonical route** (starting at city 1, in the direction whose second city is the lower), and "distinct" counts distinct routes.
- **Initialization**: uniformly random permutations (Fisher–Yates, n − 1 recorded draws in a documented order); hand-edited populations are typed as city numbers ("1 5 3 2 4"), with a readable message for a missing city, a repeated city or a number out of range.
- **Crossover** (one probability per pair, drawn as for the other problems; a failed draw is a bypass with copies):
  - **Order crossover (OX)**: two cut points drawn; child 1 keeps parent A's slice in place and fills the other positions, starting after the second cut and wrapping round, with the cities it lacks in the order parent B visits them from after the second cut; child 2 swaps the roles.
  - **Partial-mapped crossover (PMX)**: two cut points; child 1 takes parent B's slice in place and keeps A's city at every other position unless that city is already in the slice, in which case it follows the **mapping** between the two slices (through its chain) to a city that is free; child 2 swaps the roles. The mapping table is shown.
  - **Cycle crossover (CX)**: no random cut. The positions split into **cycles** (position i, the city B has there, the position where A has that city, and so on); the first cycle's positions are copied from A, the second's from B, alternating. A permutation pair with a single cycle gives children identical to the parents, which the view says.
  - Only these operators are offered; one-point, two-point and uniform crossover are not, since they would repeat and lose cities. The OX card says why in a sentence. Edge recombination and other operators are out.
- **Mutation** (one move per *mutated individual*; the probability is per individual, because "per gene" has no meaning here, and the views and events say so): **swap** (two distinct positions exchanged), **inversion** (the slice between two cuts reversed, a 2-opt move) and **insertion** (one city removed and put back at another position). Flip and Gaussian are not offered. Every draw is recorded: the individual's draw u against pm, then the positions in a documented order.
- Selection (roulette with the weight chain and its Shift for negative fitness, tournament), elitism, truncation, replacement, stop criteria and history work unchanged on the fitness numbers.
- Every operator returns a permutation (a test property); no two individuals share a chromosome array.

**Instances** (the problem's options, so reset-needed and carried by links and presets)
- **Own instances**, distances real Euclidean, lengths shown to one decimal:
  - **Circle** (n 5 to 15, default 10): cities evenly spaced on a circle; the optimum is the perimeter, and the lesson is a tour that crosses itself.
  - **Two clusters** (fixed, n = 12): two tight groups far apart, where greedy and random tours go wrong.
  - **Random** (n 5 to 15, default 10, a seed): cities uniform in a square; the optimum by **Held–Karp** (dynamic programming over subsets, instant for n ≤ 15).
- **TSPLIB instances** (Reinelt, TSPLIB, 1991; the data files in the repository carry the name, the comment, the distance type and the source), each with the optimal tour from TSPLIB's `.opt.tour` and the published optimum: **burma14** (GEO, 3323; optimum checked by Held–Karp), **ulysses16** (GEO, 6859), **ulysses22** (GEO, 7013), **att48** (ATT, 10628), **eil51** (EUC_2D, 426), **berlin52** (EUC_2D, 7542), **st70** (EUC_2D, 675), **eil76** (EUC_2D, 538) and **kroA100** (EUC_2D, 21282). The menu groups them by size; the list is settled in the mock and by measurement (which are worth a lecture).
- **Distances** follow TSPLIB's rules exactly for these instances (EUC_2D: Euclidean rounded to the nearest integer; ATT: the pseudo-Euclidean with its rounding rule; GEO: the great-circle formula on the given degrees and minutes, truncated) so that the published optimum is *the* optimum; the information line says which rule an instance uses. Asymmetric and explicit-matrix instances are out.
- **Known optimum** for every instance, asserted by tests: the stored optimal tour of a TSPLIB instance has, under the implemented distance rule, exactly the published length (checked for all of them: 3323 by Held–Karp, the others by the tour files); the circle's by its formula; the random and two-cluster instances by Held–Karp, itself checked against brute force on every instance of up to 8 cities.
- **Reference lines**: the **nearest-neighbour tour** from city 1 (deterministic, ties to the lower number) is computed for every instance and drawn as a dashed line on the fitness plot beside the optimum, so a run can be read against both a greedy baseline and the truth.
- **Gap to the optimum**: (length − optimum) / optimum, shown in per cent next to the best length everywhere the best length is shown (stats lines, narration of the replacement, the table).

**UI**
- The problem menu gains **TSP** (logo `Ts`) with its own defaults, seed and presets, through the existing restart notice.
- **Population table:** the chromosome cell shows the sequence of city numbers (compact, wrapping for long tours, the layout settled in the mock), then the tour length (the objective), the gap, and Fitness (the note "= −length"). The accessible name of a chromosome is the route in words with its length and gap. Elites ★, as ever.
- **Route map**, a second view of the stage panel ("Stage view | Route map", as the landscape's view is), with the narration bar still visible: the cities as numbered dots, and
  - the **best tour of the generation** drawn bold;
  - the **population's edges** faint, their width proportional to the number of individuals that use them (the picture of convergence);
  - the **selected individual's tour** highlighted (click a table row or its id, or the keyboard equivalent), the same one in the table and on the map;
  - the **optimal tour** on request (a toggle, off by default, dashed grey), so a student can see where the run's tour differs from the best;
  - while stepping, the stage marks: in crossover parent A's edges solid and B's dashed with the child's tour on top and the slice or cycle named; in mutation the removed edges crossed out (✕) and the added edges marked; every mark has a shape or a dash as well as a colour;
  - GEO instances are drawn with longitude across and latitude up; the axes are labelled as such;
  - a text alternative (a sentence: where the best tour is, its length, its gap, how many edges the population agrees on) and a table of the best and selected tours.
- **Operator views**: the crossover cards show parent A, parent B and each child as strips of city numbers with the slice, the fill order (OX), the mapping table and its chains (PMX) or the cycles (CX) marked, with the cut points and the draws; long tours wrap into rows (layout settled in the mock). The mutation cards show the individual's draw and the positions drawn, the before and after strips and, for each move, the edges removed and added with the change in length. The numbers printed are the event's.
- **Metrics:** best, average and worst fitness as before, but the stats lines and the table speak in lengths; **diversity** is the mean share of edges two individuals do not have in common (0 to 1), the diversity plot's note says so; the strip beside it is **Edge agreement**, for each edge of the best-so-far tour the share of the population that uses it, with the figures printed, in place of the allele panel; "distinct" counts distinct routes.
- **Fitness plot**: fitness = −length (the floor below zero already built for the landscape), with the optimum line and the nearest-neighbour line, both labelled in words.
- **Drawer setup**: the instance (and n and the seed for the random one, n for the circle), the crossover operator (OX, PMX, CX), the mutation operator (swap, inversion, insertion) with its per-individual probability, selection, elitism, truncation, stop criteria (the generation limit, the stagnation window and "within ε of the optimum", ε small by default), the population seed; the restart notice says what is reset when the instance changes.
- Everything from milestones 1–5's accessibility pass applies: real tables, a name and sentence for each individual and for the map, a non-colour carrier for every colour-coded meaning (the audit list extended), keyboard operation (including selecting an individual from the map), reduced motion, projector mode, and no overflow or overlap at 1920×1080 and 1366×768 for every stage, the route map, the drawer and the menu, for the shortest and the longest tours, 12 and 60 individuals, **and the top bar with the longest instance and preset names** (milestone 5's lesson: check the header, not only the panels).

**Share links and presets**
- Options: the instance (for the random one n and the seed, for the circle n). Parameters: the operators, the probabilities as for any parameter. The link carries a hand-edited population (city numbers) exactly. Every bad-option case gets a readable message (an unknown instance, n out of range, a symbol operator on a permutation, a permutation operator on another problem).
- **Presets** (data files, each seed verified by a test that asserts what its text says; the candidates are settled by measurement): **OX, PMX and CX on the same instance and seed**, **swap against inversion**, **no crossover** (mutation alone), **no elitism**, **a small population that stalls on Two clusters**, **Circle and the crossing tours**, and **berlin52 against the nearest-neighbour baseline and the optimum** (what a plain GA reaches in a given number of generations, stated as the statistics over seeds). A preset expected to fail or to stay far from the optimum says so; a demonstration that is not real for any seed is reduced to what holds or dropped.

**Defaults** (measured over at least 20 seeds before the instructor approves, as in milestones 4 and 5; they may depend on the size of the instance): population size, selection, crossover operator and probability, mutation operator and probability, elites, the generation limit, the stagnation window (measured so that it does not pause a run that is still moving), ε. For the small instances the default run should usually reach the optimum; for berlin52 and larger it will not within a classroom number of generations, and the screen says plainly how far it is (the gap), since an unsuccessful run is material.

**Carry-over:** ticket 18 of milestone 5 (the knapsack stacked bar can run past its track) is fixed first.

### Out

- Clicking cities onto a map; uploading TSPLIB files or typing coordinates; asymmetric and explicit-matrix instances; instances beyond kroA100.
- Edge recombination and other permutation operators; local search and memetic variants (2-opt applied to every child); Lamarckian or Baldwinian repair of permutations; a one-point-crossover-with-repair demonstration.
- Ant-colony optimisation and any other algorithm than the GA; batch statistics and run comparison.
- Any change to the run layer, history, playback or the share-link format beyond new options and parameters.

## Acceptance criteria

1. **Existing problems untouched.** All milestone 1–5 tests pass, the golden runs reproduce exactly (populations, events, original metrics), and the other five problems' screens, plots and links are unchanged.
2. **Instances and distances.** Each TSPLIB distance rule is checked on hand-worked pairs; every stored optimal tour recomputes to the published optimum (the nine instances), burma14 by Held–Karp; Held–Karp is checked against brute force for every instance of up to 8 cities and on seeded random ones; the circle's optimum equals its perimeter; a seeded random instance is identical on every run; the nearest-neighbour tour is hand-worked on a small instance; fitness = −length; every individual of every run is a permutation.
3. **Operators.** Hand-worked cases and property tests: OX keeps the slice in place and the remaining cities in B's order from after the second cut; PMX keeps B's slice in place, every other city of A stays where it is unless it conflicts, and every mapping chain ends on a free city; CX copies each position from the parent of its cycle, alternating; swap, inversion and insertion change exactly the positions the event states and leave a permutation; per-individual probability and bypasses behave as for the symbol operators; probabilities of 0 and 1; two cuts equal, at the ends, and n = 3 (the smallest n these need) all work; the symbol operators are refused for a permutation problem, and the permutation operators for the others, with a readable message in the drawer and in links; no two individuals share an array.
4. **Reproducibility and agreement.** A seeded TSP run is identical by micro-step, stage, generation, run-until and every playback tier; replaying a generation's events reproduces the population; every event's numbers agree with the displayed operator views.
5. **Views agree with the engine.** The route map's drawn edges equal the tours (data attributes), the edge widths equal the population's edge counts, the best, selected and optimal tours are the right ones, stage marks equal the events at the cursor, the edge-agreement figures equal the metrics, the same individual is highlighted in the table and on the map; GEO and ATT instances draw where their coordinates say.
6. **Links and presets.** Every preset of all six problems and generated TSP configurations (every instance kind, every operator, hand-edited populations) round-trip through links with run equality; every bad-option case gives a readable message and applies nothing; each preset's text is verified by a test on its seed (and over seeds where it says "usually").
7. **Accessibility.** The audit table extended and checked, keyboard-only operation including the map and the selection, no unnamed controls, reduced motion, projector mode, no overflow or overlap at both sizes including the route map and the **top bar**, for 5, 15, 52 and 100 cities, with extreme data (all cities on a line, duplicate cities at one place, the longest instance and preset names).
8. **Hosting and review.** The published site opens a TSP link as the same run; in a real browser at 1920×1080 in projector mode a full generation can be stepped through with the route map open, every label is legible, no colour-coded meaning relies on colour alone; the layout is also checked at 1366×768; the instructor signs off.

## Verification approach

- Golden runs stay the safety net and are run before and after the engine change.
- Vitest, test-first through public interfaces: distances and instances, Held–Karp and brute force, nearest neighbour, the three crossovers and three mutations and their events, initialization, formatting and parsing of tours, metrics and stops, the codec, the presets, the view models.
- Property tests over generated runs: every individual a permutation, replay equals live, the operator identities above.
- Playwright for scripted scenarios, with geometry tests at both sizes and at every micro-step of several generations (milestones 3 to 5's lessons: overflow of rows inside cards, widths that do not move, narration inside its box, the header, extreme data, long tours), and screenshots reviewed by a person.
- Measurement scripts (not kept) for the defaults and the preset seeds, with the numbers recorded in the tickets.

## Build sequence

0. Ticket 18 of milestone 5.
1. Throwaway static mock at 1920×1080: the route map (best tour, edge heat, selected tour, optimal tour, stage marks), the population table with long permutations, the OX, PMX and CX cards for a short and a long tour, the mutation cards, the edge-agreement and diversity panels, the drawer's TSP section and the menu with the instances. Reviewed by the instructor.
2. ADR 0007 accepted; golden runs re-checked; engine: the permutation representation, initialization, OX, PMX, CX, swap, inversion, insertion, all test-first with no change to existing problems.
3. The TSP problem: instances and distance rules (with the TSPLIB data files and their verification), Held–Karp, nearest neighbour, scores and columns, validation.
4. UI plumbing: registry, menu, options and parameters in drawer and links, table and chromosome cells, metrics and the stop within ε.
5. Operator views for permutations.
6. The route map: edges, edge heat, selection, optimal tour, stage marks, text alternatives.
7. Defaults by measurement; presets with verified seeds.
8. Accessibility and projector pass; rendered review and sign-off; the push to `main` redeploys.

## To decide during implementation (record the choice here when made)

- How a long permutation is laid out in the population table and the crossover cards (52 and 100 genes): wrapped rows, a truncated cell with the full route in the detail, or numbers in a dense grid. Decided in the mock.
- The route map's drawing rules: edge-heat scale, how stage marks look, GEO and ATT projections, the optimal-tour overlay.
- Which TSPLIB instances stay in the menu, after measuring what a classroom run reaches on each.
- The defaults, the presets' seeds and their claims, by measurement.
- Whether the nearest-neighbour reference line stays (the instructor may veto it in the mock review).

## Comments
