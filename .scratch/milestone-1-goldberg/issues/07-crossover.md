# 07 Crossover

Status: open
Type: task (test-first)
Blocked by: 04
Spec: ../spec.md

## What to build

The crossover stage over the pairs from pairing:

- Operators: one-point, two-point, uniform. Cut points and the uniform mask are drawn up front and recorded, along with which parent each child gene came from.
- Probability applies per pair: one recorded draw (random number and threshold) per pair.
- A crossover switch. When it is off, and when a pair fails its draw, the pair is recorded as a bypass and the children are independent copies of the parents.
- An odd pool's dropped child (from 04) is recorded as discarded.

## Tests (write first)

- Each operator on fixed parents and fixed cut points or masks gives the hand-computed children and inheritance map.
- Bypass: with the switch off, children equal the parents, are distinct objects, and mutating a child does not change the parent or the other child. The selection stage still ran.
- A pair failing its draw is a recorded bypass, not a missing event.
- Over many seeded draws the observed fraction of recombined pairs matches pc within a tolerance.
- pc = 0 and pc = 1 behave as always-bypass and never-bypass.

## Comments
