# A problem's representation may be a permutation of cities

Status: accepted (milestone 6, ticket 03: the engine holds a permutation problem; the operators follow in tickets 04 and 05).

A problem, as configured, declares exactly one **representation**: *symbols* (ADR 0004), *real* (ADR 0006) or now *permutation*: the chromosome has n genes, each a city, and every city appears exactly once. The TSP is the first and, for now, only permutation problem.

- **Genes** are city indices 0 to n − 1 (the symbol problems' "position in an alphabet" with the extra rule that no gene repeats); on screen they are numbered 1 to n, as in TSPLIB. The problem declares `permutation: true` and its `alphabet` is empty, as for a real problem; a gene is never shown through an alphabet.
- **Initialization** is a Fisher–Yates shuffle of 0 … n − 1: n − 1 uniform draws in a documented order, each recorded.
- **Crossover.** Only **order crossover (OX)**, **partial-mapped crossover (PMX)** and **cycle crossover (CX)** exist for a permutation; one-point, two-point, uniform, BLX-α and arithmetic crossover are refused (they would repeat and lose cities). Cut points are integers drawn as `floor(u · k)` in a documented order and recorded with the slices, the mapping chains and the cycles, so a view never recomputes what an operator did.
- **Mutation.** **Swap**, **inversion** and **insertion** exist for a permutation; flip and Gaussian are refused. The probability is **per individual**: one draw u against pm decides whether the individual is mutated, then the positions are drawn (recorded). "Per gene" has no meaning for a permutation and is not offered.
- **Identity.** Two chromosomes that are rotations or reversals of each other are the same route. Chromosome equality stays exact (a rotation is a different array, as OX and PMX are defined on arrays), but metrics that count *distinct* individuals and the diversity measure use the **canonical route** (starting at city 1, in the direction whose second city is the lower) and the undirected edge set.
- **Scores.** The objective is the closed tour length under the instance's distance rule; fitness is −length, so selection, the weight chain, elitism and the plots work unchanged on the fitness numbers, with the existing Shift for negative fitness in roulette selection.
- **Randomness and reproducibility** are as before: every draw is recorded in its event; nothing is cached between draws; a seeded run is the same run however it is advanced.

Existing symbol and real runs are unchanged: the golden-run fixtures recorded before this decision must reproduce exactly.

## Considered Options

- **Cities as the symbols of an alphabet with a validity constraint and repair** (apply one-point crossover, then repair duplicates): rejected as the representation. It would hide the operators the course teaches (OX, PMX, CX exist precisely because naive recombination breaks a permutation), and a repair step is a property of the problem's constraint (ADR 0005), not a substitute for an operator. It remains available later as a teaching contrast.
- **Random-key encoding** (a real vector sorted into a tour, so that the real operators apply): rejected. It makes crossover and mutation trivially safe and hides the permutation entirely; students will implement permutation operators.
- **Generic chromosomes** (a type parameter for the gene): rejected again, as in ADRs 0004 and 0006. The shared stages never look inside a gene.
- **Fixing city 1 as the start** so that rotations cannot occur: rejected. It changes the operators' definitions (cut points inside n − 1 genes) away from the textbook ones; the canonical route gives the same clarity where it matters, in the counts.

## Consequences

Anything that compares chromosomes for equality compares arrays exactly; the distinct counts and the diversity of a permutation problem are the exceptions and say so. The metrics gain a representation-specific branch (edge-based diversity and the edge-agreement panel), as the landscape's gained decoded-space measures. A TSP chromosome of up to 52 genes is longer than any before it, so the table and the operator cards need a long-chromosome layout, settled in the milestone's mock.
