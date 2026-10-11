# 19 Rendered review and sign-off

Status: claimed
Type: review (needs instructor)
Blocked by: 15, 16, 17, 18
Spec: ../spec.md

## What to build

Verify the spec's acceptance criteria in a real browser and get the instructor's sign-off:

- Run a scripted classroom scenario in Playwright: copy a link from a configured run, open it in a fresh page, switch to the target string, load a preset, step to the end of a generation, scrub back, change a parameter, confirm the notice, and continue.
- Go through acceptance criteria 1–10 in the spec and record the evidence (test names or screenshots) for each in this file under `## Answer`.
- The instructor steps through a full target-string generation in a projector-sized window and reports legibility problems. Problems found become new tickets (or are fixed on the spot, as in milestone 1).
- Check the layout at 1366×768.
- Update the spec's "To decide during implementation" list with every choice made, and the glossary if any term changed.

## Done when

All ten criteria have recorded evidence, the instructor has signed off, and any issues found are filed as tickets. The next milestone (knapsack) can then be specified.

## Comments

## Answer (so far: everything that does not need you)

**Not done, waiting for you:** ticket 18 (publishing: criterion 10's "a copied link opens correctly on the published site"), your walk through a target-string generation in a projector-sized window, and the sign-off. There is no git remote on this repository yet, so publishing also needs a repository to exist (see my note on ticket 18).

**Scripted classroom scenario (done):** `e2e/classroom-m2.spec.ts` configures a Goldberg run (textbook preset, pm 0.2, one elite), copies its link, opens it in a fresh page and checks the run equals the engine's, switches to the target string through the menu (notice), loads "Mutation too high" from the drawer, steps into the first generation, to the end of crossover and to the end of the generation, runs to generation 4, scrubs back to generation 2, changes the mutation rate (discard notice naming generations 3–4), confirms and continues to generation 5, and compares every population with the engine's run for the same seed and the same change at the same point. Screenshots at 1920×1080 and 1366×768 are in `screenshots/classroom-*`.

**Acceptance criteria, with evidence**

1. *Binary untouched.* `src/engine/golden.test.ts` (21 configurations × seeds 7 and 42, recorded before the engine change, in `src/engine/golden/runs.json`; populations, events and metrics identical): default configuration, the four Goldberg presets, both mutation modes, elites, truncation, tournament, each crossover operator. All milestone 1 tests still pass. The four Goldberg presets' descriptions are asserted in `src/ui/presets.test.ts` ("the other presets behave as their descriptions say") and `e2e/presets.spec.ts`, and `e2e/string-presets.spec.ts` ends with the Goldberg presets unchanged. Goldberg's UI was pixel-compared with the build before the change (ticket 09; identical up to animation noise); the only later changes that touch Goldberg's screens are a sticky column header on the mutation table and a status label ("being made · micro-step n of m") that no longer wraps.
2. *Alphabet mutation.* `src/engine/mutation-alphabet.test.ts`: k = 2 draws nothing extra and records no replacement; for k > 2 the order is all `u`s then one `r` per changed gene (per gene), `u`, gene draw, `r` (per individual); a changed gene never keeps its symbol; "rates and uniformity over many draws" checks the configured rate and uniformity over the other k − 1 symbols within the stated tolerance.
3. *Target string numbers.* `src/engine/target-string.test.ts` "scoring" (hand-worked: all matching, none, repeated letters, a space, case, 24-letter target, 40-symbol alphabet); the known optimum is the target's length ("the problem declares what the optimum is"); "all-zero fitness" switches the chain to Shift and says so.
4. *String operators.* `target-string.test.ts` "the operators on strings": crossover off (recorded bypass, selection still ran), mutation off, a mutated letter always changes, size and elitism invariants, truncation (N − e survive, discards listed), an odd mating pool drops the last child, children share no array. Also `src/ui/string-variation.test.ts` and `e2e/string-variation.spec.ts` for what the screen shows.
5. *Reproducibility and agreement.* `target-string.test.ts` "reproducibility and agreement": micro-steps, stages, generations and run-until make the identical run with regenerated events equal to live ones; replaying events reproduces every population with elites and truncation; and, added now, playback at each of the four tiers makes the identical run.
6. *Share-link round trip.* `src/ui/run-config.test.ts` and `run-config-strings.test.ts`: every preset of both problems (with its own problem and options), extremes, hand-edited string populations, 240 + 200 generated configurations, run equality (populations, events, metrics). `e2e/string-link.spec.ts` opens the link of each of the seven presets in a fresh page and compares three generations with the engine.
7. *Bad links.* `run-config.test.ts` (every kind listed) and `run-config-strings.test.ts` (target letter outside the alphabet, duplicate symbol, too long, option shapes, strings that do not fit, a crossover that does not fit); `e2e/share.spec.ts` and `e2e/string-link.spec.ts` open them in the browser: default Goldberg configuration, one readable message per problem, nothing applied from the bad link, address cleared, never playing.
8. *Problem switching.* `e2e/problem.spec.ts` (notice, cancel changes nothing, the string problem's own defaults and presets, nothing carried back to Goldberg, keyboard) and `src/ui/session-history.test.ts` "switching problem" (including a preset of another problem).
9. *Views.* `e2e/string-views.spec.ts`, `string-variation.spec.ts`, `match-rate.spec.ts`, `string-a11y.spec.ts` (matches by shape, old → new and the replacement draw, names for letters, spaces and marks; match rate equals the engine's at every generation; diversity equals the pairwise definition in `metrics-alphabet.test.ts`). Goldberg's screens: `e2e/match-rate.spec.ts` "Goldberg's bottom strip is as it was" and the milestone 1 view tests, all unchanged.
10. *Hosting and review.* Done: a full target-string generation by keyboard (`string-a11y.spec.ts`), the audit of colour-coded meanings (ticket 17), the layout at 1920×1080 in projector mode and at 1366×768 (no page overflow in any stage, with the drawer and the menu open; screenshots of every stage in `screenshots/`). **Open:** the published site and your sign-off.

**Spec and glossary:** the spec's "To decide during implementation" list is now filled in. `CONTEXT.md` already carries Alphabet, Share link, Preset and Reset; no term changed meaning.

State: 1019 unit tests, `npm run check` clean, 160 Playwright tests passing.
