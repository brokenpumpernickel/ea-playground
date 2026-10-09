# 20 Parameter drawer, pending parameters, hand-edited population

Status: open
Type: task
Blocked by: 14, 05, 06, 10
Spec: ../spec.md

## What to build

The collapsible parameter drawer (collapsed by default for projection) with plain-language help for every control:

- Population size and initialization (seeded random, textbook preset, hand-edited), and the seed with a "new seed" button.
- Selection method (roulette, tournament with size), the weight-transformation chain editor (an ordered list with add, remove, and move up/down buttons, each step's parameters, validator messages shown), and a note that tournament ignores the chain.
- Crossover type, probability, and an on/off switch; mutation type, mode (per-gene or per-individual), probability, and an on/off switch. Each states what its probability applies to and when the draw is made.
- Elite count (with equivalent proportion), offspring truncation on/off with λ.
- Stop criteria: generation limit, target reached, stagnation window.
- Pending parameters shown as pending until the next generation boundary; changes that require a reset are marked, and applying them starts a reset after a confirmation that names what will be lost.
- Hand-edited initial population: type chromosomes with validation (length, alphabet) and live display of decoded x and fitness.
- Warnings when the population or generation limits are exceeded.

## Done when

- Every control changes the engine's configuration through the run layer, with pending/reset semantics matching ticket 12.
- Invalid chains and hand-edited chromosomes show readable messages.
- A Playwright test changes pc mid-generation, checks it shows as pending, and checks it applies at the boundary.

## Comments
