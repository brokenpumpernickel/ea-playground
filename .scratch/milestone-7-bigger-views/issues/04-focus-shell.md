# 04 The focus view: state, layout, entering and leaving

Status: resolved
Type: task (test-first)
Blocked by: 01 (resolved)
Spec: ../spec.md

## What to build

A view setting in the session (like the landscape and map views): which figure is expanded, kept across steps and restarts, reset by another problem, not in links or presets. The layout: the figure replaces the stage panel, the table, the legend line and the three plots; the top bar, the transport, the speed control and the history strip stay; the narration becomes a slim bar under the figure. An Expand button in the map's and the landscape's corner ("Back to the panels" when open), `E` and Esc. A slot for the overlays of the next tickets.

## Done when

- Unit tests of the state; Playwright: enter and leave with the button, `E` and Esc, kept across steps and restarts, reset by another problem, the panels hidden and restored (their hidden tables and sentences still in the page), nothing but the named panels replaced, Run, Step, Stage, Generation, Run to stop and the scrub bar work inside it; the narration inside its box at every micro-step of two generations; geometry at both sizes and in projector mode.

## Comments

## Answer

## Answer

**State** (`src/ui/focus-view.svelte.ts`, unit-tested in `focus-view.test.ts`): a `FocusView` made by the app and shared by context: `wanted` (asked for), `available` (the stage panel says a figure, the route map or the landscape, is on show) and `active` (both); `enter` only works while a figure is on show, `toggle`, `leave`, `reset`. It is a view setting: kept across steps and restarts, started over when the problem changes (the stage panel watches the problem's id), not in a link or a preset. The area is one constant, `focusArea` = 24, 172, 1872 × 830 (the union of the stage panel, the table, the legend line and the plots).

**Keys:** `E` (a new shortcut, `shortcuts.ts`, ignored in fields and dialogs and with modifiers like `G` and `F`, labelled `E`) toggles; **Esc** leaves (the drawer's Esc closes the drawer first, as ever). **Buttons:** an **Expand** button (`data-testid="focus-toggle"`, `aria-keyshortcuts="E"`, "Back to the panels" when open) at the right end of the map's toolbar and of the landscape's.

**Layout:** the stage panel takes the whole area (`data-focus="true"`, the heading kept for the screen reader but visually hidden, the tab buttons away, the narration its slim 58 px bar at the bottom); the population panel, the legend and the plots are `display: none` under `.canvas.focused`, so they stay in the page with their tables, plots and sentences and keep following the run; the top bar, transport, speed control and history strip are untouched. The route map picture is 1530 × 560 instead of 740 × 292 (the figures table beside it as before); its zoomed part stays the same part of the picture when the size changes. This is the shell: tickets 05 and 06 turn the toolbar and the figures into overlays, give the map the whole body and draw the small fitness graph; the landscape's two figures are still at their ordinary size in the bigger panel until ticket 06.

**Tests** (`e2e/focus-shell.spec.ts`, 19 tests): the button in both views with its key; nothing to expand in the stage view and E does nothing; entering with the button and with E, leaving with the button, E and Esc, the panel's box equal to the focus area (and back to 1096 × 574), every other panel hidden and restored; the top bar, transport, speed, history and narration stay and the narration is directly under the map, inside the panel; the hidden panels still in the page (table rows, fitness plot, headings that keep up with generations); kept across steps and a restart and the toggles and the zoomed part kept in and out; another problem starts it over (TSP to landscape and back; landscape to TSP); Micro-step, Stage, Generation, Run (the map's sentence changes generation after generation), Pause, the history strip (Home, End) and Run to stop inside it; E ignored in a select and Esc closing the drawer before leaving; the landscape expanded and given back; geometry for 16 and 52 cities at both sizes in projector mode and not (every control, the stats, key and sentences inside the panel, no dot or number outside the picture, the narration inside its box and clear of the sentences at every third micro-step of two generations). Mutations (panels left visible, no reset on another problem, no Esc) each fail a test. 2,241 unit tests, 923 end-to-end tests (43 skipped without their switches) and `npm run check` pass.

**Also:** `Reset` button locators in the older specs address it with `exact: true` (done in ticket 03).
