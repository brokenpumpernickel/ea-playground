# 09 UI: symbol cells and problem-declared columns (Goldberg unchanged)

Status: open
Type: task
Blocked by: 05
Spec: ../spec.md

## What to build

Make the UI independent of "a gene is a bit" while Goldberg looks and reads exactly the same:

- Replace `Bits` with a cell component that takes the alphabet and shows symbols (digits for binary; a space as `␣`), keeping the existing inheritance hatching, cut lines and flip marks, and the accessible description (spelled symbols, which come from parent B, which flipped).
- Replace uses of `formatBits`/`parseBits` in the models, views and descriptions with the alphabet-aware helpers.
- The population table, evaluation view, hand-edited population table and function plot take their columns, headers and decoded display from the problem's declaration.
- No visible change for Goldberg.

## Done when

- All milestone 1 UI unit tests and Playwright tests pass untouched, and the milestone 1 rendered screenshots (`.scratch/milestone-1-goldberg/screenshots/`) are reproduced pixel-for-pixel or with differences reviewed and explained.
- New view tests render the cells with a 27-symbol alphabet and a space.

## Comments
