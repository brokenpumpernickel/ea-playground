# 06 The peak-occupancy readout

Status: resolved
Type: task (test-first)
Blocked by: 01
Spec: ../spec.md

## What to build

The count of individuals within 1.5 units of each peak (single peak, two peaks, Himmelblau): in the metrics beside the figures and in the focus view's info box, with a table and a sentence for the screen reader; kept in step with the cursor.

## Done when

- Unit tests of the counts against a recount; Playwright: equals the engine at every generation, in both places.

## Comments

## Answer

**Built:** a count of the individuals within 1.5 of each peak, for the landscape functions that have named peaks (single peak, two peaks, Himmelblau; Rastrigin has none and shows nothing). `peak-occupancy.ts`: `peakRadius` (1.5, stated in the readout's tooltip and the sentence), `occupancy(peaks, points)` (a count per peak in the peaks' own order, a point exactly 1.5 away counts) and `occupancySentence` ("Within 1.5 of a peak: broad hill 2, narrow hill 1; elsewhere 1 of 4."). The landscape info the views read gains `peaks`. **In the metrics:** under the fitness figures in the Spread panel, a line "near: broad hill 9 · narrow hill 2" (Himmelblau: "place 1 3 · place 2 0 · …"), kept to one line at every size and a little smaller than its neighbours; a screen-reader sentence and a table "Individuals near each peak" (peak, x, y, count) beside it. **In the focus view's information box:** the line "within 1.5 of a peak: …" in full words. Both follow the cursor with the population the table shows, so stepping, scrubbing back through the history and a restart keep them in step.

**Layout:** the first third line wrapped in projector mode and pushed the panel over its edge; the label became "near:" (the tooltip, the sentence and the table say the radius), the line is one line, and the summary's top margin shrinks by 4 px when the line is there. The panel was already full: this is the last room in it.

**Tests:** unit (`peak-occupancy.test.ts`, 6): the counts by hand (a point exactly 1.5 away counts, one at 1.6 does not), the peaks' order and positions, a recount of 300 random points against every function with peaks, Himmelblau's four circles not overlapping (so no individual is counted twice), the sentence, the names. End-to-end (`e2e/peak-occupancy.spec.ts`, 9): for two peaks (real and Gray-coded), Himmelblau and the single peak, at every generation from 0 to 6 the readout, the table and the sentence equal a recount from the engine's own run (decoded points, 30 individuals); Rastrigin and the other problems show nothing; the readout follows the history bar (Home, then page by page; at the start of a generation it shows the parents' count, as the table does); the focus view's box says the same and stays whole and inside the view at 1920×1080 and 1366×768, normal and projector; the metrics line stays inside its panel at the four settings. Mutations: `<` for `<=` and a count off by one in the table were each caught. 2,392 unit tests, 1,071 end-to-end tests (55 skipped without their switches) and `npm run check` pass.

**Correction (ticket 07):** the end-to-end count above was read from the tail of a run that hid six failures (the landscape-metrics geometry and statistics tests did not expect the readout's third line); they were adjusted in the ticket 07 commit and the whole suite then passed (1,081).
