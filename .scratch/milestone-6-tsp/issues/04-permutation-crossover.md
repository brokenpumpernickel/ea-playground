# 04 Order, partial-mapped and cycle crossover

Status: open
Type: task (test-first)
Blocked by: 03
Spec: ../spec.md

## What to build

The three permutation crossovers as engine operators with their events (ADR 0007): **OX** (two cut points drawn as `floor(u·k)` in a documented order and recorded; child 1 keeps A's slice in place and fills the other positions, starting after the second cut and wrapping, with B's remaining cities in B's order from after the second cut; child 2 swaps the roles; the slice and the fill order recorded), **PMX** (two cuts; child 1 takes B's slice in place and keeps A's city elsewhere unless it is already in the slice, then follows the mapping chain to a free city; the mapping and each chain recorded), **CX** (no cut; the cycles of positions found and recorded; alternate cycles from A and from B). One probability per pair, drawn as for the other problems; a failed draw is a bypass with copies; probabilities 0 and 1; the symbol and real operators are refused for a permutation problem and the permutation operators for the others, with a readable message.

## Done when

- Hand-worked cases for each operator (including the textbook examples of 8 to 9 cities) and property tests over generated parents: every child is a permutation; OX keeps the slice in place and the remaining cities in the other parent's order; PMX keeps the other parent's slice in place, every other city stays where its parent had it unless it conflicts, and every chain ends on a free city; CX copies each position from the parent of its cycle, alternating, and a single-cycle pair gives copies of the parents.
- Equal cuts, cuts at the ends and n = 3 work; no two individuals share an array; draws are reproducible by seed and recorded in the events.

## Comments

## Answer
