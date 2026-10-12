# 05 The landscape problem: functions, optima, both representations

Status: resolved
Type: task (test-first)
Blocked by: 02
Spec: ../spec.md

## What to build

The landscape as an engine `Problem` built from options `{function, representation, bitsPerVariable}`: the four functions (single peak, two peaks, Rastrigin, Himmelblau) with their bounds, objective and fitness (f for the maximised ones, −f for the minimised ones), the known optimum fitness and the optimum point(s) (found analytically where possible, otherwise by a fine grid search with local refinement asserted by tests); the **binary-coded** representation (2·n bits, alphabet `0, 1`, n from 4 to 12, plain binary or Gray decoding onto the bounds: lo + (hi − lo)·v / (2ⁿ − 1)) and the **real-valued** one; validation of the options in words per field; scores (decoded text "(x, y)", objective, fitness) and columns; a way for the views to ask for the decoded point of any chromosome and the fitness at any point (for the heatmap and surface).

## Done when

- Values on hand-worked points for each function; the optima verified numerically; bounds as stated; fitness = f or −f as stated.
- Decoding: the end points map to the bounds exactly, consecutive integers to evenly spaced values; adjacent Gray words differ in one bit and decode to adjacent values; plain-binary 0111…1 and 1000…0 decode to adjacent values with the largest Hamming distance; real and binary-coded problems give the same fitness at the same decoded point.
- Validation messages name the field; defaults are valid; golden runs unchanged; `npm run check` clean.

## Comments

## Answer
`src/engine/landscape.ts` (tests: `landscape.test.ts`, 39). `landscapeProblem({function, representation, bitsPerVariable})` builds a `LandscapeProblem`; `Scores` gained an optional `values` (the decoded numbers, here `[x, y]`) so views place an individual without parsing text.

- **Functions** (`landscapeFunctionInfo`): name, formula, goal, the shared bounds of both variables, the optimum point(s) and f. Single peak and two peaks are maximised, Rastrigin and Himmelblau minimised with fitness `0 − f` (so a zero is never −0). Optima: single peak (2, −1); two peaks at x = y = 2.999892804 (the narrow hill's top, shifted from (3, 3) by the broad hill's tail, found by shrinking-grid refinement and checked against a fine grid, value 1.0003118); Rastrigin (0, 0); Himmelblau's four minima solved by Newton to double precision (the six-decimal values in the spec are truncations; tests compare to five decimals). `knownOptimumFitness` is the fitness at the first optimum.
- **Representations**: real = two genes with `bounds`, empty alphabet; binary-coded = 2·n bits (x first), alphabet 0/1, no bounds, decoded by `decodeVariable` as lo + (hi − lo)·v/(2ⁿ − 1) with v from plain binary or the standard reflected Gray code (`integerOfBits`); the upper bound is returned exactly.
- **For the views**: `pointOf(chromosome)`, `fitnessAt(x, y)`, `objectiveAt(x, y)`, `info`; scores carry the text "(2.000, −1.000)", `values`, the objective and the fitness; columns x, y, [f(x, y) for minimised only], Fitness (with the note "= −f" for minimised); `scoreText` and `evaluationExplanation` say "fitness = −f" for a minimised function.
- **Validation** per field in words (function, representation, bits per variable 4 to 12 checked only for the binary-coded representations); `landscapeDefaultOptions` (single peak, real, 10 bits) is a placeholder the defaults ticket (14) may change.
- Tested: hand-worked values per function; optima by fine grid (global), local refinement and Himmelblau's equations; decoding end points exact, even spacing, Gray words adjacent in one bit and decoding to adjacent integers, plain 01…1 and 10…0 adjacent values n bits apart; real and binary-coded problems give identical fitness and objective at the same decoded point (all four functions, both codings); bounds never left; a generation runs for each representation and the metrics follow the representation; hand-edited populations for both.
- Mutation-checked (Gray decoded as plain, wrong denominator, optimum moved to (3, 3), sign of fitness removed in `fitnessAt` and in `evaluate`): each fails tests.

Golden runs unchanged; 86 files / 1551 unit tests pass; `npm run check` clean.
