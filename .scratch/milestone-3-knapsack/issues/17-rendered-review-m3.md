# 17 Rendered review and sign-off

Status: awaiting instructor sign-off (second pass after review findings)
Type: review (needs instructor)
Blocked by: 14, 15, 16
Spec: ../spec.md

## What to build

Verify the spec's acceptance criteria in a real browser and get the instructor's sign-off: run a scripted classroom scenario (copy a link from a configured knapsack run, open it in a fresh page, switch handling methods through the drawer, load a preset, step to the end of a generation, scrub back, change a parameter, confirm the notice, continue); go through acceptance criteria 1–9 and record the evidence for each under `## Answer`; the instructor steps through a full knapsack generation in a projector-sized window and reports legibility problems; check the layout at 1366×768; after pushing to `main`, check that the published site opens a knapsack link as the same run; update the spec's "To decide" list and the glossary.

## Done when

- All nine criteria have recorded evidence, the published site was checked, the instructor has signed off, and any issues found are filed as tickets. The next milestone (deceptive trap) can then be specified.

## Comments

## Answer

**Done and recorded below; waiting for the instructor's projector walkthrough and sign-off** (the last line of criterion 9). Nothing else is open.

### Scripted classroom scenario

`e2e/classroom-m3.spec.ts` (passes; screenshots `classroom-1…7-*.png` in `.scratch/milestone-3-knapsack/screenshots/`): configure a penalty run (ρ = 3, mutation 0.1, one elite) in the drawer → Copy link → open it in a fresh page and compare with the engine after 0 and 2 generations → through the drawer switch to each of the four handling methods, restart, one generation, compare with the engine each time → load the preset "Repair: Lamarckian" (seed 19) and compare → micro-step to the end of Evaluation (✂ marks on screen) → end of generation 1 → three more generations → scrub back to generation 2 → raise the mutation rate, read the notice ("Generations 3–4 will be discarded…"), confirm → three more generations, equal to an engine run with the same change at the same point → shrink the window to 1366×768 without overflow.

### Criteria and evidence (1231 unit tests, 277 Playwright tests, `npm run check` clean)

1. **Existing problems untouched.** `src/engine/golden.test.ts` and `golden/runs.json` unchanged since milestone 2 and pass; all milestone 1 and 2 unit and e2e tests pass; the Goldberg and target-string presets list is asserted unchanged in `knapsack-presets.spec.ts`.
2. **Instance numbers.** `knapsack-instance.test.ts` (17 tests): hand-worked bags (empty, full, exactly at capacity, one over), DP optimum 123 = brute force over 4096 bags and over generated small instances, greedy 112 < 123.
3. **Handling methods.** `knapsack-handling.test.ts` (22), `repair.test.ts` (8), `knapsack.test.ts` (15): penalty arithmetic at and one over capacity, decoder skips and still packs later items, repair order and ties, stops as soon as the bag fits, Lamarckian rewrite with before/after in the event, Baldwinian unchanged, property tests that decoder and repairs are always feasible.
4. **Reproducibility and agreement.** `knapsack-run.test.ts` (14): for every method micro-steps = stages = generations = run-until, regenerated events equal live ones, events alone reproduce each population including Lamarckian rewriting; e2e `knapsack-evaluation`, `knapsack-presets`, `classroom-m3` compare screen with engine.
5. **Feasibility metrics and stops.** `feasibility.test.ts` (10) and the "feasibility on real runs" block of `knapsack-run.test.ts`: counts equal a direct count; with ρ = 0 an overweight bag beats the optimum and target-reached never fires; the preset Penalty too small shows best 135 above the line 123 while the feasible line stays at 122.
6. **Operators.** "the operators on bags" in `knapsack-run.test.ts`: bypasses recorded, mutation flips only, size/elites/truncation/odd pool, no shared chromosome arrays, negative fitness switches roulette to Shift and says so.
7. **Links and presets.** `run-config-knapsack.test.ts` (8), `problems-knapsack.test.ts` (5), `presets-knapsack.test.ts` (17; every claim in each preset text including 100–200-seed statistics), e2e `knapsack-link` (12 bad-option messages that apply nothing; round trip per method with hand-edited population; 20 items).
8. **Views.** `knapsack-views`, `knapsack-bars`, `knapsack-evaluation`, `knapsack-panels` (35 unit tests) and their e2e counterparts: item row aligned with gene cells, columns per method, ✓/✗ +n, ✕ dashed, ✂ dotted, chosen-per-item equals the population counts, feasible line equals the metrics; `drawer-knapsack.test.ts` (14): messages name the item or field. Colour-only audit in ticket 16.
9. **Hosting and review.**
   - Published site: after the push of `edbb280`, the Pages workflow succeeded, and `e2e/published.spec.ts` (run with `PUBLISHED_URL=https://brokenpumpernickel.github.io/ea-playground/`, 4 tests passed) opened a 9-item, capacity-30 link for each of the four methods and showed the engine's population at generation 0 and after four generations.
   - Legibility at 1920×1080 in projector mode and at 1366×768: ticket 16's 28 screenshots plus the scenario's; no overflow at any stage, drawer or menu; colour-only audit passed.
   - **New finding fixed in this ticket:** in the Lamarckian and penalty evaluation micro-steps the narration sentence (up to ~150 characters) ran to three lines and spilled out of its 58 px box. A new test steps through every micro-step of two generations for each method at both sizes and failed on exactly those steps; the narration now shrinks in two steps (18/15 px, projector 20/17 px) and the test passes. The longest sentences are therefore smaller than the rest of the narration (about 17 px in projector mode): this is the thing to look at in the walkthrough.
   - **Instructor sign-off: pending.**

