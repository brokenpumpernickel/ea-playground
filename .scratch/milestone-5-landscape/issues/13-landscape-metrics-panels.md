# 13 Diversity, spread and the stats of the landscape

Status: resolved
Type: task (test-first)
Blocked by: 06, 07
Spec: ../spec.md

## What to build

The bottom strip of the landscape: the diversity plot of the decoded-space measure (its note says what it is; for the binary-coded representations the Hamming diversity as a labelled second line), the spread panel (the standard deviations of x and y as shares of the ranges, now and over the generations, with the figures printed) in place of the allele panel, the fitness plot with the optimum line (and, for the minimised functions, its label in fitness), the stats line; hidden tables as for the other plots; stable widths.

## Done when

- The plotted and printed values equal the metrics for every recorded generation; the panels keep their widths and fit at both sizes; the other problems' strips are unchanged.

## Comments

## Answer
The bottom strip of the landscape is now its own.

- **Fitness plot** (`plot-models.ts`, `FitnessPlot.svelte`): the axis has a floor, `yMin` (0 as ever; for a fitness that can be negative the next round value below the run's worst, e.g. −400 to 0 for Himmelblau, with quarter ticks), so the minimised functions' fitness (−f) is drawn instead of clipped; it does not depend on the cursor, so scrubbing never rescales it. The optimum line is labelled under the line when it is the top of the axis (clear of "now"), and the legend says "fitness = −f" for a minimised function. The summary and the hidden table print values to three decimals instead of raw 17-digit floats.
- **Diversity plot** (`DiversityPlot.svelte`): the decoded-space distance for every representation, and for the binary-coded ones the Hamming diversity as a second dotted line with ◇ markers, named in the legend ("● decoded distance ◇ Hamming, 0–1"). The other problems have neither.
- **Spread panel** (`spread-model.ts`, `SpreadPanel.svelte`, in place of the allele strip): for x and y a bar for the standard deviation as a share of the variable's range (full bar = 0.5, half the population on each bound), the figure printed, a caption saying what it is, and the last six generations printed as text ("x, gens 2–7: .07 .08 …"); the figures follow the history cursor.
- **Stats lines** (`statsLines`): "generation g · best now … · best so far …" and "average … · worst … · evaluations n", to three decimals so they fit.
- **Tests**: `landscape-plots.test.ts` (12: axis floor and ticks for Himmelblau, Rastrigin, single peak and Goldberg, independence from the cursor; decoded diversity, spread and Hamming per representation; the spread panel's now, history, last six and bars; the stats lines) and `e2e/landscape-metrics.spec.ts` (10): for the real and the Gray coding every plotted point of the three fitness lines and the diversity lines, the position of the points on the axis, the spread bars and printed history, the stats lines and the axis ticks equal the engine's at every generation 0 to 6, and the hidden table agrees; the optimum label and the −f note; the other problems keep their share-of-1s strip, no spread, no Hamming line and the axis from zero; and at 1920×1080 and 1366×768, in projector mode and not, with both codings, nothing in the three panels overflows or wraps and their widths do not change from generation 0 to 8. Mutation-checked (floor, Hamming only for binary coding, bar scale, y mapping, wrong history, wrong Hamming height, label position, −f note, panel choice): each fails tests.

Golden runs unchanged; `npm run check` clean; 102 unit-test files / 1849 tests pass; the whole end-to-end suite (518 tests, 6 skipped) passes.
