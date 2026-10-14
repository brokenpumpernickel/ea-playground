# 12 Edge agreement, diversity and the stats of the tour

Status: resolved
Type: task (test-first)
Blocked by: 06, 08
Spec: ../spec.md

## What to build

The bottom strip for TSP: the **edge agreement** panel in place of the allele strip (one bar per edge of the best tour, the share of the population that has it, the counts printed, the distinct routes), the diversity plot of the edge-based measure with its note, the fitness plot with the optimum and the nearest-neighbour lines, labelled with a placement rule that keeps the labels apart when the lines are close, and an axis margin wide enough for labels such as −26,250; the stats lines in lengths with the gap in per cent; hidden tables as for the other plots; stable widths.

## Done when

- Plotted and printed values equal the metrics for every recorded generation; labels never collide for any of the instances; the panels keep their widths and fit at both sizes; the other problems' strips are unchanged.

## Comments

## Answer

The bottom strip of a TSP run:

- **Edge agreement** (`EdgeStrip.svelte`), in the place of the allele strip: one bar per edge of the generation's best tour, in the order of the tour, as tall as the share of the population that has that edge (`data-edge="5-11"`, `data-share`, `data-count`); up to 16 edges each bar prints its share; under the bars "each bar: an edge of the best tour …, full height = all 12" and the counts: "1 of 16 edges are in every individual · 16 in at least half · mean agreement 0.73"; the heading's figure says "12 of 12 distinct routes" (rotations and reversals are one route); a hidden table lists every edge with its count and share.
- **Stats lines in lengths** under the bars: "generation 40 · best now 7,159 · best so far 7,159 (gap 4.4%)" and "average 8,358 · worst 9,947 · evaluations 452".
- **Diversity** is the edge-based measure with its note ("share of edges not in common, 0–1"); it was already the plotted value, and the tests now compare it with the metrics at every generation.
- **Fitness plot:** fitness = −length (said in the legend), the optimum line (dotted) and the **nearest-neighbour line** (dashed), labelled "optimum −6,859" and "nearest neighbour −9,988". The axis labels are grouped with a real minus ("−26,250") and the margin on the left grows with the widest one (100 px for seven characters). **Placement rule:** the nearest-neighbour tour is never shorter than the optimum, so its line is never above the optimum's; the optimum's label goes above its line and the nearest neighbour's below its own line, so the two labels, one outside each line, cannot meet however close the lines are (circle instances have them on one line). Three things keep the labels in the picture: the axis of a tour plot starts 18 below the top, so that an optimum line near 0 (att48: 10,628 of an axis to −80,000) still has room for its label above it; the floor leaves a quarter more under the nearest-neighbour line; and with no room above (or below) a label flips to the other side of its line. The labels are drawn last on a halo, so the cursor's line does not cut them. The plot's own sentence names both lines.
- Hidden tables as before for the plots (one row per generation with the average, worst, best, best so far, diversity and distinct routes).

Tests: `plot-models-tour.test.ts` (10: the nearest line and formatter, the old model unchanged without them, room under the line for every instance early and late and for tours as long as the nearest-neighbour tour or as short as the optimum, tick labels fit the margin, the label rule including the fallbacks and for every instance), `tour-cells.test.ts` (+9: stats lines, agreement figures and line, best-edge pairs); `e2e/tsp-plots.spec.ts` (21): plotted average, best, best so far and diversity and the distinct routes equal the metrics at every generation of a 12-generation run for 5, 16, 48 and 52 cities, the hidden table equals them; the bars, their edges, shares, counts and heights, the counts line, the stats lines and the hidden edge table equal the engine at generations 0, 3 and 9; the reference lines' values and labels and the axis in lengths; at both sizes, for every instance (the six TSPLIB ones, the two clusters, circles and random ones of 5 and 15 cities) early and late in a run the labels never meet each other, a line or the edge of the picture and every tick label is whole; the three panels keep their places and their text stays inside them at every micro-step of two generations at both sizes; the other problems keep their allele strip. Mutation checks: sixteen mutants (the top margin, the quarter of room, the label offsets, the margin per character, the nearest line in the floor, the thresholds of the agreement counts, the digits of the mean, the gap of the stats line) all fail a test, one equivalent apart (a share just under 1 with a population of several hundred).

Not done: the squeezed look of the large instances' fitness curves (berlin52's axis runs to −80,000 while the run lives between −27,000 and −14,000) is what the spec accepted; the stats lines and the gap carry the detail.
