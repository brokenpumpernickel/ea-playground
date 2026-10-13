# 07 TSP run properties

Status: open
Type: task (test-first)
Blocked by: 04, 05, 06
Spec: ../spec.md

## What to build

Property tests over generated TSP runs (every instance kind, every crossover, every mutation, probabilities 0 and 1, elites, truncation): every individual of every generation is a permutation; a seeded run is identical by micro-step, stage, generation, run-until and every playback tier; replaying a generation's events reproduces its population; the stop within ε of the optimum and the generation limit and the stagnation window behave as for the other problems; the roulette weight chain accepts the negative fitness with its visible Shift.

## Done when

- The properties hold over many seeds and configurations; golden runs unchanged.

## Comments

## Answer
