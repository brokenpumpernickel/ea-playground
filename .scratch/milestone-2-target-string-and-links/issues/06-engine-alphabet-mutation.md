# 06 Engine: mutation replaces a gene with a different symbol

Status: open
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
