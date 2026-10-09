# 19 Scrub bar and truncation notice

Status: open
Type: task
Blocked by: 14, 12
Spec: ../spec.md

## What to build

- A scrub bar over the run history in the bottom strip: drag or step to any generation, and within a generation to any stage or micro-step. The whole UI (table, stage view, plots) shows the state at the cursor.
- Playing forward through already-recorded generations without any edit just replays them.
- When the cursor is in the past and the user changes an operator parameter, a notice names the generations that will be discarded (for example "generations 6–12 will be discarded; the run continues from generation 5 with the new settings") and asks for confirmation. Confirming truncates and applies the change at that boundary; cancelling leaves everything as it was.
- A "return to live" control.

## Done when

- Scrubbing shows the same state the live run showed; the notice appears with the right range; cancel is a true no-op.
- A Playwright test scrubs back, changes a parameter, confirms, and checks that the later generations differ and are reproducible with the same seed.

## Comments
