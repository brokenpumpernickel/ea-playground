# 08 Accessibility, projector pass, rendered review and sign-off

Status: awaiting the instructor's step-through
Type: task (test-first)
Blocked by: 07
Spec: ../spec.md

## What to build

The pass of earlier milestones on the new controls and views (names, sentences, tables, the colour audit, keyboard only, reduced motion, geometry at both sizes in projector mode and not, the top bar), a scripted classroom scenario `classroom-m9`, screenshots, the published-site check, glossary and spec brought up to date, the acceptance criteria with their evidence, and the instructor's step-through of both mechanisms on the Two peaks landscape.

## Done when

- All criteria have recorded evidence, the published site was checked, the instructor has signed off.

## Comments

Done and verified, awaiting only the instructor's step-through and the published-site check after the push:

- **Accessibility.** `e2e/niching-a11y.spec.ts` (5): the sharing weight table and the tournament and duel tables have named columns and row headers (the first cell of a sharing or duel row became a row header); the draws are a named list with the current draw marked; the ring is `aria-hidden` and has a sentence of its own; the peak readout has a sentence and a named table; every control has a name; keyboard alone (stages, selecting an individual with the arrow keys shows the ring, Escape clears it, crowding stepped to its duels); colour is never the only carrier (duel results are words, ✓ and ✕, kept places say "kept #id", the ring is dashed and labelled "σ = 2"); reduced motion (no transition or animation in the draws, duels, sharing tables and ring). Two mutations (a row header back to a plain cell, the ring no longer hidden) were caught.
- **Rendered review.** Looking at the screenshots found a real problem: with 40 individuals the roulette view's weights table shrank to nothing (also without niching), so the sharing preset hid its niche counts. Chips and mating pool are compact above 16 spins and the table keeps room for its rows (tested at both sizes, projector and not, with and without sharing). At 40 individuals the stage body still scrolls in the roulette and crowding selection views; said in the spec.
- **Scenario and screenshots.** `e2e/classroom-m9.spec.ts`: the sharing preset, niche counts equal to the engine's, the ring, Run until stop at generation 24 with the engine's peak counts, niching switched off for the next generation, the crowding preset, its draws and duels equal to the engine's, Run until stop at 139, the link opened in a fresh page, 1366×768. Nine screenshots in `screenshots/`.
- **Geometry.** The loops of `niching-views.spec.ts` check five setups at both sizes, projector and not, at every micro-step of two generations (no sideways scrolling inside any table, duels not overlapping the next population, narration whole, no page scroll).
- **Glossary and spec.** `CONTEXT.md`: niche, fitness sharing, niche count, shared weight, deterministic crowding, duel, peak occupancy; replacement updated. `spec.md`: the two open decisions recorded and an "As built" section with the measured choices and the known limits.
- **Published site.** `published.spec.ts` gained a test that opens each niching preset's link and compares the summary and the peak counts with the engine (run against the local build: passes; to be run against the deployed site after the push).
- 2,407 unit tests, 1,091 end-to-end tests (57 skipped without their switches) and `npm run check` pass.

## Answer
