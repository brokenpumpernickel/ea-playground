# 16 Crossover and mutation views

Status: open
Type: task
Blocked by: 14, 07, 08
Spec: ../spec.md

## What to build

The crossover and mutation stage views, matching the approved mock:

- Crossover: each pair with its probability draw (random number against the threshold), the cut points or uniform mask drawn on the parents, and each child's bits marked by which parent they came from. A pair that fails its draw, and the whole stage when crossover is switched off, are shown as labelled bypasses with independent copies; dropped children are shown as discarded.
- Mutation: per-gene mode shows every gene's draw; per-individual mode shows the individual draw and then the chosen genes. Flipped genes are marked with a symbol and label as well as colour, and bypass is shown as a labelled bypass when mutation is off.
- A one-line explanation under each view of what its probability applies to and when the draw is made.

## Done when

- Stepping micro-step by micro-step shows each pair and each draw, and the displayed offspring equal the engine's.
- Switching crossover or mutation off in the engine configuration shows deliberate bypasses, not an empty stage.
- A Playwright test checks the displayed cut point, inheritance and flipped genes against the engine for a seeded run.

## Comments
