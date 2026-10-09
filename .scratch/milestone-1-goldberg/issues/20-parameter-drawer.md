# 20 Parameter drawer, pending parameters, hand-edited population

Status: resolved
Type: task
Blocked by: 14, 05, 06, 10
Spec: ../spec.md

## What to build

The collapsible parameter drawer (collapsed by default for projection) with plain-language help for every control:

- Population size and initialization (seeded random, textbook preset, hand-edited), and the seed with a "new seed" button.
- Selection method (roulette, tournament with size), the weight-transformation chain editor (an ordered list with add, remove, and move up/down buttons, each step's parameters, validator messages shown), and a note that tournament ignores the chain.
- Crossover type, probability, and an on/off switch; mutation type, mode (per-gene or per-individual), probability, and an on/off switch. Each states what its probability applies to and when the draw is made.
- Elite count (with equivalent proportion), offspring truncation on/off with λ.
- Stop criteria: generation limit, target reached, stagnation window.
- Pending parameters shown as pending until the next generation boundary; changes that require a reset are marked, and applying them starts a reset after a confirmation that names what will be lost.
- Hand-edited initial population: type chromosomes with validation (length, alphabet) and live display of decoded x and fitness.
- Warnings when the population or generation limits are exceeded.

## Done when

- Every control changes the engine's configuration through the run layer, with pending/reset semantics matching ticket 12.
- Invalid chains and hand-edited chromosomes show readable messages.
- A Playwright test changes pc mid-generation, checks it shows as pending, and checks it applies at the boundary.

## Comments

## Answer

Built the parameter drawer (collapsed by default; **Parameters** toggles it, Esc closes it and returns focus; `aria-expanded`), a pure draft model, and the session plumbing for pending changes and resets.

- **`drawer-model.ts`** keeps every number as the text typed, validates it in words (probabilities 0–1, whole numbers, elites ≤ N, λ ≥ N − e, stop settings, seed, chromosomes), runs the weight chain through the engine's own validator against the real current fitness (so the message and the step to blame are the engine's), converts a valid draft to `GaParams`/`GaSetup`, and classifies changes: operator parameters (pending until the next generation boundary) versus setup (needs a reset).
- **Drawer sections**: Run setup (initialization random or hand-edited, population size, seed; "Apply and restart"), Selection (roulette or tournament with size, the weight-chain editor with add/remove/move up/down and per-step parameters, the note that tournament ignores the chain), Crossover and Mutation (on/off switch, type or mode, probability, each with a sentence saying what it applies to and when the draw is made), Replacement (elites with their share of N, offspring truncation on/off with λ), Stop (generation limit, target, stagnation window; "reported, never forced"). Warnings for population and generation limits are shown before applying.
- **Applying**: operator controls apply on commit (Enter, blur or a changed select/switch) as pending parameters through `session.changeParameters`; invalid entries are explained and nothing is applied. Pending settings show a tag with "was → now" in the drawer and a "pending: …" chip on the stage panel, and disappear when the next generation starts. In the past, the same change shows the discard notice from ticket 19. Setup changes are staged and applied only by "Apply and restart", which opens a notice naming what restarts and what is lost ("Changing the population size restarts the run from generation 0 and discards the 3 recorded generations (1–3)."); cancel changes nothing, confirm resets with the new setup, seed and parameters together.
- **Hand-edited population**: a text area (lines, spaces or commas) with a live table of each chromosome's x and fitness; bad ones are named ("Chromosome 2 has 4 genes, but this problem needs 5.") and block the restart.
- Dialogs share a `ConfirmDialog` (alert dialog, Cancel focused, Tab trapped, Esc cancels).

Verification: 40 model tests; session tests for resets, pending names and notices; 11 Playwright tests in `e2e/drawer.spec.ts`, including the ticket's pc-mid-generation case (shows as "pending · 0.8 → 0.3", the current generation still uses 0.8, the next uses 0.3, and the next population equals the engine's run with that change at that boundary), invalid entries changing nothing, chain editing, tournament, restart notice (cancel/confirm), hand-edited start compared with the engine, the scrub-back flow from ticket 19, warnings, and elite share. Deliberate mutations of the elites and λ boundaries are caught (and a boundary test was added because the first mutation survived). Rendered drawer screenshots found the pending chip pushing the toolbar off-screen (moved to the stage panel header) and a `.chip` class clash (renamed).

Decisions I made without asking, easy to change: operator edits apply on commit rather than through an Apply button (matches the mock's per-field "pending" tags); the seed is edited in the drawer only with the restart (the toolbar keeps "New seed"); the textbook preset arrives with ticket 21 through the same hand-edited path.
