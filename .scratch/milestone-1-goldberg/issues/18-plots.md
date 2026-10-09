# 18 Fitness and diversity plots

Status: resolved
Type: task
Blocked by: 14, 11
Spec: ../spec.md

## What to build

The bottom-strip plots, matching the approved mock:

- Fitness plot: average with a min-to-max band, best of generation and best so far as distinct lines with distinct markers, a legend that does not rely on colour alone, and a fixed, labelled scale.
- A separate diversity plot beneath it: normalised mean pairwise Hamming distance and number of distinct chromosomes.
- The allele-frequency strip showing each bit position's frequency of ones.
- Plots follow the cursor: when the user scrubs or pauses mid-run, the current generation is marked and later generations are shown dimmed rather than removed.
- Readable at projector sizes (about 20 px labels at 1080p).

## Done when

- The plotted values equal the engine's metrics for a seeded run; a run that stalls shows best of generation falling below best so far where it should.
- A Playwright test checks the plotted series against the metrics.

## Comments

## Answer

Replaced the stat-tile strip with the approved mock's three bottom panels: **Fitness**, **Diversity** and **Share of 1s per gene** (`MetricsPanel`, `FitnessPlot`, `DiversityPlot`, `AlleleStrip`), fed by a pure `plotModel` (`src/ui/plot-models.ts`) that reads one point per recorded generation from `metricsOf`.

- **Fitness**: average (● circles, solid), best of generation (■ squares, solid), best so far (▲ triangles, dashed), and the min–max band. The legend names all four and relies on shape and dash as well as colour. The scale is fixed and labelled: 0 to a "nice" ceiling above the problem's known optimum (1000 for Goldberg), with the optimum drawn as a dotted reference line. Hover titles give exact values.
- **Diversity**: normalised mean pairwise Hamming distance, 0–1; the number of distinct chromosomes is in each point's hover text and in the gene-share panel header ("4 of 6 distinct").
- **Gene shares**: one bar per gene with its share of ones as a number, plus the summary line (best now, best so far, average, worst, evaluations) for the generation on screen.
- **Following the cursor**: a "now" line marks the generation the summary describes (the last complete generation while a new one is being made); later generations stay plotted, dimmed, with `data-future`. The generation axis grows in steps (15, 30, 50, 100, …) so it stays put while a run plays; the fitness axis depends only on the problem and the data seen, never the cursor.
- **Accessibility**: each plot is a `role="img"` with a sentence for the generation on screen, and a visually hidden table lists every metric for every generation.
- `Problem` gained an optional `knownOptimumFitness`, used for the reference line (Goldberg already had it).

Verification: 13 model tests (values equal `metricsOf`, future flags, scale independent of the cursor, axis steps, a seed search for a run where best of generation falls below best so far) and 7 view tests (plotted data attributes equal engine metrics, marker shapes differ, dimming, optimum line, aria sentence); `e2e/plots.spec.ts` (6 tests) compares plotted series, scale stability, mid-generation dimming, a seeded dip, gene shares/summary and the hidden table with the engine. Deliberate mutations (`future` off-by-one, best so far replaced by best) are caught. Rendered at 12 and 36 generations in light and dark; found and fixed clipped axis titles and gene bars overlapping the panel header.

Deviation from the ticket text: the ticket says the diversity plot sits "beneath" the fitness plot; I followed the approved mock (side by side). The distinct count is not a second plotted series because that would need a second y-axis; it is shown as text and in hover titles. Say if you want it plotted separately.
