# 14 Drawer: alphabet, target and hand-edited strings

Status: open
Type: task
Blocked by: 04, 08, 10
Spec: ../spec.md

## What to build

- For the target string the drawer's run setup shows the alphabet and target fields with live validation and the messages from ticket 08; changing them (like population size and the seed) is staged and applied through "Apply and restart".
- The hand-edited population editor works on strings against the alphabet and length, with a live table of each string's matches and fitness and a message naming the character or chromosome that is wrong.
- Operator parameters, presets and warnings behave as for Goldberg; the link ("Copy link") carries the problem options and a hand-edited string population.

## Done when

- Playwright: invalid targets and alphabets are explained and block the restart; a valid change restarts with the notice naming what is lost; a hand-edited string population starts the run from it, compared with the engine; Copy link then open reproduces the run.
- Unit tests for the drawer model's new fields.

## Comments
