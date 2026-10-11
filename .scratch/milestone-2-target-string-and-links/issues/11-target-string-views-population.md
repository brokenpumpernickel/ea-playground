# 11 Target string views: population, evaluation, replacement

Status: open
Type: task
Blocked by: 01, 08, 09, 10
Spec: ../spec.md

## What to build

Per the mock's chosen design:

- Letter cells in the population table with matching and mismatching positions marked without relying on colour, the matches column ("7 of 11") and fitness, selection weight and probability as before.
- The evaluation view (offspring with matches and fitness) and the replacement view (old population, offspring, next population, elites, truncation discards) with letters and the same match marks.
- The selection views (weight table, wheel, tournaments), mating pool and pairing views work with letters unchanged apart from the cells.
- Descriptions and narration say "matches", not "x".

## Done when

- Playwright against the engine's events for a seeded target-string run: the population table, evaluation rows and replacement lists show exactly the engine's chromosomes, match counts and fitness at every micro-step; a switched-off or truncating configuration still reads correctly.
- Unit tests for the view models with letters (including a space and repeated letters).

## Comments
