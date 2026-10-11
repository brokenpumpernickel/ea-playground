# 12 Target string views: crossover and mutation

Status: resolved
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

## Answer

Crossover cards and the mutation view now work on letters, as the accepted mock showed them.

- **Crossover:** the existing cards already took the problem's display, so strings, hatching, cut lines, the bypass label and the dropped odd child came for free. Added the target row above the parents and above the children (`TargetRow` gained `wide` and `cuts`, so its letters sit over the full-size cells and leave the same gap after a cut).
- **Mutation, per gene, more than 2 symbols:** one card per offspring. Each gene has its own draw `u` under it (`Bits` got an `unders` prop); flipped genes keep the ✱ and outline, the draw is outlined too. A result row below shows the final string and, for every changed gene, `✱ gene 3: V → D (r = 0.125)`. Unchanged offspring say so; the target is printed once above the cards and stays in view while they scroll.
- **Mutation, per individual:** the existing table, now with the target above the strings, the sticky header, and the replacement draw in the result label.
- **Mutation off:** the same labelled bypass as for bits.
- **Wording:** the explanation adds "A gene that flips becomes a different symbol: one more draw r picks it from the other 26, in alphabet order." (the number follows the alphabet). The narration quotes `gene 5: O → X (r = 0.868)`. With two symbols nothing changed in wording or layout.
- **Plumbing:** `Display` carries `alphabetSize`; the mutation model has `multiSymbol` and a `changes` list per row (old and new symbol, `r` when recorded).

Checks:
- `string-variation.test.ts`: 12 view tests with k = 27 for both modes, the bypass, two symbols, crossover on letters and the narration. Two deliberate mutations (turning off the draw-under-letter layout; printing `1 − r`) each made the right tests fail.
- `e2e/string-variation.spec.ts`: 11 tests. For seeds 1, 7, 42 and 2024 every displayed draw, flag, replacement draw, old and new symbol and final string equals the engine's events; also a bypass, per-individual mode (with a flip and an unchanged offspring), stepping one offspring at a time with the narration, crossover children and cut geometry, crossover off, and draws lining up under their letters and the target row.
- Rendered at 1920×1080 and looked at all three views; found and fixed overlapping draws (cells too narrow), the target row out of line with full-size cells and with the cut gap, and a header that scrolled away.

State: 970 unit tests, `npm run check` clean, 122 Playwright tests passing.
