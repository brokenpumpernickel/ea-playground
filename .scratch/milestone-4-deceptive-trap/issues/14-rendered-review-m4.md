# 14 Rendered review and sign-off

Status: awaiting instructor sign-off
Type: review (needs instructor)
Blocked by: 13
Spec: ../spec.md

## What to build

Verify the spec's acceptance criteria in a real browser and get the instructor's sign-off: a scripted classroom scenario (copy a link from a configured trap run, open it in a fresh page, switch linkage through the drawer, load a preset, step to the end of a generation, track a schema, scrub back, change a parameter, confirm the notice, continue); the acceptance criteria 1–8 with their evidence recorded under `## Answer`; after pushing to `main`, check that the published site opens a trap link as the same run (`e2e/published.spec.ts` gains the trap); update the spec's "To decide" list and the glossary; the instructor steps through a full generation in projector mode (with the extreme case too) and reports problems, which are filed as tickets.

## Done when

- All eight criteria have recorded evidence, the published site was checked, the instructor has signed off, and issues found are filed as tickets. The next milestone (the two-dimensional landscape) can then be specified.

## Comments

## Answer

**Done and recorded below; waiting for the instructor's projector walkthrough and sign-off** (the last line of criterion 8).

### Scripted classroom scenario

`e2e/classroom-m4.spec.ts` (passes; screenshots `classroom-1…8-*.png` in `.scratch/milestone-4-deceptive-trap/screenshots/`): configure a trap run in the drawer (loose linkage, mutation 0.1, one elite) → Copy link → open it in a fresh page and compare with the engine after 0 and 2 generations → through the drawer switch to tight linkage and compare after one generation → load the preset "Loose blocks" (seed 44), compare → step to the end of crossover (blocks split by the cut are marked) and on to the end of generation 1 → two more generations, equal to the engine → open the schema tracker (block 1 solved, read against the engine; looking changes nothing) → scrub back to generation 1 → change the mutation rate, read the notice ("Generations 2–3 will be discarded…"), confirm → two more generations, equal to an engine run with the same change at the same point → the same at 1366×768 without overflow.

### Criteria and evidence (1451 unit tests, 409 Playwright tests, `npm run check` clean)

1. **Existing problems untouched.** `golden.test.ts` and `golden/runs.json` unchanged and passing; all milestone 1–3 tests pass; the registry, menu, run-config and preset-list tests that listed three problems list four; the other problems' tables, panels, plots, links and presets are asserted unchanged in `trap-block-states.spec.ts`, `trap-link.spec.ts`, `trap-presets.spec.ts`.
2. **The trap.** `trap.test.ts` (39): contributions for every u (k = 4) and the shape for k = 2, 3, 5, 8; hand-worked chromosomes tight (20, 15, 16, 10) and loose (the same string scores 6); brute force over all chromosomes for seven small sizes and both linkages (optimum only at all ones, all zeros m × (k − 1), lowest fitness 0); ownership is a partition for every valid size; fitness equals the sum of contributions; the defaults are pinned.
3. **Operators and runs.** `trap-run.test.ts` (25): identical runs by micro-step, stage, generation, run-until and all four playback tiers for tight and loose, events reproduce populations (also with elites and truncation), all three crossover operators and both mutation modes, bypasses, odd pools, shared arrays, the zero-total population (every block 1110) under roulette, stop criteria.
4. **Block marks agree with the engine.** `trap-crossover.test.ts` and `e2e/trap-crossover.spec.ts`: every child and block of generated runs (all operators, both linkages, bypasses) equals what the recorded sources give, and the notes on screen equal the engine's verdicts for every pair; `trap-mutation.test.ts` and `e2e/trap-mutation.spec.ts`: changed and cancelled blocks equal a direct recomputation (both modes, both linkages); `block-states-model.test.ts` and `e2e/trap-block-states.spec.ts`: counts equal a direct count for every recorded generation and on screen each generation.
5. **Schema tracker.** `schema-model.test.ts` (15), `schema-view.test.ts` (6), `e2e/trap-schema.spec.ts` (13): counts and both means equal direct computation over every recorded generation; invalid schemas get a readable message and change nothing; a run with the tracker open is the engine's run; the caveat is on screen.
6. **Links and presets.** `run-config-trap.test.ts` (round trip per linkage, a hand-edited population, ten bad-option cases with the drawer's words, 200 generated configurations round trip and every tenth opens as the same run), `e2e/trap-link.spec.ts` (7 bad links, fresh-page runs), `presets-trap.test.ts` (17: every claim of each preset text on its seed, and the statistics over seeds 1 to 100), `string-link.spec.ts` (every preset's link opens the same run).
7. **Views.** `trap-views.test.ts`, `e2e/trap-views.spec.ts`, `trap-crossover`, `trap-mutation`, `trap-block-states`, `trap-schema` specs: the block row within 1.5 px of the cells for both linkages at 20 and 30 genes, contributions printed, every mark carried by shape and word (the audit table is in ticket 13), the drawer's messages name the field (`e2e/trap-drawer.spec.ts`).
8. **Hosting and review.**
   - Published site: after the push of `bb3c994` the Pages workflow succeeded, and `e2e/published.spec.ts` (run with `PUBLISHED_URL=https://brokenpumpernickel.github.io/ea-playground/`, 6 tests passed) opened a tight and a loose trap link (3 blocks of 5, a hand-edited population, mutation 0.1, one elite) and showed the engine's population at generation 0 and after four generations, with the block-states panel present.
   - Legibility at 1920×1080 in projector mode and at 1366×768: ticket 13's 24 screenshots and the scenario's; no overflow or overlap at any stage, the schema tracker, the drawer or the menu for 4 × 5, 6 × 5 loose (30 genes), one block and ten blocks; the narration stays in its box at every micro-step of two generations.
   - **Instructor sign-off: pending.**

### Spec and glossary

The spec's "To decide" list records the decoded text, loose linkage drawing, marks, size limit (30 genes), defaults, presets and the demonstrable presets. The glossary (Block, Trap function, Deceptive attractor, Linkage, Schema) was written with the spec.

### For the instructor's walkthrough

Open https://brokenpumpernickel.github.io/ea-playground/, choose Trap, switch on Projector mode, load "Loose blocks" and step through one generation with the Micro-step button (the crossover stage shows the blocks split by the cut, the mutation stage the changed blocks), then open "Schema tracker" and "Block states". Also try the largest instance (6 blocks of 5, Parameters → Block size 6). Report anything illegible from the back of the room; issues go in as tickets in this folder.

### Findings from the instructor's first look (fixed, 2026-10-12)

1. **Tournament cards overflowed** ("individual 6" and "fitness 4" ran into each other and out of the card, at both sizes): a 20-gene chromosome does not fit a card in two columns. Tournament and pairing cards are now one per line when the chromosomes are made of blocks, and each contestant's row stays on one line. Not caught earlier because the geometry specs only looked at scrolling regions, not at the rows of the selection and pairing cards.
2. **The badge for a changed block sat tight under the result row** in the mutation cards (touching the flipped gene's shadow): 10 px of room added.

Both are covered by a new test, `e2e/trap-selection.spec.ts` (17): for 4 × 5 tight and loose, 6 × 5 loose and 3 × 10, with tournament and with roulette selection, at both sizes in projector mode, at every micro-step of selection and pairing nothing leaves its card, no two items of a row overlap and no text is broken over several lines; and the gap under the result row is at least 10 px. 425 Playwright tests pass.
