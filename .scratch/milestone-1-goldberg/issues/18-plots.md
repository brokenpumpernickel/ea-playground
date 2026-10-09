# 18 Fitness and diversity plots

Status: open
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
