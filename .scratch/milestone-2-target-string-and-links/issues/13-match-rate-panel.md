# 13 Match rate per position, and the per-problem gene panel

Status: open
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
