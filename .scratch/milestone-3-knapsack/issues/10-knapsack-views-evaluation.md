# 10 Views: evaluation with repair, and the stage narration

Status: resolved
Type: task
Blocked by: 02, 08
Spec: ../spec.md

## What to build

The evaluation view per method: what each individual was and what it packed or became (Lamarckian shows `before → after` with the repaired genes marked), what was dropped or skipped and the rule applied, and the score sentence; the narration lines and event sentences for evaluation say the same (for example "packs C, F, K: weight 31 of 30, overweight by 1 → penalty 10 → fitness 42"). The setup stage's narration for the initial population does too. Replacement and selection views use the table's columns.

## Done when

- Playwright against the engine's events for several seeds and each method: every displayed before/after chromosome, packed set, dropped or skipped item, weight, penalty and fitness equals the engine's, one offspring at a time, and the narration quotes the same numbers.
- Unit tests of the models for each method.

## Comments

## Answer

- **"What happened" column** in the evaluation view (and its summary in the model): the problem explains what evaluation did through a new optional `Problem.explainEvaluation(chromosome)` returning a short `summary` for the table and `details` for the narration. For the knapsack, called with the chromosome as mutation left it: the decoder says "skipped F I J K L" (details "skipped F: 14 > 11 left", …) or "everything fits"; the penalty says "over by 19 (4 × 19)" or "fits: no penalty"; both repairs say "dropped A E I L F" (details "dropped E: 5/10 = 0.50 per weight", …) or "everything fits". The summary is one short line per row so a row never grows (the full steps are in the narration, one offspring at a time). Other problems have no such column.
- **Narration and event sentences** (`describe.ts`): the evaluation sentence now reads, for example, "Offspring 3: 110000100101 → skipped I: 11 > 5 left; packs A, B, G, J, L: weight 45 of 48, value 62 → fitness 62 (individual 13)", and for Lamarckian repair "…: 111101100101 → repaired to 011101100101 → dropped A: 4/9 = 0.44 per weight; packs …". The setup sentences for the initial population say the same ("Individual 1 (111111111111 repaired to 011100110110): dropped A: …; packs B, C, D, G, H, J, K: weight 40 of 48, value 112, fitness 112"). Goldberg and the strings are unchanged.
- **Fit:** the evaluation table, with the new column and the bars, fits its panel for all four methods in normal and projector mode (the knapsack's evaluation table has tighter headers and padding, a 32 px bar, and a smaller "individual n" cell).
- The ✂ marks, the stacked bar and "repaired from" were ticket 09; the explanation paragraph per method was ticket 06.

**Tests**
- `knapsack-evaluation.test.ts` (15): the explanations hand-worked for each method (the decoder's five skips with the room left; the repairs' five drops and their ratios; the penalty's "over by 1 (4 × 1)", "(2.5 × 1)", "fits: no penalty"; a bag that fits), the setup sentences literally (Lamarckian and decoder), every evaluation sentence for every method quotes the engine's details, score text and `repairedFrom`, the model's `why` equals the problem's for every scored offspring, the view prints the column and "not scored yet" for pending rows, and a problem without explanations has no column.
- `e2e/knapsack-evaluation.spec.ts` (18): for each method and two seeds, one offspring at a time, the row's chromosome, every column and the "What happened" text are the engine's and the narration contains the exact sentence for that event (some offspring really were skipped or repaired); the setup narration for the first individuals, going back; the evaluation table never scrolls sideways in normal and projector mode for every method; no column for the other problems.

State: 1181 unit tests, `npm run check` clean, 199 Playwright tests passing.
