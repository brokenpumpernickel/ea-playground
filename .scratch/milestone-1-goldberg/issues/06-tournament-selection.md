# 06 Tournament selection

Status: open
Type: task (test-first)
Blocked by: 04
Spec: ../spec.md

## What to build

Tournament selection as a second selection method behind the same mating-pool interface:

- Tournament size t (default 2), contestants drawn with replacement, best fitness wins.
- Ties go to the lower population index, and each tournament records its contestants, their fitness, the winner, and whether a tie-break decided it.
- The weight-transformation chain is not used; the selection result records that tournament selection compares fitness directly, for the UI to say so.

## Tests (write first)

- A tournament over fixed contestants picks the best; a tie picks the lower index and records it.
- t = 1 behaves like uniform random selection; large t almost always picks the best in the population.
- Same seed gives the same pool; pool size is N − k.

## Comments
