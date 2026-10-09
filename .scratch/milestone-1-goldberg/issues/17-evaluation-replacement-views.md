# 17 Evaluation and replacement views

Status: resolved
Type: task
Blocked by: 14, 10
Spec: ../spec.md

## What to build

The evaluation-of-offspring and replacement stage views, matching the approved mock:

- Evaluation: each offspring's chromosome, decoded x, objective value and fitness.
- Replacement: the flow from the old population and offspring to the new population, showing elites carried over (star symbol and label), offspring that survive, and, with truncation on, the offspring discarded with the reason (rank below N − k, tie-break when one applied).
- Where the stop criteria are reported, the run shows which fired, without blocking further stepping.

## Done when

- The displayed new population equals the engine's after replacement, with and without elites and with and without truncation.
- A Playwright test checks the displayed elites, survivors and discards for a seeded run.

## Comments

## Answer

Built `EvaluationView` and `ReplacementView` from pure models in `src/ui/outcome-models.ts` (`evaluationModel`, `replacementModel`), wired into `StagePanel`. After this ticket every stage has a dedicated view; the generic sentence list remains only as a fallback.

- **Evaluation**: one row per offspring, revealed one micro-step at a time: chromosome (genes mutation flipped stay marked with ✱), decoded x, objective, fitness, and the new individual number. Unscored rows show their chromosome and "not scored yet".
- **Replacement**: three columns, old population → offspring → next population. Before the step: "Not decided yet". After: old individuals are `★` (elite, carried over unchanged) or `✕` (replaced); offspring are `✓ survives` or `✕ discarded` (dimmed); the next population lists elites first (`★ #id`) and then offspring (`◇ On`). With truncation each offspring shows its rank, the column says where the cut fell, and a tie at the cut is named ("the offspring made earlier ranks first"). A one-line explanation states the elitism and truncation settings in force for that generation. The offspring column is a keyboard-focusable scroll region because λ can exceed what fits.
- The replacement narration line now summarises more than two discards ("Discarded: 6 offspring (ranks 5–10)") so it stays on one line; the stage view names each one. "1 micro-steps" is now "1 micro-step".
- Stop criteria: already reported by the transport status ("Paused · stop criterion: …") from ticket 13/14, without blocking stepping; nothing added here.

Verification: 8 model + 6 view unit tests against real engine events (elites, truncation, ties found by seed search); Playwright `e2e/outcome.spec.ts` compares every displayed offspring score and the replacement view's next population with the engine, and with the population table. Deliberate mutations (swapped survive/discard, inverted tie test) are caught. Rendered default, elites + truncation (λ = 10) and dark variants were inspected; found and fixed columns overflowing into each other and rows too tall.

Not covered in the browser: elites and truncation (the default configuration has neither); unit tests and screenshots cover them. Ticket 20 (parameter drawer) should add Playwright cases for them.
