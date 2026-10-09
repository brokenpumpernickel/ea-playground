# 15 Selection and pairing views

Status: open
Type: task
Blocked by: 14, 05, 06
Spec: ../spec.md

## What to build

The selection stage view, matching the approved mock:

- Roulette: the weight-transformation table with one column per chain step (`raw fitness → … → weight → probability`), a wheel whose slices are the probabilities, and each spin animated to the recorded random number and result. The auto-switch-to-Shift banner appears when the engine reports it.
- Tournament: brackets showing contestants, their fitness, the winner, and the tie-break when one decided it. A note that tournament selection ignores the weight chain.
- The mating pool and the pairs, with each individual's selection count visible in the population table (parent marker with a symbol and label, not colour alone).
- Animation follows the playback tier and reduced-motion setting and never obscures what actually happened.

## Done when

- Stepping micro-step by micro-step shows each spin or tournament and its recorded outcome, and the pool shown equals the engine's pool.
- A Playwright test compares the displayed pool and probabilities with the engine's for a seeded run.

## Comments
