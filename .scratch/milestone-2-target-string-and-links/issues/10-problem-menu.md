# 10 Problem registry, problem menu and switching

Status: open
Type: task
Blocked by: 03, 08, 09
Spec: ../spec.md

## What to build

- A problem registry (data): id, name, the options it takes, its default configuration and seed, its per-problem presentation (columns, gene panel kind, whether it has a function plot).
- A "Problem" menu in the top-left brand area ("Goldberg x² ▾") listing the problems. Choosing one goes through the existing restart notice (naming what is lost) and loads that problem's default configuration and seed; cancelling changes nothing. The share-link configuration carries the problem id, and the link codec's problem list comes from the registry.
- Keyboard accessible, with an accessible name, in all themes and projector mode, without breaking the brand area's layout at 1366×768.

## Done when

- Playwright: switch to the target string and back; the notice names what is lost; cancel changes nothing; the defaults of each problem load; the previous problem's configuration is not carried over; the problem menu is operable by keyboard.
- Unit tests for the registry and the codec's use of it.

## Comments
