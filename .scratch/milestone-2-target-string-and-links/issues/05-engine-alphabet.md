# 05 Engine: genes as alphabet indices, binary identical

Status: resolved
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

## Answer

- **Representation**: `Gene` is a whole number, a position in the problem's alphabet; `Chromosome` is a readonly array of genes (`Bit` stays exported for the binary code). `binaryAlphabet` is `['0', '1']`; `formatGenes` and `parseGenes` convert with an alphabet (parsing returns nothing for a character outside it); `formatBits` and `parseBits` still work.
- **Problem**: declares `alphabet` and `columns` (header, optional note, and how a value is shown; `fitnessColumn` is the shared one). Goldberg declares the binary alphabet and the columns `x` and `Fitness`, exactly what the tables show today. `Scores.decoded` is `number | string`.
- **Initialization**: random draws index `k − 1 − ⌊u·k⌋` per gene (for k = 2 the original rule, checked draw for draw); explicit populations are validated against the alphabet and the length, with messages that name the chromosome and what is allowed ("may only contain the characters 0 and 1", "a, b and c", or "of the alphabet (27 symbols)").
- **Changes outside the engine are mechanical**: four UI types accept `number | string` for the decoded value (the landscape model converts to a number), and eight test files that build their own tiny problems gained `alphabet` and `columns`. `src/run` and the golden fixtures have no diff.
- **ADR 0004**, "A gene is a position in the problem's alphabet", records the decision, the two options rejected (generic chromosomes, a separate string engine) and its limit (real-valued and permutation representations will need their own).
- Mutation and metrics still assume bits; tickets 06 and 07 generalise them.

Evidence: all 45 golden tests pass unchanged, together with every milestone 1 test (843 existing), plus 13 new tests in `src/engine/alphabet.test.ts` (round trips, the binary rule draw for draw, the index rule at its edges, uniformity over 3, 27 and 40 symbols with a five-sigma tolerance, reproducibility by seed, and the validation messages). `npm run check` (no DOM types in the engine, layer boundaries) and the 93 Playwright tests pass.
