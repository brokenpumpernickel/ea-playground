# 04 The focus view: state, layout, entering and leaving

Status: open
Type: task (test-first)
Blocked by: 01
Spec: ../spec.md

## What to build

A view setting in the session (like the landscape and map views): which figure is expanded, kept across steps and restarts, reset by another problem, not in links or presets. The layout: the figure replaces the stage panel, the table, the legend line and the three plots; the top bar, the transport, the speed control and the history strip stay; the narration becomes a slim bar under the figure. An Expand button in the map's and the landscape's corner ("Back to the panels" when open), `E` and Esc. A slot for the overlays of the next tickets.

## Done when

- Unit tests of the state; Playwright: enter and leave with the button, `E` and Esc, kept across steps and restarts, reset by another problem, the panels hidden and restored (their hidden tables and sentences still in the page), nothing but the named panels replaced, Run, Step, Stage, Generation, Run to stop and the scrub bar work inside it; the narration inside its box at every micro-step of two generations; geometry at both sizes and in projector mode.

## Comments

## Answer
