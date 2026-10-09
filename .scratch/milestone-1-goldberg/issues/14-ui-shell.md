# 14 UI shell: ribbon, transport, population table

Status: resolved
Type: task
Blocked by: 01, 12, 13
Spec: ../spec.md

## What to build

The first end-to-end demoable slice, wired to the real engine (Svelte, `src/ui`), following the approved mock:

- The page layout: top ribbon, main area, bottom strip, collapsed drawer placeholder.
- Stage ribbon showing the six stages, the current one highlighted, and the generation number.
- Transport: next micro-step, next stage, next generation, run, pause, run until, tier slider, reset, new seed. The cursor supports all three stepping granularities even though only the generic stage placeholder view exists so far.
- Population table with chromosome, decoded x, objective value, fitness, selection weight and probability side by side, as real table markup.
- A generic stage panel that lists the current stage's events as text, to be replaced stage by stage by tickets 15–17.
- Starts on the default Goldberg configuration (N = 6, one-point crossover, pc = 0.8, per-gene pm = 0.05, no elites, roulette with Identity).

## Done when

- A person can open the app, press "next generation" repeatedly, and watch the population table change; stepping by stage and micro-step moves through the same run.
- A Playwright test steps a seeded run and checks the table against the engine's population.

## Answer

Done (design and test seams agreed with the instructor beforehand). 565 unit tests and 13 Playwright tests pass; `npm run check` and `npm run build` are clean. The app opens as a single `dist/index.html` and works from disk.

What it is: the real engine on screen, in the chosen **Studio** design with the **stage-first layout**, built as a 1920×1080 canvas scaled to fit the window (so 1366×768 scales as one unit, per ticket 01). Verified by screenshots in light and dark and at 1366×768 as well as by tests.

Logic, tested first (`src/ui`, Vitest):

- `describe.ts`: `describeEvent` gives a plain sentence for every event kind (setup, weights incl. the automatic switch, probabilities, spins, tournaments with tie-break, pairs, crossover recombine/bypass/off with cuts or mask and the dropped child, per-gene and per-individual mutation, evaluation, replacement with elites and discards), checked against real engine events from the mock's scripted generation; `stageTitle`.
- `population.ts`: `populationTable(view, atCycleEnd)` builds the table rows from the run view, and `atCycleEnd(layout, position)`. **Refinement agreed with the instructor:** inside a generation the table shows the parents ("Parents · generation c−1") with weights, probabilities and parent counts as selection is revealed; once the generation is complete it shows the new population ("Population · generation c") with ★ on elites. Cycle 0 is the initial population.
- `session.svelte.ts`: `createSession({ scheduler, seed?, reducedMotion?, drawSeed? })` wires the run and playback into Svelte runes. Every action bumps a `version` that the getters read, so components re-read. Getters: `view`, `atCycleEnd`, `table`, `metrics` (of the population the table shows), `seed`, `lastCycle`, `status`, `tier`, `slider`, `animate`. Actions: `stepMicro`, `backMicro`, `stepStage`, `stepGeneration`, `play`, `pause`, `toggle`, `setSlider`, `setReducedMotion`, `runUntilStop`, `reset` (same seed, reproduces the run), `newSeed` (fresh seed from `crypto`). A manual step, reset or new seed pauses playback first.
- `config.ts`: the default Goldberg configuration (N = 6, one-point 0.8, per-gene 0.05, no elites, roulette with Identity, limit 50, target 961, stagnation 10) and seed 42.

Screens (`src/ui`, Svelte): `App` (scaling, theme, reduced motion, browser scheduler), `TopBar` (brand, stage ribbon, generation badge), `Transport`, `StagePanel` (the generic list of events as sentences, latest highlighted, plus the narration bar), `PopulationPanel` (a real `<table>` with column headers; each chromosome is one image for screen readers with its bit string in `data-bits`), `MetricsPanel`, `HistoryStrip`, `Bits`. Styling is `app.css`: the mock's base styles plus the tokenised Studio theme (light and dark).

Transport: Reset, Back, Micro-step, Stage, Generation, Run/Pause, Run until stop, a playback-speed slider with Slow/Medium/Fast/Max, the seed with New seed, a status line (Playing / Paused / paused by stop criterion with its name / error message), and a Light/Dark toggle (remembered in local storage, guarded). The reduced-motion preference is passed to playback. No keyboard-hint badges, since bindings belong to ticket 22.

Verified in the browser (`e2e/app.spec.ts`, compared with the engine's own population for the same seed): the seeded initial population; Generation pressed three times matches the engine each time; micro-steps, stages and generations reach the identical screen at generation 2; parent counts and weights appear as selection is revealed; the stage panel and narration; Run, Pause (frozen) and Reset (same start); New seed changes seed and population; Run until stop; Parameters and Projector are disabled; the dark theme; no scrolling at 1366×768.

Notes for later tickets:

- **Placeholders to replace:** the stage panel's event list is replaced stage by stage by tickets 15–17 (keep the narration bar and the `view`/`atCycleEnd` inputs); `MetricsPanel` (tiles and a text line of allele shares) is replaced by the plots in ticket 18; `HistoryStrip` (text only) by the scrub bar in ticket 19 (design: a window around the cursor plus an overview strip); the disabled Parameters and Projector buttons by tickets 20 and 22.
- The offspring panel from the mock is not built yet (tickets 16–17 own what offspring look like at each micro-step); its screen area is free in the right column once the population panel is shortened.
- The slider is a native range input (accessible, accent-coloured); restyle it to the mock's stops in ticket 22 if wanted.
- `src/ui/app.css` reuses the mock's IDs (`#top`, `#transport`, `#narr`, …) and class names, so later views can copy markup from `mock/studio.html` directly.
- The Playwright timeouts are now 20 s per test and 5 s per expectation, so a failing run is quick.
- `e2e/shell.spec.ts` was updated for the real heading; it still checks that opening the build from disk makes no network requests.

Process note: the three logic modules were built test-first; the components were verified by the Playwright tests (written first and seen failing against the placeholder app) and by screenshots. Two of my own test mistakes were fixed (a position that does not exist with two elites; the stage label needed its own element to be found), neither in the logic.

## Comments
