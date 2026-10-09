# 15 Selection and pairing views

Status: resolved
Type: task
Blocked by: 14, 05, 06
Spec: ../spec.md

## What to build

The selection stage view, matching the approved mock:

- Roulette: the weight-transformation table with one column per chain step (`raw fitness → … → weight → probability`), a wheel whose slices are the probabilities, and each spin animated to the recorded random number and result. The auto-switch-to-Shift banner appears when the engine reports it.
- Tournament: brackets showing contestants, their fitness, the winner, and the tie-break when one decided it. A note that tournament selection ignores the weight chain.
- The mating pool and the pairs, with each individual's selection count visible in the population table (parent marker with a symbol and label, not colour alone).
- Animation follows the playback tier and reduced-motion setting and never obscures what actually happened.

## Done when

- Stepping micro-step by micro-step shows each spin or tournament and its recorded outcome, and the pool shown equals the engine's pool.
- A Playwright test compares the displayed pool and probabilities with the engine's for a seeded run.

## Answer

Done (design and test seams agreed with the instructor beforehand). 593 unit, model and view tests and 20 Playwright tests pass; `npm run check` and `npm run build` are clean. The views were also checked on real screens (roulette, pairing and a temporary tournament build, in light and dark); that check found two layout bugs the tests could not see (below).

Models, tested first against real engine events (`src/ui/selection-models.ts`):

- `selectionModel(view)`: the weight table with a column per chain step (parameters named from the registry, e.g. `ε = 1`), one row per individual (fitness, each step's value, weight, probability, interval of r), the automatic-switch reason, the spins as revealed so far (draw, landing, current), the mating pool filling slot by slot, and which row the latest spin landed on.
- `tournamentModel(view)`: the size, one card per tournament (revealed ones with contestants, chromosome from the parents, fitness, winner, tie-break flag; the rest pending), and the pool of winners.
- `pairingModel(view)`: the whole pool, one card per pair (revealed one per micro-step, with slots, both parents' chromosome and decoded value, the dropped-child flag), and generated notes grouped by how often individuals were picked ("Individuals 3, 5 and 6 were selected 2 times, because selection draws with replacement"), who was never selected, and the odd-count note.

Views (`src/ui`), tested by rendering them to HTML on the server (`svelte/server`), which checks real markup even for paths the UI cannot reach yet:

- `RouletteView`: the wheel (slice size = probability, labelled inside, outside or not at all by slice size; four violet shades with separators; only revealed spins are drawn, so future outcomes are not spoiled), the formula `raw fitness → steps → weight → probability`, the weight table, spin chips ("3: r = 0.488 → 5" or "4: not drawn"), the **automatic-switch notice** and the mating pool. The latest pin sweeps along the rim to its position over 0.9 s when `animate` is true (Slow tier only); at Medium and faster, and under reduced motion, it simply appears. `data-animated` on the wheel records which, and the text shown is identical either way.
- `TournamentView`: the note that the weight chain is not used, one card per tournament (contestants with chromosome and fitness, winner marked with ✓ and a label, a "tie-break" badge, dashed "not drawn" cards for the rest) and the pool.
- `PairingView`: the pool, pair cards (dashed "not paired yet" until revealed), the notes.
- `MatingPool`, `Bits`; `reveal.ts` scrolls the current tournament or pair card into view inside its scrolling area; `format.ts` holds the shared number formatter (`describe.ts` now uses it).
- `StagePanel` chooses the view (tournament or roulette from which events exist); the other stages keep the sentence list until tickets 16 and 17.

Verified in the browser against the engine's own events (`e2e/selection.spec.ts`): stepping through selection reveals one spin at a time (chip text, pin count, highlighted row, pool slot); the probabilities and intervals in the table equal the engine's; the finished pool equals the engine's pool and the wheel has one slice per individual; the latest pin ends at the coordinates the draw gives after its sweep; faster tiers and reduced motion show the same result with `data-animated="false"`; pairing reveals one pair per micro-step with the engine's slots and parents, the newest pair stays fully visible, and the pool is the engine's; the population table's parent counts agree with the pool.

Bugs found by looking at the screen, not by the tests, and fixed:

- A ticket-14 rule (`#stagebody ol { flex-direction: column }`) was more specific than the new `.chips` and `.poolstrip` rules, so chips and pool slots stacked vertically and squeezed the weight table out. The generic list's styles are now scoped to `ol.events`.
- The pairing view overflowed under the narration bar (it ignored the explanation line above it, and four separate notes took too much room). It now has its own scrolling card grid, one-line parents, and grouped notes.

Not reachable from the UI yet, so covered by model and server-render tests only: tournaments, the automatic-switch notice and multi-step chains (these need the controls from ticket 20). A temporary tournament build was screenshotted and then reverted.

Notes for later tickets:

- Ticket 16 (crossover and mutation views) and ticket 17 (evaluation and replacement) should follow the same pattern: a pure model from `view` (tested against real events), a plain-data component (server-render tested), and a dispatch branch in `StagePanel`. The pool, pair and card styles in `app.css` are reusable.
- Ticket 20 should add the selection-method and chain controls, which will let the e2e suite drive tournaments and the auto-switch notice directly.
- The number of weight-table rows is bounded only by the scroll area; very large populations scroll inside the table, and the wheel stays readable because thin slices go unlabelled.
- If the sweep should also play when scrubbing backwards, that already happens (the pin animates between any two positions); only the "Slow" tier animates.

## Comments
