# 13 TSP defaults by measurement

Status: open
Type: measurement, review (needs instructor approval)
Blocked by: 07
Spec: ../spec.md

## What to build

Measure, over at least 20 seeds (more where it matters), candidate defaults for each instance and size class: population size, selection and tournament size, crossover operator and probability, mutation operator and pm, elitism, the generation limit, ε and the stagnation window. Goal: the small instances (burma14, ulysses16, ulysses22, circle, clusters, random) usually reach the optimum or come within a few per cent, berlin52 and att48 show how far a plain GA stays from it (the gap is the lesson), the stagnation window does not pause a run that is still moving, and the effects of OX against PMX against CX, swap against inversion against insertion and of elitism are measured. Report the numbers and a proposal to the instructor; set the defaults only after approval. Measurement scripts are not kept.

## Done when

- The measurements are recorded in this file, a proposal is approved by the instructor and set in the registry (defaults may depend on the instance's size), with a test that pins the defaults.

## Comments

## Answer
