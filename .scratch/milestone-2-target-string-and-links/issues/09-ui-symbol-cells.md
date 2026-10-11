# 09 UI: symbol cells and problem-declared columns (Goldberg unchanged)

Status: resolved
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

## Answer

The UI no longer assumes a gene is a bit; Goldberg looks and reads exactly as before.

- **`Display`** (`format.ts`): how a problem shows chromosomes (`show`, from its alphabet) and which columns its tables have (`columns`, and `evaluationColumns`, which Goldberg declares as x, Objective, Fitness while its table has x, Fitness). `displayOf(problem)` builds one; `goldbergDisplay` is the default every model uses when not given another, so existing callers and tests are unchanged. The session exposes `display` for the run's problem.
- **Models** (`population`, `selection`, `variation`, `outcome`, and `describer(display)` for the sentences) take a `Display` and use it instead of `formatBits`. Population and evaluation rows carry the problem's column values (`cells`); the evaluation model carries the headers. Sentences say `x = …` only when the decoded value is a number, so a string problem reads "Individual 1 (HELLO): fitness 5".
- **`Bits`** draws symbols: letters in monospace (narrower small cells so long strings fit), a space as `␣`, and a `marks` prop saying which genes are filled and bold (by default every `1`, as before); hatching, cut lines, flip marks and the accessible description are unchanged.
- **Tables**: the population panel, evaluation view and hand-edited population table take their headers and cells from the problem's columns (with an optional note under a header, such as "= matches"); `data-col` is the lower-cased header, so Goldberg's `x`, `objective` and `fitness` attributes are as before. The pairing view prints a decoded value only when it is a number.
- **Hand-edited populations**: `parseChromosomes` uses the alphabet and keeps the binary messages; a new line always separates chromosomes, and a space, comma, semicolon or tab does only when it is not a symbol of the alphabet (so strings containing spaces are typed one per line). The drawer's population count uses the same splitter.

Evidence: all milestone 1 UI unit tests and all 93 Playwright tests pass untouched. A pixel comparison of the app built from the previous commit and from this one, over eight states (end of a generation, selection entered and first spin, crossover, mutation, evaluation, replacement, and the drawer with a hand-edited population), shows 0 differing pixels in five screens and a handful (4–6) in three, the same as two builds of the *previous* code compared with each other (timing noise from the wheel's animation), and 217–277 pixels on the first-spin screen against 225 for the previous code with itself. 12 new tests (`display.test.ts`) cover letter cells (a space as ␣, marks, hatching and flip marks), the population table, crossover and mutation models and the evaluation view over letters, the pairing view, sentences, and the typed-population separators and messages for strings and for binary. Full run: 928 unit tests, `npm run check`, 93 Playwright tests.
