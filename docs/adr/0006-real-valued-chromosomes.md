# A problem's representation is symbols or real values; the landscape offers both

Status: proposed with the milestone 5 spec (the instructor asked for real-valued genes with BLX-α and arithmetic crossover, and to be able to choose a binary-coded landscape as well); accepted when ticket 02 of milestone 5 is built.

A problem, as configured, declares exactly one **representation**: *symbols* (ADR 0004: genes are positions in an alphabet) or *real* (every gene is a finite number between a lower and an upper **bound** that the problem declares for that gene). The two-dimensional landscape can be configured with either: a **binary-coded** landscape is a symbol problem (alphabet `0, 1`, 2·n genes) whose `evaluate` decodes the bits of each variable, in plain binary or Gray code, onto the bounds; a **real-valued** landscape is a real problem. Which of the two a landscape is belongs to its options, so changing it is a reset, and the operators on offer follow the representation (the real-only operators are refused for a symbol problem and the symbol-only mutation for a real one, with a readable message). A real chromosome is still a `readonly number[]`, so selection, pairing, the weight chain, elitism, replacement, the history, the playback tiers and the run layer treat it as opaque and do not change. The places that create, alter, compare or show a gene are representation-specific:

- **Initialization** draws every gene uniformly inside its bounds (one draw each, in gene order).
- **Crossover.** One-point, two-point and uniform crossover (discrete recombination: each child gene is a copy of a parent's gene) work on both representations unchanged. Two operators exist only for real genes: **BLX-α** (each child gene is drawn uniformly from the parents' interval widened by α times its length on each side) and **whole arithmetic crossover** (the children are λ·A + (1 − λ)·B and (1 − λ)·A + λ·B with one λ per pair).
- **Mutation.** Flipping or replacing a symbol is for symbols only. For real genes the operator is **Gaussian**: a gene chosen to mutate gets a normal step with a standard deviation of σ times the gene's range. The per-gene and per-individual probability semantics, and the bypass, are the same as for symbols.
- **Boundary handling** is explicit and recorded: a value that leaves its bounds (BLX-α and Gaussian steps can) is **clamped** to the bound, and the event says which genes were clamped. Arithmetic crossover cannot leave the bounds of its parents.
- **Showing a gene** is by value to a stated precision (three decimals in tables, full precision in the data); a real gene is never shown through an alphabet. The formatting, parsing (hand-edited populations: numbers separated by spaces), the run-configuration codec and the views know the representation.
- **Randomness.** A normal draw uses two uniform draws (Box–Muller) in a documented order and never caches one for later, so a run's draws do not depend on how it is advanced. Every draw an operator makes is recorded in its event, as for the symbol operators.

Existing symbol runs are unchanged: the golden-run fixtures recorded before this decision must reproduce exactly.

## Considered Options

- **Only a binary-coded landscape** (each variable n bits mapped onto its bounds): reuses every operator and teaches coding, but the course needs BLX-α and arithmetic crossover visible in a run. **Only real-valued genes**: loses the comparison of what the representation does to the same points. The instructor chose to offer both.
- **Generic chromosomes** (a type parameter for the gene, threaded through the engine): rejected again, as in ADR 0004. The shared stages never look inside a gene.
- **A separate real-valued engine beside the symbol one**: rejected. It would duplicate the stage logic that ADR 0003 deliberately shares.

## Consequences

The permutation representation for TSP will need its own entry beside symbols and real. Anything that compares chromosomes for equality (the diversity measures, distinct counts, replay tests) compares numbers exactly, which is meaningful because operators are deterministic functions of recorded draws; displayed values are rounded, stored values are not. Links carry the numbers as JSON doubles, which round-trip exactly. A real problem has no alphabet, so the places that read `problem.alphabet` (metrics' allele counts, the allele strip, parsing, the target string's views) must ask for the representation first.
