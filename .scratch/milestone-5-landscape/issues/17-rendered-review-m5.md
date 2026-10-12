# 17 Rendered review and sign-off

Status: awaiting instructor sign-off
Type: review (needs instructor)
Blocked by: 16
Spec: ../spec.md

## What to build

Verify the spec's acceptance criteria in a real browser and get the instructor's sign-off: a scripted classroom scenario (copy a link from a configured landscape run, open it in a fresh page, switch the representation through the drawer, load a preset, open the Landscape view, step to the end of crossover and of mutation with the stage marks on, select an individual, scrub back, change a parameter, confirm the notice, continue); the acceptance criteria 1–8 with their evidence recorded under `## Answer`; after pushing to `main`, check that the published site opens a landscape link as the same run (`e2e/published.spec.ts` gains the landscape); update the spec's "To decide" list and the glossary; the instructor steps through a full generation in projector mode (with the extreme cases too) and reports problems, which are filed as tickets or fixed with a test that would have caught them.

## Done when

- All eight criteria have recorded evidence, the published site was checked, the instructor has signed off. The next milestone can then be specified.

## Comments

## Answer

**Scripted scenario** `e2e/classroom-m5.spec.ts`, with 8 screenshots (`classroom-1…8` in `.scratch/milestone-5-landscape/screenshots/`): configure a Himmelblau run with σ 0.08 and two elites, copy its link, open it in a fresh page (the engine's run for two generations); switch to Gray code through the drawer (the notice, the reset operators, the engine's run); load the preset "Himmelblau: four optima" (seed 42); open the Landscape view with trails; step to the end of crossover and then to the end of mutation with the stage marks on (the triangles equal the engine's children, then the mutated children, point by point); select an individual (the same on both views and in the table); finish the generation and two more (summary and positions equal the engine's); scrub back to generation 1; raise the mutation rate (the notice "Generations 2–3 will be discarded…"), confirm, continue to generation 3 (equal to an engine run with the same change at the same point, and different from the unchanged run); and the same screen at 1366×768 with no sideways scroll.

**Published site:** after the push to `main`, the deployment succeeded and `PUBLISHED_URL=https://brokenpumpernickel.github.io/ea-playground/ npx playwright test e2e/published.spec.ts` passes 9 of 9, including three landscape links (Himmelblau real, Rastrigin Gray at 8 bits, two peaks plain at 6 bits, each with a hand-edited population) that open as the same run for four generations and show both views.

### Acceptance criteria

| # | Evidence |
|---|---|
| 1 Existing problems untouched | Golden runs (`golden.test.ts`, `golden/runs.json`) reproduce exactly; all milestone 1–4 unit and Playwright tests pass unchanged except where a list gained the fifth problem or a preset count (five-item menu, ten more presets in the link and config tests); the other four problems' strips, plots and presets are asserted unchanged in `landscape-metrics.spec.ts` and `landscape-presets.spec.ts`. 104 unit-test files, 1889 tests; 572 Playwright tests pass (9 skipped: 6 that were already skipped before this milestone and the 3 published-site landscape tests, which need the live URL and were run separately). |
| 2 Functions and decoding | `real.test.ts`, `landscape.test.ts` (35): hand-worked bit strings in plain and Gray, end points exactly the bounds, even spacing, adjacent Gray words one bit apart, 0111…1 and 1000…0 adjacent with the largest Hamming distance, real and binary-coded fitness equal at the same decoded point, each function's values on hand-worked points, the optima (Himmelblau's four) verified numerically, fitness = f or −f, every individual of every run inside the bounds. |
| 3 Operators | `crossover-real.test.ts` (20), `mutation-real.test.ts` (18): BLX-α inside the widened interval and the bounds, α = 0 inside the parents' box, arithmetic λ·A + (1 − λ)·B and its mirror with λ recorded, Gaussian step = σ × range × z from the two recorded draws, clamping recorded and exact, per-gene and per-individual probabilities and bypasses, discrete operators on real vectors, no shared arrays; the representation's operator rules enforced in the drawer (`drawer-landscape.test.ts`, 28) and in links (`run-config-landscape.test.ts`, 19). |
| 4 Reproducibility and agreement | `landscape-run.test.ts` (22): a seeded run is identical by micro-step, stage, generation, run-until and every playback tier; replaying a generation's events reproduces the population; the operator-view tests and `landscape-operators.spec.ts` compare every displayed number with the event. |
| 5 Views agree with the engine | `landscape-marks.test.ts` (23), `surface-projection.test.ts` (14), `e2e/landscape-marks.spec.ts`, `landscape-heatmap.spec.ts`, `landscape-surface.spec.ts`: marker positions equal the recorded populations (data attributes) on both views, optimum marks equal the known optima, the selected individual is the same in the table and both views, stage marks equal the events at the cursor, trails equal earlier populations, the projection and hidden points are unit-tested, and canvas pixels are read at marker positions. |
| 6 Links and presets | Every preset of all five problems (28) round-trips through its link with run equality (`run-config-strings.test.ts`, `e2e/string-link.spec.ts`); generated landscape configurations (every function and representation, operators with α and σ, hand-edited populations, bad options with their readable messages) in `run-config-landscape.test.ts` and `landscape-drawer.spec.ts`; each landscape preset's text is verified on its seed and over seeds 1 to 100 (`presets-landscape.test.ts`, 25 tests). |
| 7 Accessibility | Ticket 16: the audit table, keyboard-only operation including the surface and marker selection, no unnamed controls, reduced motion, projector mode, no overflow or overlap at both sizes including the landscape view (`landscape-a11y.spec.ts`, 30 tests). The pass found and fixed a real overflow of the mutation cards at 11 and 12 bits. |
| 8 Hosting and review | Published site checked (above). Rendered at 1920×1080 in projector mode: the scenario steps through a full generation with the landscape view open, and the tests step through every micro-step of two generations for six cases including extreme data; the same layout at 1366×768. *Awaiting:* the instructor's own walk through a full generation in projector mode, with the extreme cases, and the sign-off. |

### Things the instructor may want to look at

- At 1366×768 the whole screen is scaled to fit, so the small text under the two pictures (14 px in projector mode before scaling) is the least readable on a small projector; the picture sentence is also in the table and read aloud by a screen reader. It could be shortened or moved if it is too small.
- The header subtitle of the Himmelblau and the two-peaks landscape wraps to two lines at both sizes.
- A trail dot shows its age only by its lightness (the toolbar says how many generations are shown).
- The single peak reaches its optimum in every run, by design (approved in ticket 14).
- The ticket 16 screenshots were taken before the last 1 px change of the text size under the pictures; the classroom screenshots are current.
