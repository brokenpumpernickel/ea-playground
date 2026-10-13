# 07 TSP run properties

Status: resolved
Type: task (test-first)
Blocked by: 04, 05, 06
Spec: ../spec.md

## What to build

Property tests over generated TSP runs (every instance kind, every crossover, every mutation, probabilities 0 and 1, elites, truncation): every individual of every generation is a permutation; a seeded run is identical by micro-step, stage, generation, run-until and every playback tier; replaying a generation's events reproduces its population; the stop within ε of the optimum and the generation limit and the stagnation window behave as for the other problems; the roulette weight chain accepts the negative fitness with its visible Shift.

## Done when

- The properties hold over many seeds and configurations; golden runs unchanged.

## Comments

## Answer
`src/engine/tsp-run.test.ts` (24 tests) runs generated TSP runs through the real run layer and checks what must hold for every configuration; it needed no change to the engine (the permutation operators, the problem and the metrics of tickets 03 to 06 already compose).

- **Every instance × crossover × mutation**: the nine instances (circle, clusters, random, burma14, ulysses16, ulysses22, att48, eil51, berlin52) with OX, PMX and CX and swap, inversion and insertion (81 runs of 5 generations): every individual of every generation, every evaluated individual, every crossover child and every mutated tour is a permutation of the cities; each individual's objective is the tour length and its fitness minus it; the events name the operators that ran, mutation is per individual, and a recombined pair and a mutated individual occur.
- **Reproducibility by seed**: micro-steps, stages, generations and run-until make identical snapshots and events (with the event cache on and off) for each crossover; playback at the slow, medium, fast and maximum tiers makes the identical run (berlin52); the same seed gives the same run and another seed another; the events alone reproduce every population, with 0, 1 and 2 elites, offspring truncation (λ = 14) and no elite.
- **The switches and the usual settings**: crossover and mutation off are recorded bypasses of copies and selection still runs (with both off nothing new appears); pc and pm of 0 and 1; population size, elites, truncation and the odd mating pool as for the other problems; with an elite the best of a generation never gets worse and the best so far is the best ever scored (eil51, all three crossovers, 20 generations); children and mutated tours share no array with their parents (the carried-over elite is, as always, the same individual).
- **Roulette with negative fitness**: the untouched default Identity chain is switched to Shift, recorded in the weight-chain event with the reason "Fitness is negative (lowest: −16123)…", the weights are non-negative and finite, and the run goes on; a chain that names Shift works; a chain that cannot take negative values (Power alone) is refused in words that name the missing Shift step.
- **Stops**: within ε of the optimum: a population holding the optimal tour (a rotation and a reversal of it too) scores exactly the known optimum fitness and reports target-reached, a population without it does not, and a larger ε reaches a tour that many units longer; a six-city circle run reaches the optimum, the stop is reported in exactly the generations where best so far is within ε, and the generation limit and the stagnation window report as for the other problems.
- **Metrics of a run**: in every generation of runs on ulysses16 and att48 the diversity, the distinct routes, the best route and every edge-agreement share equal an independent computation (shares between 0 and 1, no allele frequencies), the same state gives the same metrics object, and a population converged on one route (a rotation and a reversal of it among them) has diversity 0, one distinct route and every agreement 1.

Mutation-checked (9 mutants: the closing edge of a tour, the fitness sign, the permutation branch of the metrics, distinct counting, the shared-pair count, the shuffle branch of initialization, the crossover pass-through, the known optimum and the default ε): each fails a test; the first survived until an assertion was added that the optimal tour scores exactly the known optimum. Golden runs unchanged; `npm run check` clean; the whole unit suite passes.
