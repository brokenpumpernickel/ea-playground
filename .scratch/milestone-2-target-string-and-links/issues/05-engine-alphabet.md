# 05 Engine: genes as alphabet indices, binary identical

Status: open
Type: task (test-first)
Blocked by: 02
Spec: ../spec.md

## What to build

Generalise the engine's gene from a bit to a position in the problem's **alphabet**, changing only what assumed a bit (`chromosome.ts`, `problem.ts`, `initialize.ts`, `goldberg.ts`, the places that import `Bit`). Crossover, pairing, selection, weights, elitism, truncation, replacement, stop criteria and the whole `src/run` layer must not need any change.

- A `Problem` declares its alphabet (ordered symbols) and how a gene is shown. Binary is the alphabet `0, 1`. `Chromosome` stays a readonly array, now of gene indices; `formatBits`/`parseBits` become alphabet-aware formatting and parsing (keep the binary helpers working).
- `Scores.decoded` becomes `number | string`. A `Problem` declares the table columns and headers it shows (Goldberg: `x`, fitness), alongside the optional `landscape`.
- Random initialization draws one number per gene; the symbol index is `k − 1 − ⌊u·k⌋`, which for k = 2 is exactly today's rule.
- Explicit initialization validates against the alphabet and the length, naming the character or chromosome that is wrong.
- Write ADR 0004, "Genes are alphabet indices" (hard to reverse, surprising without context, a real trade-off against generic chromosomes and a separate string engine), recording why.

## Done when

- All of ticket 02's golden tests pass unchanged, and all milestone 1 tests pass apart from mechanical type renames.
- `npm run check` passes (the engine still has no DOM types, and the layer boundaries hold); `src/run` has no diff.
- New tests: an alphabet of 3, 27 and 40 symbols initialises uniformly (rate test), explicit initialization rejects a symbol outside the alphabet with a clear message, and k = 2 reproduces the old initialization draw for draw.

## Comments