### Spec and glossary

The spec's "To decide" list now records the instance, the defaults and preset seeds, and the penalty-too-large outcome. The glossary (Feasible, Packed set) was updated in the earlier tickets.

### For the instructor's walkthrough

Open https://brokenpumpernickel.github.io/ea-playground/, choose Knapsack, switch on Projector mode, and step through one generation with the Micro-step button (especially stages 5 and 6 under Repair (Lamarckian) and Penalty). Report anything illegible from the back of the room, in particular the smaller narration line at the bottom of the stage panel. Issues you find will be filed as tickets in this folder.

### Review findings from the instructor's first look at projector mode (fixed)

Found with penalty ρ = 0, where most bags are far overweight; each was reproduced by a failing Playwright test first (`e2e/knapsack-a11y.spec.ts`, at 1920×1080 and 1366×768) and is fixed:

1. **Mutation cards: the orange draw label ran into the ✱ of the gene below it.** The result row now has 20 px of room above it.
2. **Population table: the weight meter of one row sat 20 px to the right of the others** (the cell was right-aligned, so a shorter text pushed the meter along). The weight column is now left-aligned in header and cells when it has meters, so every meter starts at the same place.
3. **Evaluation: the stacked bar ran past the end of its track and over its caption** when a bag weighed more than 1.5 × the capacity (80 against 48 under ρ = 0). Where overweight bags are allowed (penalty) the bar is now as long as all the items together, so the capacity mark stays in one place and no bag can overrun it; for the other methods it is unchanged, and a segment past the end is cut off rather than drawn outside. (Unit tests in `knapsack-bars.test.ts`.)
4. **Evaluation header: "OFFSPRING" sat on the item / weight / value labels.** The first heading is now top-aligned, above them.
5. Found on the way, same cause (very overweight bags make the figures wider): the Parents table's Fitness column was clipped at 1920×1080 (small meters are now hidden when parent marks and a penalty column are both present; the figures say the same), and with 20 items the evaluation table was 6 px wider than its panel (tighter dense padding, "What happened" heading and text may wrap). A new test plays eight generations and every stage with ρ = 0, for 12 and 20 items, and requires every table to fit its panel.
6. A missing space in "weight 71 of 48· 23 over (hatched)" (same in "repaired from").
7. `app.spec.ts` "stepping by micro-step, by stage and by generation" timed out at 20 s whenever the whole suite ran at once; it is now marked slow (3× timeout). The test itself is unchanged.

Rechecked: `npm run check` clean, 1233 unit tests, 289 Playwright tests, all passing. New screenshots: `1920-15-fix-mutation-cards.png`, `1920-16-fix-penalty-meters.png`, `1920-17-fix-penalty-stacked-bar.png`.
