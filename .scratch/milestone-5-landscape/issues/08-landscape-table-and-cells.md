# 08 The population table and chromosome cells of the landscape

Status: open
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
