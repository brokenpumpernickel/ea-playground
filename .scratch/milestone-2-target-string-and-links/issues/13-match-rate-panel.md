# 13 Match rate per position, and the per-problem gene panel

Status: resolved
Type: task
Blocked by: 07, 08, 09
Spec: ../spec.md

## What to build

- A **Match rate per position** panel for the target string: for each position, the share of the population having the target's letter there, as bars with printed values and the target letter under each bar. Diversity and the fitness plot work as they are.
- The bottom strip picks its gene panel from the problem's declaration (Goldberg: Share of 1s per gene; target string: Match rate per position); the function plot toggle (F) is offered only to problems with a landscape. The summary line and the hidden metrics table stay.

## Done when

- Unit tests: match rates equal the population's actual matches for hand-made populations; the accessible description names each position.
- Playwright: the displayed rates equal the engine's for a seeded run at several generations; the toggle is absent for the target string; Goldberg's bottom strip is unchanged.

## Comments

## Answer

- **Match rate per position** (`match-rate-model.ts`, `MatchRateStrip.svelte`): for each position of the target, the share of the population with the target's letter there, read from the metrics' per-position symbol counts (so it is exactly the population the rest of the screen shows). Drawn as a bar per position with its percentage and the target's letter under it (a space as `␣`), as in the mock, with a sentence for screen readers ("position 1, H, 42 percent; …").
- **Per-problem panel**: each problem entry declares its `genePanel` (`ones`: Goldberg's "Share of 1s per gene", or `match-rate`) and what its diversity plot says it measures ("mean pairwise Hamming" for Goldberg, "mean pairwise mismatch" for the string problem). The bottom strip chooses accordingly; the summary line and hidden table are shared. The function plot toggle (button and F key) is offered only to a problem with a landscape, so it is absent for the string problem.
- **A bug the new problem exposed**: the metrics panel read the run's problem without depending on the session's version, so after switching problem it kept showing the previous problem's landscape. The session now exposes `problem` as a reactive getter.

Evidence: unit tests (6) compare the rates with hand-counted populations, with counting the matches directly for 30 random populations, with a space and repeated letters in the target, and the extremes (all 100%, all 0%), and check the strip's markup and description; `e2e/match-rate.spec.ts` (5) compares the displayed rates with the engine's at generations 0 to 6 and after scrubbing back, checks the percentages and description, the diversity note, the absent function toggle, Goldberg's strip unchanged, and the panel coming back when switching to Goldberg. All 950 unit tests, `npm run check` and the 106 Playwright tests pass.
