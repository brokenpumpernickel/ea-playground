# 14 Presets with verified seeds

Status: open
Type: task (test-first)
Blocked by: 12, 13
Spec: ../spec.md

## What to build

The five presets of the spec (Evolve a bag, Penalty too small, Penalty too large, Repair: Lamarckian, Repair: Baldwinian), found by search and each verified by a test that asserts exactly what its text says. Penalty too large is dropped, or its text reduced to what a verified seed shows, if no seed demonstrates it. The Lamarckian and Baldwinian presets share instance, seed and parameters, and state only measured differences. Presets carry the instance and the handling as options; the preset menu shows the running problem's presets.

## Done when

- A test per preset asserts its claims for its seed (the cheating bag under a too-small ρ and the reference line exceeded; the run settling on a poor feasible bag; the stated difference between the repairs).
- Playwright: loading each preset through the menu shows its description and behaves as stated; the other problems' presets are unchanged. Adding a preset is still only a new file.

## Comments
