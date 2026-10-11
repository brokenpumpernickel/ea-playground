# 05 Drawer: the trap section

Status: resolved
Type: task (test-first)
Blocked by: 04
Spec: ../spec.md

## What to build

The drawer's run setup for the trap: block size k, number of blocks m and linkage (tight or loose), with live validation whose messages name the field, a help text that states the trap definition (and its source) and the optimum and attractor scores for the current k and m, staged and applied with "Restart and apply" like the knapsack's instance. Changing the options is a reset and says so.

## Done when

- Unit tests of the draft model (typed text, validation messages naming the field, "changed" detection, reset notice) and Playwright: change each option through the drawer and compare with the engine; an invalid entry disables the restart and names the field; no control without an accessible name with the drawer open.
- Other problems' drawers are unchanged.

## Comments

## Answer

The drawer's run setup now has the trap's section: **Block size k** (`#block-size`), **Number of blocks m** (`#blocks`), **Linkage** (`#linkage`, "Tight: a block’s genes sit side by side" / "Loose: the blocks are interleaved"), and under them the definition box (`data-testid="trap-definition"`).

- **Draft model** (`src/ui/drawer-model.ts`): `Draft.trap` holds the options as typed text; `draftOf`, `optionsOf`, `validate` (fields `blockSize`, `blocks`, `linkage`, `genes`, with the engine's messages; the "too many genes" message is shown under the number-of-blocks field), `changes` (reset names "Block size", "Number of blocks", "Linkage", and "Target fitness" when k × m moves the stop at the optimum, which a custom target is not), `problemOf` (an invalid draft builds nothing: the run's problem stays), `optimumOf` and `followedTargetFitness` all know the trap. The hand-edited population is read against the new number of genes and not blamed while the options are wrong; a crossover type that needs more genes than k × m is named.
- **Help text** (`src/ui/trap-text.ts`): states the rule k / k − 1 − u and its source (Deb and Goldberg's k-bit trap), the worked examples for the current k ("1111 → 4, 0000 → 3, 1000 → 2, 1100 → 1, 1110 → 0"; long blocks keep their first four entries and the last) and, for valid sizes, "The best fitness is 20; all zeros scores 15." The linkage help says which genes block 1 owns.
- Tests: `drawer-trap.test.ts` (13), `trap-text.test.ts` (5), and Playwright `e2e/trap-drawer.spec.ts` (7: the three fields and the definition with the numbers for the current sizes updating live, the other problems' drawers without any of it, a change to blocks and linkage restarting with the notice and the stop moving to 16 and the run equal to the engine's, four invalid entries each marked invalid with its message and the restart refused, no unnamed control with the drawer open, the fields labelled). The visible result was checked in a screenshot at 1920×1080 in projector mode.
- `npm run check` clean; 1333 unit tests and 307 Playwright tests pass.

Noticed, not fixed here (a pre-existing layout limit, belongs to ticket 06): the setup stage's list of individuals for a population of 12 runs under the narration bar.
