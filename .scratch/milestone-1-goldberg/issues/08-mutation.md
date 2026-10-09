# 08 Mutation

Status: open
Type: task (test-first)
Blocked by: 03
Spec: ../spec.md

## What to build

Bit-flip mutation as a stage over a list of chromosomes (offspring in the generation loop), in two explicit modes:

- **Per-gene**: one recorded draw per gene.
- **Per-individual**: one recorded draw per individual decides whether it is mutated; if so, the operator then chooses which genes flip (a defined rule, recorded).
- A mutation switch. When off, every chromosome is unchanged and the bypass is recorded.
- Every draw is recorded with its random number and threshold, and each mutated individual records its changed gene positions.

## Tests (write first)

- With fixed random values, the flipped genes are exactly the hand-computed ones in both modes.
- Switch off leaves all chromosomes equal and records the bypass.
- pm = 0 never mutates and pm = 1 flips every gene (per-gene mode).
- Over many seeded draws the observed rate matches pm within a tolerance, in both modes.
- Mutation returns new chromosomes and never edits the input in place.

## Comments
