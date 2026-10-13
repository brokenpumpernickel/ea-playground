# 04 Order, partial-mapped and cycle crossover

Status: resolved
Type: task (test-first)
Blocked by: 03
Spec: ../spec.md

## What to build

The three permutation crossovers as engine operators with their events (ADR 0007): **OX** (two cut points drawn as `floor(u·k)` in a documented order and recorded; child 1 keeps A's slice in place and fills the other positions, starting after the second cut and wrapping, with B's remaining cities in B's order from after the second cut; child 2 swaps the roles; the slice and the fill order recorded), **PMX** (two cuts; child 1 takes B's slice in place and keeps A's city elsewhere unless it is already in the slice, then follows the mapping chain to a free city; the mapping and each chain recorded), **CX** (no cut; the cycles of positions found and recorded; alternate cycles from A and from B). One probability per pair, drawn as for the other problems; a failed draw is a bypass with copies; probabilities 0 and 1; the symbol and real operators are refused for a permutation problem and the permutation operators for the others, with a readable message.

## Done when

- Hand-worked cases for each operator (including the textbook examples of 8 to 9 cities) and property tests over generated parents: every child is a permutation; OX keeps the slice in place and the remaining cities in the other parent's order; PMX keeps the other parent's slice in place, every other city stays where its parent had it unless it conflicts, and every chain ends on a free city; CX copies each position from the parent of its cycle, alternating, and a single-cycle pair gives copies of the parents.
- Cuts are drawn as two-point crossover draws them (two different gaps between genes, never at the ends, so the slice has 1 to n − 2 cities), which makes equal cuts and cuts at the ends impossible rather than special cases; n = 3 works; no two individuals share an array; draws are reproducible by seed and recorded in the events.

## Comments

## Answer
Order (`ox`), partial-mapped (`pmx`) and cycle (`cx`) crossover are `CrossoverOperator`s beside the others, with `permutationOperators`, and `crossover(…, bounds, permutation)` takes the problem's representation (`generation.ts` passes `problem.permutation`). Built test-first in `src/engine/crossover-permutation.test.ts` (19 tests):

- **Worked by hand on the textbook parents** (Eiben and Smith: 1 2 3 4 5 6 7 8 9 and 9 3 7 8 2 6 5 1 4, cuts after genes 3 and 7): OX gives 3 8 2 4 5 6 7 1 9 and 3 4 7 8 2 6 5 9 1; PMX gives 1 7 3 8 2 6 5 4 9 and 9 3 2 4 5 6 7 1 8; CX gives 1 3 7 4 2 6 5 8 9 and 9 2 3 8 5 6 7 1 4, with the cycles [1 9 4 8], [2 3 7 5], [6] — the published children.
- **Draws**: the pair's u first, then for OX and PMX two draws for the cuts (the first among the n − 1 gaps between genes, the second among the others, as two-point crossover does, so the slice has 1 to n − 2 cities); CX draws nothing more. A failed draw is a bypass with copies and no further draws; a switched-off crossover draws nothing; probability 0 and 1; an odd number of offspring drops the last second child.
- **Events** carry what the views will print: `cuts`; for OX `fill` (per child, the cities taken from the other parent in order and the positions they went to); for PMX `mapping` (per child, the cities taken and displaced in slice order, and every conflict with its chain of cities and the free city used); for CX `cycles` (positions per cycle in the order found); and the children's `sources`.
- **Properties** over generated parents (n = 3, 4, 5, 9, 20, 52; 25 seeds each): every child is a permutation; OX keeps the slice in place and the other cities in the other parent's order read from after the second cut; PMX keeps the donor's slice in place, every other city stays where its parent had it unless it conflicts, and every chain stays inside the slice until its last, free, city; CX copies each position from the parent of its cycle, alternating from A, the cycles partition the positions and each holds the same cities in A and in B; a single-cycle pair and identical parents give copies; no arrays are shared with the parents, between children or with the events; over 300 pairs of five cities every pair of gaps occurs as cuts.
- **Refusals in words**: the symbol and real operators for a permutation problem ("… would repeat and lose cities; choose order, partial-mapped or cycle crossover for this problem") and the permutation operators for the others ("… is for permutation chromosomes; choose … crossover"); OX and PMX need 3 cities, CX 1.

Mutation-checked (12 mutants): the cut draws, the fill's start and order, the sources, the mapping direction, the chain loop, the cycle alternation and walk, the refusals and the minimum size each fail a test, except two. Starting the OX position list inside the slice instead of at its end gives the same positions (an equivalent mutant), and the pass-through of `problem.permutation` in `generation.ts` is not covered by a test yet because a whole permutation generation needs the permutation mutations; ticket 05 adds a one-generation test. Golden runs unchanged; `npm run check` clean; the whole unit suite passes.
