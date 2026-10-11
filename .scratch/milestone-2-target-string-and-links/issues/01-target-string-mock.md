# 01 Throwaway visual mock of the target-string screens

Status: claimed
Type: prototype (needs instructor review)
Blocked by: none
Spec: ../spec.md

## What to build

A static HTML/CSS/SVG mock at 1920×1080 with hand-made data, reusing the Studio look of milestone 1 (`.scratch/milestone-1-goldberg/mock/studio.html`). No engine, no framework. Default configuration: target `HELLO WORLD`, 27-symbol alphabet, population 12, a generation in progress. Show, as separate screens or states:

- The full layout with the problem menu in the brand area ("Target string ▾").
- The population table with letter cells, the matches column and fitness, with matching and mismatching positions marked. Try at least two ways of marking a match without relying on colour (for example a filled cell with ✓, and the target letter in small type under a mismatch; or a baseline tick) and recommend one.
- The crossover cards (inheritance hatching and cut points on letters) and the mutation view (per-gene draws, a flipped gene shown as `old → new`, the replacement draw `r`, a bypass).
- The evaluation and replacement views with letters.
- The bottom strip with fitness, diversity and **Match rate per position**.
- The drawer's run setup with the alphabet and target fields, including an invalid target (a character outside the alphabet).
- How a space looks in a cell (`␣`), at projector size, and at 1366×768.

Use roughly 20 px body text at 1080p, and give every colour-coded meaning a symbol or pattern.

## Output

- The mock under `.scratch/milestone-2-target-string-and-links/mock/` (thrown away afterwards).
- The instructor has chosen how matches are marked, and whether `␣` is legible.
- A short list under `## Answer` of what the views need from the engine's events and metrics (for example, "the mutation view needs the old and new symbol and the replacement draw").

## Done when

The instructor has reviewed the mock and chosen how matches are marked, and the list of what the engine and views need is written under `## Answer`.

## Comments
