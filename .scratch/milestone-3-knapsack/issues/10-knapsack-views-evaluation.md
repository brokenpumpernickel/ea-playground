# 10 Views: evaluation with repair, and the stage narration

Status: open
Type: task
Blocked by: 02, 08
Spec: ../spec.md

## What to build

The evaluation view per method: what each individual was and what it packed or became (Lamarckian shows `before → after` with the repaired genes marked), what was dropped or skipped and the rule applied, and the score sentence; the narration lines and event sentences for evaluation say the same (for example "packs C, F, K: weight 31 of 30, overweight by 1 → penalty 10 → fitness 42"). The setup stage's narration for the initial population does too. Replacement and selection views use the table's columns.

## Done when

- Playwright against the engine's events for several seeds and each method: every displayed before/after chromosome, packed set, dropped or skipped item, weight, penalty and fitness equals the engine's, one offspring at a time, and the narration quotes the same numbers.
- Unit tests of the models for each method.

## Comments
