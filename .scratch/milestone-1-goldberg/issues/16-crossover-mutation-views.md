# 16 Crossover and mutation views

Status: resolved
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

## Answer

Built `CrossoverView` and `MutationView`, each fed by a pure model (`src/ui/variation-models.ts`: `crossoverModel`, `mutationModel`) derived from `run.view()` and the parameters of the cycle on screen, and dispatched from `StagePanel`.

- **Crossover**: one card per pair, revealed as the micro-step cursor reaches it. Header shows `✓ recombined` or `⤼ BYPASS` plus the draw in words (`u = 0.557 ≥ pc 0.5 → children are copies`, `… → cut after gene 4`, `… → genes 1 and 5 taken from the other parent`). Parents and children are drawn with `Bits`: genes inherited from parent B are hatched (not colour alone), cuts are dashed lines, children are labelled `recombined` / `copy of A` / `copy of B`, dropped children are dimmed and labelled. A key line explains the marks.
- **Crossover off**: every pair is a labelled BYPASS ("crossover is off → children are copies"), no draw shown, explanation says no random number is drawn.
- **Mutation**: per-gene mode has a column per gene with every draw; flipped cells carry ✱ and an outline. Per-individual mode shows the individual draw against pm and the extra gene draw. The Result cell shows the final chromosome with flipped genes marked, and a badge (`✱ gene 2: 1 → 0`, `✱ genes 1 and 5 flipped`, `unchanged`, `⤼ bypassed: mutation is off`). Offspring not yet reached show `not yet drawn`.
- `Bits` gained `sources`, `cuts`, `flipped` (with `data-*` attributes and aria description).
- One-line explanations of what pc / pm apply to and when the draw is made sit under each view.

Verification: 12 model + 14 view unit tests (against real engine events); Playwright `e2e/variation.spec.ts` compares every displayed draw, decision, cut, inheritance string, flipped gene and final chromosome with the engine, including a multi-seed test (default seed 42 has no bypass and one flip) that reads the displayed seed. Deliberate mutations (swapped copy-of labels, off-by-one in the flip label) are caught; the second needed an extra test. Visual check of default, pc 0.5/pm 0.2, uniform + per-individual, both-off, and dark theme found one layout bug (result badge clipped in per-gene mode), fixed.

Note for 17: evaluation and replacement still use the generic event list; `ranking` from truncation is available there. For 20: the e2e tests cannot yet reach tournament/uniform/per-individual configurations, those are covered by unit tests and screenshots only.
