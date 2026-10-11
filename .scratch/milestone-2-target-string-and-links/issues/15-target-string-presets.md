# 15 Target string presets with verified seeds

Status: open
Type: task (test-first)
Blocked by: 08, 10
Spec: ../spec.md

## What to build

- Preset files gain a `problem` field (and the four Goldberg presets are given `"problem": "goldberg"`); the preset menu shows only the current problem's presets, and choosing a preset of another problem switches the problem through the restart notice.
- Three target string presets, as plain data files:
  1. **Evolve a word**: the defaults, converging.
  2. **No mutation**: a seed where a letter missing from the initial population can never appear, so the run stalls short of the target.
  3. **Mutation too high**: a seed where the population never settles. Describe it as failing only if a verified seed fails; otherwise claim only what the seed shows.
- Seeds are found by search and each description is verified by a test, as in milestone 1's ticket 21.

## Done when

- A test per preset asserts exactly what its description says for its seed (for example, no mutation: the missing letter's match rate stays 0 for the whole run and the best fitness stalls at a stated value).
- Playwright: loading each preset through the menu shows its description and behaves as stated; the Goldberg presets are unchanged.
- Adding a preset is still only a new file.

## Comments
