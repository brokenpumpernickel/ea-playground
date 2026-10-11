# 06 Engine: mutation replaces a gene with a different symbol

Status: resolved
Type: task (test-first)
Blocked by: 05
Spec: ../spec.md

## What to build

Mutation for any alphabet, per the spec:

- A mutated gene is replaced by one of the *other* symbols. For an alphabet of exactly 2 symbols the replacement is forced and **no extra draw is made**, so binary is unchanged. For k > 2 each mutated gene costs one extra recorded draw `r`, taken after the draws that decided it; the replacement is the `⌊r·(k−1)⌋`-th other symbol in alphabet order.
- Both modes: per-gene (one draw per gene, then `r` for each gene that flips, in gene order) and per-individual (the individual draw, then the draw that chooses the gene, then `r`). The order is documented and fixed (ADR 0001).
- Events record each replacement draw, the old symbol and the new one, and the existing `flipped` list keeps its meaning (the genes that changed).
- The mutation switch still leaves the chromosome unchanged and records the bypass.

## Done when

- Golden tests unchanged.
- For k = 3 and k = 27: a mutated gene never keeps its symbol; the replacement is the stated symbol for hand-picked draws (including the edges r = 0 and r just below 1, and a gene whose current symbol is the first and the last in the alphabet); draw counts and order are as stated in both modes; copies never share state.
- Rate tests over many offspring: the per-gene and per-individual mutation rates match the configured probability within a stated tolerance, and the replacement symbols are uniform over the other k − 1 symbols.

## Comments

## Answer

`mutate` takes the alphabet size (default 2, so existing callers and every binary run are unchanged; `runGeneration` passes the problem's alphabet size). A changed gene becomes one of the *other* symbols: with 2 symbols the other one, with no draw and nothing extra recorded; with k > 2, one recorded draw `r` per changed gene, picking the `⌊r·(k − 1)⌋`-th other symbol in alphabet order. Draw order is fixed per offspring: per-gene mode draws every `u` first and then one `r` per changed gene in gene order; per-individual mode draws `u`, then the gene-choosing draw, then the replacement `r`; an offspring finishes before the next begins. Events gain `replacements` (gene, `r`, old gene, new gene) only for alphabets of more than 2 symbols, which keeps every binary event identical (the golden events pass unchanged). An alphabet under 2 symbols is refused with a message. The mutation switch still draws nothing.

Tests (`mutation-alphabet.test.ts`, 17): the binary case draws nothing extra and records nothing; hand-picked draws for both modes with the stated order; no replacement without a change; the edges (r = 0 and r just below 1, for genes holding the first, second, second-to-last and last symbol, with 3 and 27 symbols); a changed gene never keeps its symbol or leaves the alphabet (2000 draws, k = 3 and 27); untouched genes and inputs; order across offspring; refusals; and rate tests with five-sigma tolerances (per-gene change rate and uniform replacement over the other k − 1 symbols; per-individual rate, exactly one gene each, spread evenly over the genes; k = 3 and 27). A deliberate mutation of the skip-the-current-symbol rule is caught. All 45 golden tests and every earlier test pass; `npm run check` is clean.
