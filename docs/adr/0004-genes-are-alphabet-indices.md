# A gene is a position in the problem's alphabet

A chromosome is a readonly array of whole numbers, each the position of a symbol in the problem's **alphabet**, and the problem declares the alphabet. The binary problems use the alphabet `0, 1`, so a binary chromosome is exactly what it always was. Selection, pairing, crossover, elitism, replacement, the weight chain and the whole run layer treat genes as opaque and did not change; only the places that create or alter a gene (initialization, mutation) and the places that show one (formatting, parsing, the views) know about alphabets. Random initialization draws index `k − 1 − ⌊u·k⌋` for k symbols, which for k = 2 is the original rule (a gene is 1 when its draw is below 0.5), so every seeded binary run is unchanged; golden-run fixtures recorded before the change guard this.

## Considered Options

- **Generic chromosomes** (a type parameter for the gene, threaded through every engine file): rejected. The operators never look inside a gene, so the parameter would spread through the whole engine for no behaviour.
- **A separate string engine beside the binary one**: rejected. It would duplicate the stage logic that ADR 0003 deliberately shares, and every later fix would have to be made twice.

## Consequences

Real-valued and permutation representations (the 2-D landscape, TSP) do not fit "a position in an alphabet" and will need their own representation and operators; this decision covers only symbol strings. A gene stored as an index is not readable on its own, so anything that shows a chromosome must go through the problem's alphabet.
