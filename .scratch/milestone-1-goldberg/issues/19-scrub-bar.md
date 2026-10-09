# 19 Scrub bar and truncation notice

Status: resolved
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

## Answer

Built the scrub bar and the discard notice. The browser test that scrubs back, changes a parameter through the drawer, sees the notice, cancels and confirms lives in `e2e/drawer.spec.ts` (ticket 20), because nothing on screen could change a parameter before the drawer existed.

Done:
- **Scrub bar** (`HistoryStrip`, `scrub-model.ts`): a slider along the bottom with one equal cell per recorded generation, split into stages; micro-steps are spread inside each stage. Click or drag anywhere to move the cursor to the nearest recorded stage/micro-step position; every position maps to its own place and back (tested for every position of a 4-generation run). The whole UI follows the cursor: stage view, population table, plots (the "now" line moves; later generations are dimmed).
- **Keyboard**: ←/→ (and ↓/↑) one micro-step, PageUp/PageDown one generation, Home/End to the start and to the live end. Stepping inside the history never makes a new generation; the transport buttons still do. `aria-valuetext` reads, for example, "Generation 3, stage 5 Evaluation of offspring, micro-step 6 of 6".
- **Return to live**: enabled only in the past; goes to the end of the newest generation.
- **Replay**: stepping or playing forward from the past replays recorded generations unchanged and adds nothing to the history (tested through the UI at the generation button and at "Run" with the fast tier).
- **Notice** (`session.changeParameters`, `DiscardNotice`): at the live end a change simply becomes pending; in the past nothing changes and a modal alert dialog says, for example, "Generations 6–8 will be discarded. The run continues from generation 5 with the new settings." (singular form for one generation). Cancel has focus, Esc cancels, Tab stays in the dialog. Cancel is a verified no-op (cursor, history, parameters and pending parameters unchanged). Confirm truncates and records the change for the next generation, and the continued run is identical to a fresh run with the same seed and the same change at the same point (tested against `createRun`). A reset or new seed closes an open notice.

Tests: 8 scrub-model, 14 session-history and 4 view unit tests; 6 Playwright tests in `e2e/history.spec.ts` compare what the screen shows at clicked, dragged and key-selected positions with the engine's own state there. Deliberate breakages (forward key at the live end making a generation; the position mapping off by one) are caught. A temporary build exposing the session confirmed the dialog renders correctly.

The full flow test (scrub back with PageUp, change pm in the drawer, notice names "Generations 4–6" and "generation 3", cancel leaves the run and the drawer value untouched, confirm truncates, the continued run equals the engine's run with the same seed and change, and differs from the original) passes in `e2e/drawer.spec.ts`.
