# 10 Operator views for permutations

Status: resolved
Type: task (test-first)
Blocked by: 04, 05, 08, 09
Spec: ../spec.md

## What to build

The crossover cards (OX: the cut draws, the kept slice outlined, the fill order from the other parent, hatching for cities filled from the other parent; PMX: the slices, the mapping table, one worked chain, the cities that followed it marked ↻; CX: the cycles, each city's cycle named by an underline pattern as well as its position) with strips of 30, 22, 20 and 16 px cells by length, the lengths of the parents and children, and the sentence on why one-point crossover would break a tour; the mutation cards (the individual's draw against pm, the positions drawn, the before and after strips with the changed cities marked ✱, the edges removed and added and the change in length), bypass and unchanged shown deliberately. Every number printed is the event's.

## Done when

- Rendered numbers equal the events for every pair and every individual of several generations, for each operator and for 5, 16 and 52 cities; geometry at both sizes at every micro-step of two generations (cards inside their panel, strips on one row up to 52 cities, narration inside its box); the other problems' views unchanged.

## Comments

Scope note: the ticket named the crossover and mutation cards, but the done-when clause (geometry at every micro-step, every stage) and the screenshots showed that the other stage views overflowed with tours (the tournament cards lost the start of their titles, the replacement columns overlapped, the narration printed whole tours). They are fixed here too, as the "brief" form below; no later ticket covered them.

## Answer

**Crossover cards** (`TourCrossoverCard.svelte`, notes in `tour-variation.ts`): parent A, parent B and each child as one strip of cities, in a cell of 30 px up to 16 cities, 22 up to 24, 20 up to 36, 16 up to 52 (`stripCell`); every strip stays on one row at both sizes. Per operator:
- **OX:** the head line says "cuts after positions 8 and 13 → slice = positions 9 to 13 (5 cities)"; the slice is outlined (A's solid, B's dashed); each child says whose slice it kept, where the fill starts and the cities filled, in the order they were taken (first eight, then "… (n cities)"); cities filled from the other parent are hatched.
- **PMX:** the same slice and cut line; the mapping (B's city at each slice position ↔ A's, first eight pairs); one conflict worked through its chain ("position 5 holds city 4 in A, but 4 is in B's slice → 4 ↔ 27: city 27 is free, so it goes there"); the cities that followed the mapping are marked ↻ and outlined, counted in each child's note.
- **CX:** "2 cycles: cycle 1 = 14 positions (1, 3, 9, …) · cycle 2 = 2 positions (10, 12)" (first five cycles); every city carries a line under it that names its cycle (solid 1, dotted 2, dashed 3, double 4 and later), as well as its position; each child says "cycle 1 from A, cycle 2 from B, …".
- **All:** the lengths of both parents and the children kept (a dropped second child has none, and says so), the key for the marks, the explanation with the sentence that one-point crossover would repeat and lose cities, and a bypass shown as BYPASS with copies ("a copy of A") and their lengths. Hatching means "taken from the parent that is not the child's own" (A for O1, B for O2), so a copy has none.

**Mutation cards** (`TourMutationCard.svelte`): "draw u = 0.441 < pm 0.6 (one draw per individual) → mutated", the move in words (swap the cities at positions i and j / reverse the slice from i to j / take the city at i out and put it at j), "positions drawn u₁ = …, u₂ = …", the strips before and after with the cities that changed marked ✱, "✕ removed 49–34, 39–52 · added … · length 29,028 → 29,039 (+11)". An individual that was not mutated says "draw u = 0.505 ≥ pm 0.4 → unchanged" with its length; with mutation off the card says BYPASS, "mutation is off: no draw".

**Narration** (`describe.ts`): the line under the panel gives the operator, the slice positions, the lengths, the move and the length change, never a whole tour ("Pair 6: u = 0.72 < pc 0.9 → OX, slice positions 9 to 13 → children 7,864 and 9,203"; "Offspring 1: u = 0.074 < pm 0.4 → reverse the slice from position 34 to 50: length 15,130 → 16,493 (+1,363)"); evaluation says the length, the gap and the fitness; tours in the setup lines are written briefly.

**Brief form** (`Bits form="brief"`): a 44 × 30 thumbnail with the first five and last two cities (a tour of up to nine cities is written whole), for the tournament, pairing, evaluation and replacement views and the drawer's hand-edited table; the whole route stays in the name. The names of marked tours say "positions", not "genes".

**Numbers are the events':** every card is built from the event alone (`tourPairNotes`, `tourMutationNotes`).

Tests: `tour-variation.test.ts` (20, hand-worked on the textbook parents: cuts, slice, fill, mapping, chain, cycles, bypass, dropped child, swap/inversion/insertion text, edges, lengths), `describe-tour.test.ts` (7), `tour-views.test.ts` (+7: strips, brief), `tour-cells.test.ts` (+3); `e2e/tsp-operators.spec.ts` (38): for OX, PMX and CX at 5, 16 and 52 cities and for swap, inversion and insertion likewise, every pair and every offspring of two generations is compared with the events (strips, data-bits, slice, followed positions, cycles, hatching, notes, lengths, the draws, the edges), the switched-off cases are checked, and at 1920×1080 and 1366×768 at every micro-step of two generations in all six stages the current card is wholly visible, strips are one row, nothing sticks out of its column, card or row, the stage body does not scroll sideways and the narration stays in its box. Mutation checks: ten mutants of the slice arithmetic, the fill and mapping text, the sign of the length change, the position wording and the narration each fail a test.

Not covered: the edge-agreement and the stats text under the plots are still the old ones (ticket 12); the route map's stage marks (ticket 11).
