# 04 Trap in the registry, the menu and share links

Status: resolved
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

Trap is the fourth problem of the registry and works end to end through the menu and share links.

- **Registry** (`src/ui/problems.ts`): entry `trap` (name Trap, logo `Tr`, gene panel `blocks`), `ProblemOptions` gains `TrapOptions`, `isTrapOptions`; default options 5 blocks of 4, tight (a fresh copy each time); subtitle "5 blocks of 4 · tight · optimum 20"; `validateOptions` gives the shape messages ("options.blockSize must be a number", unknown and missing keys) and then the engine's field messages; `validateOptionFields` groups them for the drawer. **Provisional defaults** (`trapDefaults` in `src/engine/trap.ts`: population 12, tournament 2, one-point 0.8, per-gene 0.05, no elites, limit 100, target 20, stagnation window 50) until ticket 10 measures them and the instructor approves.
- **Block context** (`src/ui/block-context.ts`, set in `App.svelte`, `session.blocks`): blocks, their genes, optimum, all-zeros score and `outcomeOf`; absent for the other problems. `session.bag` previously recognised a knapsack by having `outcomeOf` and `options`, which the trap also has, so it now requires the options to have `items`.
- `optimumOf` in the drawer model knows the trap's optimum. The drawer has no trap section yet (ticket 05); applying anything else in the drawer keeps the running trap and its options (tested).
- Tests: `problems-trap.test.ts` (7), `run-config-trap.test.ts` (round trip per linkage, a hand-edited population, readable link text, ten bad-option cases with the engine's messages, 200 generated configurations round trip and every tenth opens as the same run), `session-trap.test.ts` (3), and Playwright `e2e/trap-link.spec.ts` (11: menu with Trap fourth and the restart notice, a switched run equal to the engine's after 3 generations, a configured link per linkage opening as the same run with a hand-edited population, seven bad links each with its message and the address cleared, a restart from the drawer that keeps the trap's options). The registry, run-config and problem-menu tests that listed three problems now list four.
- `npm run check` clean; 1315 unit tests and 299 Playwright tests pass (the previous milestone's two load-dependent tests did not flake this run).
