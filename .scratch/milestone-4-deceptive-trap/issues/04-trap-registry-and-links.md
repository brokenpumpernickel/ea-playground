# 04 Trap in the registry, the menu and share links

Status: open
Type: task (test-first)
Blocked by: 02
Spec: ../spec.md

## What to build

The trap as a fourth entry of the problem registry (logo `Tr`, name, defaults provisional until ticket 10, empty preset list for now), in the problem menu through the existing restart notice; its options carried by share links and validated by the drawer's rules; a block context (as the knapsack's bag context) that gives views the blocks, their genes and a chromosome's per-block counts and contributions; the brand line ("5 blocks of 4 · tight · optimum 20"); the problem's text for the "Decoded" and "Fitness" columns.

## Done when

- The menu lists Trap and switching to it gives a restart notice and a working run; the other problems' menus, defaults and links are unchanged (their tests pass).
- Generated trap configurations (k, m, linkage, hand-edited populations of the right length) round-trip through a link with run equality; every bad-option case (unknown linkage, k or m out of range, too many genes, wrong types, missing options, population of the wrong length) gives a readable message and applies nothing; the address is cleared as for other problems.
- Playwright: open a trap link in a fresh page and compare with the engine.

## Comments

## Answer
