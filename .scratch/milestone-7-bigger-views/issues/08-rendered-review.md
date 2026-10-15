# 08 Rendered review and sign-off

Status: resolved (instructor sign-off pending)
Type: review (needs instructor)
Blocked by: 07
Spec: ../spec.md

## What to build

Verify the acceptance criteria in a real browser: a scripted classroom scenario `classroom-m7` (open a TSP run, toggle the numbers, zoom with the wheel, expand, Run with the focus view open, leave, expand the landscape and zoom it), the criteria with their evidence under `## Answer`, the published site after the push, the spec and glossary up to date, and the instructor's step-through in projector mode.

## Done when

- All criteria have evidence, the published site was checked, the instructor has signed off.

## Comments

Status note: everything is built, pushed and checked on the published site; **the instructor's step-through in projector mode (the map and a landscape) is what is left**, and the sign-off.

## Answer

State at the time of writing: 2,264 unit tests and 1,021 end-to-end tests pass (55 end-to-end tests are skipped without their switches: the screenshots with `SHOTS=1`, the published-site checks with `PUBLISHED_URL`, a few classroom scenarios); `npm run check` is clean.

### The scripted classroom scenario

`e2e/classroom-m7.spec.ts` (screenshots with `SHOTS=1` into `.scratch/milestone-7-bigger-views/screenshots/classroom-*.png`): a berlin52 run for five generations in the ordinary panels, equal to the engine → the Route map with its City numbers switched off (52 dots, no number) and on → the wheel zooms into the middle (zoom above 2, the numbers at 18 px, the note in the corner) → **E**: the map takes the whole centre, with the same part of the picture at the same zoom, the population panel out of sight but in the page and at generation 5, the card at generation 5, Reset view → **Run** at Fast with the focus view open until the graph is at generation 12: the generation's summary equals the engine's, the card's best equals the engine's, the graph's name equals the hidden full plot's → one step with the stage marks, **Esc**: the panels are back at the same generation → the landscape from its link, 8 generations, trails of 3, **E**, the wheel on the heatmap (the region smaller than the whole) and on the surface (camera closer): every mark drawn is an engine individual at its decoded point and at the pixel its point has in the zoomed region, the graph's best equals the engine's, Reset view returns the whole domain, Esc. A second test repeats the map part at 1366 × 768 in projector mode with no scrolling.

### The seven acceptance criteria and their evidence

1. **Nothing else changes.** Every unit and end-to-end test of milestones 1 to 6 passes unchanged (the three places where they needed a change: the Reset-button locator got `exact: true` because "Reset view" now also matches by substring; the toolbar's gap note moved under the figures because three new buttons made the toolbar wrap; and `FitnessPlot` takes its sentence from the shared `fitnessSummary`, which is tested to read as before); the golden runs are untouched (no engine change in the milestone); the other problems' screens are unchanged (their e2e suites, the link and preset suites over all problems).
2. **City numbers.** `tsp-numbers.spec.ts` (8): on by default, one beside every dot; off: none, every dot, the sentence and name unchanged; kept through steps, stages, the other tab, a restart and the focus view; started over by another problem; keyboard; toolbar geometry. Zoomed in, `tsp-zoom.spec.ts` checks the numbers stay at 18 px and inside the picture. **A finding on the way:** the 13/11/9 px that milestone 6's code computed for the numbers had never been what was drawn (the page's `svg text` rule of 18 px overrides the attribute), so the numbers were always 18 px; the spec and ticket 02 say so, the size is set as drawn, and the placement rule now works from it.
3. **Zoom and pan.** `map-zoom.test.ts` (19, pure) and `tsp-zoom.spec.ts` (25): the point under the pointer is kept (as an exact scaling of the page about the pointer position the page saw), limits 1× and 40×, a drag moves the picture and stops with the picture's edges at the window's, double-click, buttons and keys, marks keep their sizes, kept through steps, play, scrub, the other tab and a restart, started over by another instance, the name and sentence say the zoom, no marker or number outside the picture at any zoom at both sizes, reduced motion. A found-by-test defect: text selection cancelled the second drag in a row (`user-select: none`).
4. **Focus view.** `focus-shell.spec.ts` (19), `focus-map.spec.ts` (22), `focus-a11y.spec.ts` (59): it replaces exactly the named panels (the population panel, legend and plots are `display: none` and stay in the page with their tables and sentences, still following the run); the top bar, transport, speed, history and narration stay; Esc, `E` and the button leave; kept across steps and restarts, started over by another problem; the figures card and the graph equal the metrics at every generation; every overlay inside the body and clear of each other and of the narration at both sizes and in projector mode, at every micro-step of two generations (the narration whole).
5. **Landscape.** `focus-landscape.spec.ts` (15), `heat-zoom.test.ts`, `surface-zoom.test.ts`: the figures about twice the area; the marks, selection and trails are the engine's on both; the wheel and drag on the heatmap compose with Zoom to population; the surface's wheel zoom (1× to 4×); Reset view returns everything; the card and the graph equal the metrics.
6. **Real time and accessibility.** Run, Step, Stage, Generation, Run to stop and the history strip work inside it (`focus-shell`); during Run the picture changes at every generation, the graph and the table agree in every drawn frame (`focus-map`, `focus-landscape`); Run at its fastest with 52 cities, 60 individuals and the population's edges on drew 60 generations in 0.5 s with a worst frame gap of 112 ms (bounds asserted: under 1 s and a 95th percentile under 250 ms); names, keyboard only, reduced motion, the colour audit with the contrast of the overlays (ticket 07's list); no overflow or overlap at both sizes, projector and not.
7. **Hosting and review.** After the push of the milestone, `e2e/published.spec.ts` was run against https://brokenpumpernickel.github.io/ea-playground/ : **15 of 15 pass**, among them the two new checks (the map expanded with E, zoomed with the wheel, stepped with `g`, left with Esc; the landscape expanded, the heatmap and the surface zoomed, Reset view). The deployments of every ticket of the milestone succeeded. The instructor's step-through: pending.

### The rest of this ticket

- The spec's "To decide" list is a "Decided" list (the overlay places, `E`, the hideable graph); the glossary has the **focus view**.
- Screenshots for the step-through: `.scratch/milestone-7-bigger-views/screenshots/` (`m7-01` to `m7-10`, and the `classroom-*` ones when written with `SHOTS=1`).
