# 14 Landscape defaults by measurement

Status: open
Type: measurement, review (needs instructor approval)
Blocked by: 06
Spec: ../spec.md

## What to build

Measure, over at least 20 seeds (more where it matters), candidate defaults for each function and representation: population size, selection and tournament size, crossover operator and probability, α, σ, mutation probability, bits per variable, elitism, the generation limit, ε and the stagnation window. Goal (spec): the default function finds its optimum in most but not all runs, the harder functions show the deceptive behaviour (two peaks: premature convergence on the broad hill; Rastrigin: local minima; Himmelblau: clustering), and the stagnation window does not pause a run that is still moving. Also measure what changes with α = 0, arithmetic against BLX-α, σ too small, plain binary against Gray. Report the numbers and a proposal to the instructor; set the defaults only after approval. Measurement scripts are not kept.

## Done when

- The measurements are recorded in this file, a proposal is approved by the instructor and set in the registry, with a test that pins the defaults.

## Comments

## Answer
