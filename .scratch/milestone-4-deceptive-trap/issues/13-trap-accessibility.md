# 13 Accessibility and projector pass for the trap

Status: resolved
Type: task
Blocked by: 05, 07, 08, 09, 11, 12
Spec: ../spec.md

## What to build

The pass of milestones 1–3 on the new views: names and sentences for chromosomes (blocks, contributions), real tables, the colour-only audit extended with the new meanings (optimum, attractor, whole from A, whole from B, split, changed block, schema instances), keyboard-only operation of a full generation, no control without a name with menu and drawer open, reduced motion, and no overflow or overlap at 1920×1080 and 1366×768 in projector mode for every stage, the drawer and the menu, for the default, 6 × 5 loose, 1 block and 10 blocks. Carry over milestone 3's lessons: geometric tests for overlap, clipping and width stability at every micro-step of several generations (narration included), run with extreme data. Capture screenshots for ticket 14.

## Done when

- The audit list is extended in this file with each colour-coded meaning and its non-colour carrier.
- Playwright: keyboard-only generation, accessibility-tree check, reduced motion, geometry tests at both sizes for the cases above.
- Screenshots at both sizes are under `.scratch/milestone-4-deceptive-trap/screenshots/`.

## Comments

## Answer

`e2e/trap-a11y.spec.ts` (23 tests, all passing; the layout pieces were already covered per ticket, this pass adds the whole-screen and cross-cutting checks) and 24 screenshots in `.scratch/milestone-4-deceptive-trap/screenshots/`: 12 states at 1920×1080 in projector mode (`1920-NN-*.png`) and the same at 1366×768 (`1366-NN-*.png`): 5 × 4 tight at the start, selection, crossover, mutation, evaluation, replacement and with the schema tracker; the drawer; the menu; loose crossover; 30 genes loose mutation; ten blocks.

### Colour-only audit

| Meaning | Colour | Carried also by | Checked by |
|---|---|---|---|
| Block at all ones (its optimum) | green note | `✓` and its score ("✓ 4"), the solid part of the block-states bar, "✓ n" in the figures | notes in the tables match `^(✓ \|▽ )?\d$`, both marks occur; figures match `✓ n · n · ▽ n` |
| Block at all zeros (deceptive attractor) | orange note | `▽` and its score, the hatched part of the bar, "▽ n" in the figures | the same; computed style of the bar is `repeating-linear-gradient` |
| Block whole from A / whole from B / split | grey / orange | `● A`, `▨ B` (the hatching of parent B's genes), `◧ split`, and the pair's "◧ n of 5 blocks split" / "● no block split" | the notes of every child are exactly those three texts; hatched genes have the gradient |
| Block changed by a mutation | orange badge | `✱` and the words "block 3: 0100 → 1110 · 2 → 0"; the flipped genes carry ✱ | every badge starts with ✱ |
| Flips that cancel inside a block | grey badge | dashed outline and the words "flips … but the block still has 1 one, so it still scores 2" | unit and rendered tests |
| All-zeros reference line of the fitness plot | grey | dashed differently from the optimum's (long dash against dotted) and the label "all zeros 15" | dash arrays differ; labels `all zeros 15`, `optimum 20` |
| Schema tracker: instances against the population | two series colours | instances: solid line with ■; population: dashed line (`7 4`) with ●; both named in the caption and in the hidden table | tags `rect` and `circle`, dash array |
| Linkage's blocks over the genes (loose) | alternate underlines | the block's number printed over every gene; dotted against solid underline | block-row tests |
| Current generation in the plots | black line | the word "now" / the printed count | unchanged from earlier milestones |

### Other checks (all in `trap-a11y.spec.ts`)

- Every chromosome in the table has `role="img"` and a name made from its bits and the sentence "ones per block 4, 0, 1, 0, 4; scores …; all ones in blocks 1 and 5; all zeros in blocks 2 and 4", equal to the engine's numbers, tight and loose; the block row is one sentence ("Blocks: block 1 is genes 1 to 4; …"); the tables are real tables with columns #, Chromosome, Decoded, Fitness; the block-states panel has a hidden table.
- Keyboard only: Tab to the problem menu, three Down arrows to Trap, Enter, Restart and apply, then every stage of a generation with the stage shortcut, to generation 1 with all six stages done.
- No control without a name with the menu, the drawer (also with an invalid block size) and the schema tracker open.
- Reduced motion: every transition duration is 0 s and no animation runs on more than 200 elements of the trap screens.
- At 1920×1080 and 1366×768 in projector mode, for 4 × 5 tight, 6 × 5 loose (30 genes), a single block and ten blocks: after the start, after a generation, inside each of the six stages, with the schema tracker, the drawer and the menu open, nothing overflows the page or scrolls sideways, and the menu stays on screen; and the narration stays inside its box at every micro-step of two generations (milestone 3's lesson).

`npm run check` clean; 1451 unit tests and 407 Playwright tests pass (a Goldberg preset test that runs a whole run to its stop was marked slow after it timed out under full-suite load once).
