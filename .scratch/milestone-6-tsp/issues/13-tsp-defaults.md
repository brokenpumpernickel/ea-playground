# 13 TSP defaults by measurement

Status: resolved
Type: measurement, review (needs instructor approval)
Blocked by: 07
Spec: ../spec.md

## What to build

Measure, over at least 20 seeds (more where it matters), candidate defaults for each instance and size class: population size, selection and tournament size, crossover operator and probability, mutation operator and pm, elitism, the generation limit, ε and the stagnation window. Goal: the small instances (burma14, ulysses16, ulysses22, circle, clusters, random) usually reach the optimum or come within a few per cent, berlin52 and att48 show how far a plain GA stays from it (the gap is the lesson), the stagnation window does not pause a run that is still moving, and the effects of OX against PMX against CX, swap against inversion against insertion and of elitism are measured. Report the numbers and a proposal to the instructor; set the defaults only after approval. Measurement scripts are not kept.

## Done when

- The measurements are recorded in this file, a proposal is approved by the instructor and set in the registry (defaults may depend on the instance's size), with a test that pins the defaults.

## Comments

Status note: measurements done (below); the instructor approved the proposal as written and the defaults are set (see the Answer).

## Measurements

Method: the engine's own generation loop (`startRun`, `runGeneration`), headless, seeds 1–30 for every cell, 500 generations, a random initial population; "gap" is the best tour so far against the optimum (published for TSPLIB, exact for the own instances); "reached the optimum" is a gap below 5·10⁻¹². Instances: circle (10 cities), Two clusters (12), random (12 cities seed 1, 15 cities seed 2), burma14, ulysses16, ulysses22, att48, berlin52. Two sweeps: 27 configurations one change at a time around the provisional defaults ("BASE": population 12, tournament 2, OX 0.9, inversion 0.4 per individual, 1 elite), then 14 finalists. About 10 minutes of computing each; the scripts are not kept. Population sizes are counted per generation, so a larger population also costs more evaluations per generation (which the plots show as evaluations).

### The provisional defaults (BASE), 30 seeds

| instance | median gap % at gen 50 / 100 / 200 / 500 | runs reaching the optimum by 200 / by 500 |
|---|---|---|
| circle 10 | 0.0 / 0.0 / 0.0 / 0.0 | 30 / 30 |
| Two clusters | 1.8 / 0.7 / 0.0 / 0.0 | 18 / 30 |
| random 12 | 5.8 / 0.0 / 0.0 / 0.0 | 30 / 30 |
| random 15 | 10.2 / 4.5 / 1.1 / 0.4 | 5 / 12 |
| burma14 | 8.9 / 1.6 / 0.4 / 0.0 | 12 / 27 |
| ulysses16 | 7.0 / 2.8 / 0.9 / 0.2 | 3 / 10 |
| ulysses22 | 30.2 / 14.9 / 6.6 / 1.5 | 0 / 2 |
| att48 | 152.8 / 113.3 / 74.5 / 36.2 | 0 / 0 |
| berlin52 | 143.3 / 104.3 / 73.5 / 40.9 | 0 / 0 |

### What each setting does (median gap % after 500 generations; in brackets, runs of 30 that reached the optimum by then). Population 12, tournament 3, pm 0.4, 2 elites, OX 0.9 unless the row says otherwise

| setting | random 15 | burma14 | ulysses16 | ulysses22 | att48 | berlin52 |
|---|---|---|---|---|---|---|
| **OX** (the reference row) | 1.2 (7) | 0.4 (12) | 0.2 (10) | 1.7 (2) | 15.9 | 26.7 |
| PMX | 2.9 (6) | 0.4 (10) | 0.2 (5) | 2.1 (3) | 16.9 | 25.8 |
| CX | 1.0 (8) | 0.4 (8) | 0.2 (3) | 2.0 (0) | 26.2 | 36.8 |
| no crossover | 3.5 (3) | 0.4 (10) | 0.2 (3) | 2.2 (2) | 19.7 | 28.1 |
| **inversion** (the reference row) | 1.2 (7) | 0.4 (12) | 0.2 (10) | 1.7 (2) | 15.9 | 26.7 |
| swap | 3.3 (4) | 0.4 (11) | 1.2 (3) | 9.0 (0) | 64.9 | 60.9 |
| insertion | 0.4 (6) | 0.0 (25) | 0.6 (6) | 5.8 (1) | 44.5 | 48.7 |
| 2 elites (the reference row) | 1.2 (7) | 0.4 (12) | 0.2 (10) | 1.7 (2) | 15.9 | 26.7 |
| 1 elite | 1.0 (8) | 0.0 (22) | 0.2 (12) | 1.3 (3) | 17.3 | 27.4 |
| 0 elites | 1.2 (5) | 0.4 (10) | 1.5 (2) | 9.0 (0) | 79.4 | 78.8 |
| no mutation | 43.4 (0) | 47.6 (0) | 44.7 (0) | 74.0 (0) | 269.6 | 232.7 |

(Medians at generation 500 hide the early gap: after 200 generations, no elites gives 14 % on ulysses16 where one elite gives 0.2 %.)

Reading: **mutation is essential** (without it the run is stuck at its first good tour: 45–270 % over the optimum), **elitism is essential** (without a surviving best tour the best-so-far is lost again and again), **inversion beats insertion beats swap** by a wide margin on the larger instances (a 2-opt move changes two edges and keeps the rest), **crossover helps the small instances** (random 15: 7 of 30 reach the optimum with OX against 3 without; burma14 12 against 10, ulysses16 10 against 3) **and is neutral to slightly useful on the large ones** (att48: 15.9 % with OX, 19.7 % without), **OX ≈ PMX** and **CX is the weakest** (att48: 26 %, berlin52: 37 %). **Selection pressure matters most on the large instances**: after 500 generations att48 sits at 36 % with tournament 2, 17 % with tournament 3 and 14 % with tournament 5, berlin52 at 41 %, 27 % and 22 %; on the small ones tournaments 2, 3 and 5 are within noise of one another. Roulette (shift, rank) is no better than tournament 2. pm 0.1 is slower and pm 0.8 or 1 slower still on every instance; pc 0.6 to 1 makes little difference.

### The population (tournament 3, pm 0.4; median gap % after 500 generations, and runs of 30 reaching the optimum by then)

| population, elites | random 15 | burma14 | ulysses16 | ulysses22 | att48 | berlin52 |
|---|---|---|---|---|---|---|
| 12, 1 elite | 1.0 (8) | 0.0 (22) | 0.2 (12) | 1.3 (3) | 17.3 | 27.4 |
| 12, 2 elites | 1.2 (7) | 0.4 (12) | 0.2 (10) | 1.7 (2) | 15.9 | 26.7 |
| 16, 2 elites | 0.4 (6) | 0.0 (23) | 0.2 (12) | 1.2 (7) | 12.2 | 20.0 |
| **20, 2 elites** | **0.4 (12)** | **0.0 (25)** | **0.2 (10)** | **1.3 (7)** | **9.2** | **15.0** |

(With tournament 2 a larger population is slower: 60 gives att48 60 %, berlin52 59 % after 500 generations; with tournament 3 a population of 20 is the best of the sizes measured.) The same four rows after 200 generations: att48 48 / 49 / 41 / 29 %, berlin52 59 / 63 / 46 / 42 %.

### The best finalist (population 20, tournament 3, OX 0.9, inversion 0.4, 2 elites) by generation, 30 seeds

| instance | median gap % at 25 / 50 / 100 / 200 / 300 / 500 | worst seed at 200 / 500 | runs at the optimum by 100 / 200 / 300 / 500 | median generation of first optimum |
|---|---|---|---|---|
| circle 10 | 0 / 0 / 0 / 0 / 0 / 0 | 0 / 0 | 30 / 30 / 30 / 30 | 14 |
| Two clusters | 1.1 / 0 / 0 / 0 / 0 / 0 | 1.0 / 1.0 | 20 / 23 / 25 / 28 | 46 |
| random 12 | 2.5 / 0.5 / 0 / 0 / 0 / 0 | 2.5 / 2.5 | 19 / 20 / 20 / 24 | 35.5 |
| random 15 | 9.8 / 3.3 / 1.2 / 1.2 / 1.1 / 0.4 | 5.3 / 5.3 | 6 / 7 / 8 / 12 | 125.5 |
| burma14 | 7.8 / 0.9 / 0.4 / 0 / 0 / 0 | 4.2 / 0.4 | 14 / 20 / 23 / 25 | 91 |
| ulysses16 | 8.4 / 2.6 / 1.0 / 0.2 / 0.2 / 0.2 | 3.5 / 1.8 | 1 / 5 / 7 / 10 | 206 |
| ulysses22 | 26.7 / 12.6 / 4.3 / 2.2 / 1.8 / 1.3 | 4.8 / 3.9 | 0 / 1 / 2 / 7 | 376 |
| att48 | 161.5 / 111.7 / 64.4 / 29.3 / 16.6 / 9.2 | 44.7 / 17.9 | 0 / 0 / 0 / 0 | – |
| berlin52 | 152.4 / 113.9 / 70.9 / 42.4 / 28.2 / 15.0 | 51.9 / 23.9 | 0 / 0 / 0 / 0 | – |

Against the nearest-neighbour tour (att48 21.0 % over the optimum, berlin52 19.1 %, ulysses22 50.9 %, ulysses16 45.6 %, burma14 21.8 %): the small instances beat it within 25 to 50 generations in every seed; with these defaults att48 beats it in 1 seed of 30 after 200 generations, 19 after 300 and 30 after 500; berlin52 in none after 300 and 22 of 30 after 500. (With the provisional defaults: att48 in 23 of 30 and berlin52 in 2 of 30 after 500.)

### Generation limit, ε and the stagnation window (population 20 finalist; the other finalist gives the same picture)

- **Runs still improving:** after generation 200, 5–12 of 30 runs on the small instances (random 15 12, ulysses16 11, burma14 5, clusters and random 12 6) and 19 on ulysses22 improve again; after 300, 0–9 and 9 on ulysses22; att48 and berlin52 improve in every run beyond generation 500 (the best tour so far was last improved at a median of generation 467 and 487). So a limit of 200 ends many runs while they still move; **300 covers the small instances, 500 the large ones show most of their gap closing** (att48 29 % at 200, 17 % at 300, 9 % at 500).
- **ε:** half a unit for the whole-number rules and 0.000001 for the own ones means "reached the optimum", and stops the 30 circle runs at a median of generation 14 and the others when they get there. Unchanged.
- **Stagnation window:** a GA's best-so-far improves in rare jumps after long stalls, so any window shorter than the limit ends some runs that would have improved. Runs of 30 that a window would have stopped before a later improvement (small instances, finalist): window 50: 8–18 (Two clusters 9, random 15 16, burma14 13, ulysses16 17, ulysses22 18); window 100: 7–13 (ulysses22 9); window 150: 5–10; window 200: 3–8; window 300: 0–5. On att48 and berlin52 a window of 100 or more never fires before generation 500. The window of 50 is therefore not a safe default; it stays an option for demonstrating a stall.

## Proposal to the instructor

**One setting for every instance** (the larger population and tournament 3 cost nothing on the small instances and are what lets the large ones show a gap that closes in a classroom time):

| setting | provisional | **proposed** |
|---|---|---|
| population size | 12 | **20** |
| selection | tournament, size 2 | **tournament, size 3** |
| crossover | OX, pc 0.9 | OX, pc 0.9 (unchanged) |
| mutation | inversion, pm 0.4, per individual | inversion, pm 0.4, per individual (unchanged) |
| elites | 1 | **2** (10 % of 20) |
| generation limit | 200 | **300 for up to 22 cities, 500 for the larger instances** |
| stop within ε | half a unit / 0.000001 | unchanged (means "reached the optimum") |
| stagnation window | 50 | **off** (no window); the presets that demonstrate a stall turn it on, with the window their measurement supports |

What a student sees with it (30 seeds): circle, Two clusters, random 12, burma14: the optimum in most runs within 100–200 generations (burma14 25 of 30 by 500) and never worse than 4 % over; random 15, ulysses16: within about 1 % over the optimum after 200 generations in the median, the optimum itself in 10–12 of 30 runs by 500; ulysses22: about 2 % over after 200 generations, the optimum in 7 of 30 by 500; att48 and berlin52: 29 % and 42 % over after 200 generations, 9 % and 15 % after 500 — beyond the nearest-neighbour tour in 30 and 22 of 30 runs, and the gap is the lesson.

**The alternative to weigh:** keep the population at 12 (a shorter table, fewer micro-steps: 12 offspring instead of 20) with tournament 3 and one elite. It does as well on the small instances (random 15 8 of 30 at the optimum by 500, burma14 22, ulysses16 12, ulysses22 3) and leaves the large ones at 17 % (att48) and 27 % (berlin52) after 500 generations, which is still "far from the optimum" but less clearly closing. The table of 20 individuals scrolls (about 10 rows are visible); the stage views list 20 offspring and 19 mutation cards.

**For the presets (ticket 14), what the numbers support:** OX against PMX against CX (CX is clearly weaker on att48 and berlin52: 26 % and 37 % against 16 % and 27 % at 500 generations; OX and PMX are within noise), swap against inversion (att48 65 % against 16 %), no elitism (the best tour is lost: ulysses16 at 14 % after 200 generations against 0.2 %), no mutation (stuck at its first good tour, 45–270 %), no crossover (random 15: 3 of 30 reach the optimum against 7; the large instances are close: 20 % against 16 %). **Not supported:** "a small population that stalls on Two clusters" — a population of 6 reaches the optimum on Two clusters in 29 of 30 runs by generation 500, so that preset is dropped or replaced by a measured stall (to be found in ticket 14); and "crossover is always better" is false on the large instances.

## Answer

The instructor approved the proposal as written. `tspDefaults` (`src/engine/tsp.ts`) now gives, for every instance: a random population of **20**, tournament selection of size **3**, order crossover at 0.9, inversion at 0.4 per individual, **2** elites, ε as before (half a unit for whole-number distances, 0.000001 for the own instances), **no stagnation window**, and a generation limit of **300 for up to 22 cities and 500 for the larger instances** (att48, eil51, berlin52). The registry (`problems.ts`) takes them from there, so the drawer, the menu and links show them.

Pinned by tests: `tsp.test.ts` ("the defaults, as measured and approved"): the operators and numbers above for the six TSPLIB instances, Two clusters, circles of 5 and 15 cities and random ones of 5 and 15, the limit of 300 against 500 at the boundary (ulysses22 against att48, eil51), ε per instance and the absence of a stagnation window and of a target fitness; `problems-tsp.test.ts`: the registry's defaults for every catalogue instance equal them. Tests that had counted on the provisional numbers were updated (a generation now makes 18 offspring in 9 pairs, truncation's default λ is the population size, the explicit stop-limit boundary), and the e2e walks of two generations were lengthened to cover the longer generation; the two switched-off walks now also assert that they saw pairs and offspring (they had passed while seeing none once the generation got longer).

The numbers behind the choice are above; the scripts were not kept.
