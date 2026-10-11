# 23 Rendered review and sign-off

Status: resolved
Type: review (needs instructor)
Blocked by: 19, 21, 22
Spec: ../spec.md

## What to do

Verify the spec's acceptance criteria in a real browser, and get the instructor's sign-off:

- Run the scripted classroom scenario in Playwright: open the textbook preset, step to the end of a generation, scrub back, change a parameter, confirm the notice, and continue.
- Go through acceptance criteria 1–9 in the spec and record the evidence (test names or screenshots) for each in this file under `## Answer`.
- The instructor steps through a full generation in a projector-sized window and reports legibility problems. Any problems found become new tickets.
- Check the layout at 1366×768.
- Update the spec's "To decide during implementation" list with every choice made.

## Done when

All nine criteria have recorded evidence, the instructor has signed off, and any issues found are filed as tickets. Milestone 2 (target string and share-by-link) can then be specified.

## Comments

## Answer

### The scripted classroom scenario

`e2e/classroom.spec.ts` runs the whole scenario in a real browser (Edge) in projector mode at 1920×1080: load the textbook preset (checking 169, 576, 64, 361; Σ 1170 · avg 292.5 · best 576), step into the generation (probabilities 0.144, 0.492, 0.055, 0.309), to the end of the generation, two more generations, scrub back to generation 1 with the history bar, change pm in the drawer, read the notice ("Generations 2–3 will be discarded. The run continues from generation 1 with the new settings."), confirm, continue two generations, and compare every population on screen with the engine's own run (same seed, same change at the same point, and different from the original). It also saves screenshots to `.scratch/milestone-1-goldberg/screenshots/`: `classroom-1-textbook`, `-2-selection`, `-3-end-of-generation`, `-4-notice`, `-5-after-change` (1920×1080, projector mode) and `-6-1366x768`, plus `proj-1920-*` and `proj-1366-*` for the selection, crossover, mutation, replacement stages and the open drawer.

### Acceptance criteria and their evidence

1. **Textbook numbers**: `src/ui/presets.test.ts` "textbook population (the acceptance check)" (engine values), `e2e/presets.spec.ts` "the textbook preset shows the book’s fitness, total, average, best and selection probabilities" (on screen), `e2e/classroom.spec.ts` step 1–2, and `classroom-1-textbook.png`, `classroom-2-selection.png`.
2. **Reproducibility**: `src/run/run.test.ts` "every way of advancing makes the same run"; `src/engine/algorithm.test.ts` "every way of advancing makes the identical run, and regenerated events equal the live ones"; `src/run/playback.test.ts` "playback never changes the results" (all four tiers); `src/ui/session.test.ts` "stepping by micro-step, stage or generation reaches the same populations"; `src/engine/generation.test.ts` determinism and draw-order tests.
3. **Event/result agreement**: `src/engine/algorithm.test.ts` "replaying a generation’s events alone reproduces exactly the population the engine produced" (also with truncation and over many generations); UI models are tested against the same real events (`*-models.test.ts`), and each stage view has a Playwright test against the engine's events (`e2e/selection.spec.ts`, `variation.spec.ts`, `outcome.spec.ts`).
4. **Bypasses**: `src/engine/crossover.test.ts` "with crossover switched off nothing is drawn, and every pair is a recorded bypass of copies", "bypass children are fresh copies…", "when both parents are the same individual, the two children are still separate arrays"; `src/engine/mutation.test.ts` "the mutation switch"; UI: `src/ui/variation-views.test.ts` "with crossover switched off every pair is a labelled bypass…" and "with mutation switched off every offspring is a labelled bypass", `e2e/presets.spec.ts` "the no-crossover preset bypasses every pair".
5. **Probabilities**: `src/engine/crossover.test.ts` "rates over many pairs" and `src/engine/mutation.test.ts` "rates over many offspring" (per-gene and per-individual modes).
6. **Sizes and elitism**: `src/engine/generation.test.ts` "population size and bookkeeping over many generations", "elitism", "offspring truncation" (including "exactly N survive, they are the best…", odd λ); odd mating pool: `src/engine/pairing.test.ts` and `src/ui/variation-models.test.ts` "an odd offspring count: the last pair’s second child is marked as dropped"; discards listed: `src/ui/outcome-views.test.ts`.
7. **Weights**: `src/engine/weights.test.ts` "chain validation", "automatic switch from Identity to Shift", "chains the user built are never rewritten…"; displayed weights and probabilities equal the engine's: `src/ui/selection-models.test.ts`, `e2e/selection.spec.ts` "the weight table shows the engine’s probabilities and intervals"; banner: `src/ui/selection-views.test.ts` "an automatic switch is shown as a labelled notice"; invalid chains in the drawer: `e2e/drawer.spec.ts` "the weight chain editor adds, orders and removes steps and says what is wrong with an invalid chain".
8. **Scrubbing**: `src/ui/session-history.test.ts` ("scrubbing", "changing parameters while looking at the past"), `e2e/history.spec.ts`, `e2e/drawer.spec.ts` "scrubbing back and changing a parameter shows the notice…", and the classroom scenario.
9. **Rendered review**: automated part done: a full generation stepped by keyboard in projector mode, no page overflow at 1920×1080 and 1366×768 with the drawer open, a symbol or label for every colour-coded meaning (audit in ticket 22), and screenshots. **Pending: the instructor's own pass** (below).

### What the instructor needs to do

Run the app from `dist/index.html` (after `npm run build`) or `npm run dev`, switch on projector mode (the A⁺ button), load the Textbook preset from Parameters, and step through a full generation with the keys (→ micro-step, Shift+→ stage, G generation, Space run). Look at the screenshots in `.scratch/milestone-1-goldberg/screenshots/`. Report: anything not legible from the back of a room, anything colour-only, anything confusing in a stage view. Each problem becomes its own ticket; when there are none (or they are filed) the instructor signs off here, and this ticket is resolved.

### Spec's "To decide" list

Brought up to date: key bindings and the symbol set (ticket 22), the plot axes and the parameter-apply behaviour (tickets 18 and 20). The tier timings stay marked "tune after trying it on a projector", which is part of the instructor's pass.

### Instructor sign-off

Signed off by the instructor after their own pass through the app. Problems found during the pass were fixed at once rather than filed: nested scrollbars in the crossover cards, and the speed slider thumb sitting above its track. One addition was requested and built: a toggle (F key and a button) that swaps the diversity and gene-share plots for a plot of the function being optimised, with the population marked on it; it is not remembered between visits, by choice. No open issues remain, so Milestone 2 (target string and share-by-link) can now be specified.
