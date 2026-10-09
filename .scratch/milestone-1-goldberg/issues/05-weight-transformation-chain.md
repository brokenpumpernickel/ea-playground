# 05 Weight transformation chain

Status: resolved
Type: task (test-first)
Blocked by: 04
Spec: ../spec.md

## What to build

The ordered chain from raw fitness to selection weights, as a small registry so adding a step is one function plus a parameter description:

- Steps: Identity, Shift (fitness − min + ε), Rank (1 = worst, ties get the average rank), Linear ranking (selection pressure s in [1, 2]), Power (exponent).
- A validator that rejects chains whose output is not non-negative or has a zero sum, and returns a reason a student can read.
- Auto-switch: when the chain starts as Identity and raw fitness has negatives, switch to Shift and record that it happened and why.
- Every step's intermediate values are recorded, so the selection view can show one column per step (`raw fitness → step 1 → … → weight → probability`).
- Defaults for ε, s and the exponent chosen here and recorded in the spec.

## Tests (write first)

- Each step against hand-computed values, including ties under Rank and the bounds of s.
- Chains of several steps in different orders.
- Validator rejects all-zero and negative outputs with distinct reasons.
- Negative raw fitness under Identity switches to Shift and records the banner event; positive fitness does not.
- The weights recorded are the ones roulette actually used.

## Answer

Done test-first (decisions, interface and seams agreed with the instructor beforehand). 102 engine tests pass (43 for this ticket); `npm run check` is clean.

Public interface (`src/engine/index.ts`):

- `transformWeights(fitness, chain)` → `{ ok: true, weights, event }` or `{ ok: false, problem, stepIndex? }`. `chain` is an ordered list of `{ step: 'identity' | 'shift' | 'rank' | 'linear-ranking' | 'power', …parameters }`. `stepIndex` is 0-based, for highlighting the step in the chain editor.
- The `weight-chain` event carries `raw` fitness, one `column` per step (`step`, `label`, resolved `params`, `values` per individual), the final `weights`, and an optional `autoSwitch { from, to, reason }` for the banner. A test checks the weights `rouletteSelect` uses, and its probabilities, follow from the event's weights.
- `weightSteps`: the registry. Each step has a label, a plain-language description, parameter specs (key, label, description, default, bounds) for the UI, and its checks. Adding a step is one entry.

Step definitions: Identity (as is); Shift (value − lowest + ε); Rank (1 = worst, ties share the average rank); Linear ranking (Baker: 2 − s + 2(s − 1)(rank − 1)/(N − 1), weights add up to N, a single individual gets 1); Power (value^exponent). **Defaults: ε = 1, s = 1.5, exponent = 2** (recorded in the spec).

Validation, with distinct readable reasons (rows are 1-based positions in the population table, steps 1-based in the text):

- empty chain, no fitness values, a non-finite fitness;
- a parameter out of range (`ε` > 0, `s` in [1, 2], exponent ≥ 0);
- **Linear ranking needs ranks as its input**: refused unless the values entering it are still ranks (Identity steps in between are fine, Shift or Power in between are not);
- **Power refuses negative input** rather than squaring it into a better score (not in the original ticket; added because silently inverting the order is worse than a refusal);
- a step that produces a non-finite weight (overflow), and a final result that is negative or sums to zero.

Auto-switch: only the bare `[Identity]` chain is ever rewritten, and only when fitness is negative or all zero; it becomes `[Shift]`, with the reason recorded. Every other chain is refused with a reason instead. Non-finite fitness is an error, not a switch.

Notes for later tickets:

- `rouletteSelect` still refuses invalid weights itself (ticket 04). The generation loop (ticket 09) should call `transformWeights` first and only pass its weights on, treating `ok: false` as a configuration error to show the student.
- Messages say "row N" for a position in the fitness array. If the UI shows ids rather than positions in the weights table, it should show the same row numbering.
- Tournament selection (ticket 06) does not use the chain; the UI note saying so belongs to ticket 15.
- The registry, event and result types are all exported for ticket 15 (selection views) and ticket 20 (chain editor).

Process note: the first test expectations for Shift were wrong (I mis-added by hand); the implementation was right and the tests were corrected. The registry, overflow and roulette-agreement tests passed immediately because they check properties of code already written, so they are regression guards rather than drivers of new code.

## Comments
