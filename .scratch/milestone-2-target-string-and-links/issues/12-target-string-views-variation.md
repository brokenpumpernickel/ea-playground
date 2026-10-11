# 12 Target string views: crossover and mutation

Status: open
Type: task
Blocked by: 01, 06, 09
Spec: ../spec.md

## What to build

- Crossover cards on letters: inheritance hatching and cut lines, bypass labelled, odd pool's dropped child, as for bits.
- The mutation view: per-gene draws and per-individual mode as before, with a flipped gene shown as `old → new` (for example `L → Q`), marked with ✱ and its outline, and, for alphabets of more than 2 symbols, the replacement draw `r` and which of the other symbols it picked. Mutation off remains a labelled bypass.
- The explanation lines say what the probability applies to and when the draw is made, and for letters say that a mutated gene becomes a different symbol.

## Done when

- Playwright against the engine's events for several seeded runs (including a bypass and a flip): every displayed draw, replacement draw, old and new symbol and final chromosome equals the engine's.
- View tests for both mutation modes with k = 27.

## Comments
