# 08 The population table and chromosome cells of the landscape

Status: resolved
Type: task (test-first)
Blocked by: 01, 07
Spec: ../spec.md

## What to build

As decided in the mock: for the real-valued representation the chromosome cell shows the pair "(2.134, −0.871)" with an accessible name and sentence; for the binary-coded ones the bits grouped by variable with a variable row above (like the trap's block row) and the decoded x and y columns; the columns x, y, the objective f for minimised functions with the rule "fitness = −f" in the header note, and Fitness; the same cells in the parents, evaluation and replacement tables; widths that do not depend on the numbers (fixed-width numeric columns, negative numbers included).

## Done when

- Unit tests of the cell models and the server-rendered views against the engine's numbers; geometric tests at 1920×1080 and 1366×768 that no table is wider than its panel and columns keep their widths from generation to generation, for 10 and 12 bits per variable and the real pair, with negative numbers; names and sentences checked.
- The other problems' tables are unchanged.

## Comments

## Answer
The landscape's population table, chromosome cells and the other tables that show them (parents, evaluation, replacement) follow the mock, in all three representations.

- **Context and cells**: `landscape-context.ts` (what a view knows about the running landscape, set once in `App.svelte` from the new `session.landscape`) and `landscape-cells.ts` (pure: the pair from the shown text, the geometry of the bit groups, the sentences, the variable row labels, the visible columns). `Bits.svelte` draws, with a landscape in the context, a real chromosome as the pair "(−2.698, −1.768)" with each number in a column of fixed width (6.2 characters, so the width does not depend on digits or sign) and a binary-coded one as two groups of bits (the x bits, a gap, the y bits, a bracket over each) with 17 px cells up to 10 bits per variable and 14 px above; a mutated gene is marked on its number (✱) or its bit, genes from parent B are hatched, cuts and flips are said, a half-typed or wrong-length text falls back to the old drawing; with no landscape nothing changes. The name for a screen reader says the numbers ("Chromosome x = −2.698, y = −1.768") or the groups and what they decode to ("Chromosome x bits 1111, y bits 0000, decodes to x = 5.000, y = −5.000").
- **Variable row** (`VariableRow.svelte`, as the trap's block row): over the bits a label per group ("x · 10 bits", "y · 10 bits") as wide as the group, with one sentence for screen readers ("Variables: the first 10 bits are x and the next 10 are y; each is read as a whole number in plain binary and scaled onto −5 to 5."); for the pair a note "(x, y)". It sits in the population, evaluation and replacement headers.
- **Columns**: a real-valued problem has no x and y columns (the pair is the chromosome), only f(x, y) for minimised functions (with "fitness = −f" under Fitness) and Fitness; binary-coded: x, y, Fitness, and f(x, y) up to 6 bits per variable; with roulette weights beside them only Fitness stays (the decoded numbers are in the evaluation view). All numbers in columns are shown to three decimals with a real minus sign and never "−0.000"; the narration sentences round to three decimals and drop trailing zeros; the table's Σ, average and best use the same rounding (`num`), which leaves the other problems' integers unchanged.
- **Widths that do not depend on the numbers**: each numeric column has its own width in CSS, wider than any number it holds (x and y 82 px, Fitness 92, f(x, y) 100, the # column 100 so the parent marks do not move it); the replacement rows give the label a fixed width and let the badges wrap, and a real pair uses two columns there as the long bit strings do.
- **Also changed on the way**: the representation moved out of the brand subtitle (which wrapped onto a second line) into a chip beside the problem name, with its words in the registry (`chip`); the subtitles are now "Single peak · maximise f · optimum 1".
- **Tests**: `landscape-cells.test.ts` (14: the context, pair parsing, geometry, labels and sentences, which columns show), `landscape-views.test.ts` (13, server-rendered: pair, grouped bits, marks, sentences, fallbacks, no landscape, the variable row), the columns and sentences in `landscape.test.ts`, and `e2e/landscape-table.spec.ts` (15 geometry cases and 3 more): at 1920×1080 and 1366×768 in projector mode, for the real pair (single peak, Himmelblau with f(x, y)), plain binary with 10 bits, Gray code with 12 bits (Rastrigin), plain binary with 6 bits (Himmelblau) and Gray with 4 bits, starting from extreme data (both bounds, zero, mixed signs, all zeros and ones, alternating bits), through the population, selection, evaluation and replacement views of two generations: no table or heading wider than its panel, the population columns keep their widths from step to step (within 1.5 px), the variable labels line up with the groups, and the rows are the engine's. Names and sentences, the columns shown and "the other problems have none of it" are asserted. Mutation-checked (real columns, roulette columns, pair parsing, grouping, number marks): each fails tests.
- **Found on the way** (fixed): raw 17-digit fitness in the replacement rows and in the evaluation sentences, `showOld` treating a pair as a short symbol string, and the first geometry runs showing the table 40–70 px too wide for the bit versions.

Not in this ticket (ticket 13 has them): the metrics panel's summary line still prints unrounded fitness and the allele panel is still the "share of 1s" one.

Golden runs unchanged; `npm run check` clean; 92 unit-test files / 1719 tests pass; the whole end-to-end suite (449 tests) passes.
