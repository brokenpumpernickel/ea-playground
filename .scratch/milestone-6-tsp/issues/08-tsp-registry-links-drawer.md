# 08 TSP in the registry, links and the drawer

Status: resolved
Type: task (test-first)
Blocked by: 06, 07
Spec: ../spec.md

## What to build

The problem menu gains **TSP** (logo `Ts`) with its own defaults (provisional until ticket 13), seed and restart notice; the drawer's setup section (the instance grouped by size with its information line, n for the circle, n and the seed for the random one, the instance's optimum and nearest-neighbour length, the TSPLIB attribution), the crossover type (OX, PMX, CX) and probability, the mutation type (swap, inversion, insertion) with its per-individual probability and the sentence saying so, stop criteria including "within ε of the optimum", and the usual pending-change and restart rules; the operators not valid for a permutation are not offered; share links carry the instance and its options and parameters and a hand-edited population exactly; every bad-option case gets a readable message and applies nothing; presets of the other problems unchanged.

## Done when

- Menu, drawer, restart notice, links and validation tests as for the landscape; an operator that does not exist for the representation is refused in the drawer and in links in words; every control has a name; the other problems' menus and links are unchanged.
- Playwright: choosing TSP through the menu restarts through the notice, each control restarts or waits as its label says, a link opens the same run in a fresh page.

## Comments

## Answer

TSP is the sixth problem (logo `Ts`, line under the name "16 cities · optimum 6,859", chip = the instance) and the drawer, links and validation know it. The views are still provisional (tours show as city numbers, the gene panel is headed "Edge agreement" but is still the old one) until tickets 09–12.

- **Registry** (`problems.ts`): entry `tsp` with `validateOptions` / `validateOptionFields` (instance, cities, citySeed), `defaultsFor` from the engine's `tspDefaults` (random population of 12, OX at 0.9, inversion at 0.4 per individual, ε for the instance: 0.5 for the whole-number rules, 0.000001 for the own ones). Defaults and the default instance (`ulysses16`) stay provisional until ticket 13.
- **Operators** (`run-config.ts`): ox/pmx/cx and swap/inversion/insertion are accepted in links; a permutation problem with a symbol or real operator, a symbol problem with a permutation one, a missing mutation operator and per-gene mutation on a permutation are all refused in words (the same sentences in the drawer, `validate`, and in links).
- **Drawer** (`drawer-model.ts`, `Drawer.svelte`): instance select grouped as own instances / TSPLIB, number of cities (circle, random), instance seed (random), a help line with comment, distance rule, optimum (published or exact), nearest-neighbour length and attribution; the crossover list shows only OX/PMX/CX, the mutation shows a Type (swap, inversion = 2-opt move, insertion) instead of a Mode, with the per-individual sentence; ε help generalised. Instance, cities and instance seed restart through the notice; moving between whole-number and real distances moves ε to the new default and the notice says so (a typed ε is kept). Operator types and probabilities wait for the next generation and show as pending (this needed `changes()` to recognise a permutation problem without its options, which is how the session reads the waiting parameters back).
- **Hand-edited population**: typed as tours (spaces, commas, semicolons or lines), checked in words ("Chromosome 2: city 2 appears twice; city 3 is missing.", wrong count, stray characters); a rotation or reversal of a tour is one tour for "distinct".
- **Links**: round-trip and open as the same run (populations, events, metrics) for every instance and every operator pair; every bad-option case is said in words and applies nothing.
- **Provisional views**: `Bits.svelte` shows a tour as its numbers (not character cells) through a `tour-context`; the other problems render as before.
- **Engine detail**: the TSPLIB JSON imports carry `with { type: 'json' }` so Playwright's Node loader can read the engine too.

Tests: 47 unit tests in `problems-tsp`, `drawer-tsp`, `run-config-tsp` (plus the six older files updated for a sixth problem); `e2e/tsp-drawer.spec.ts` (10: menu and restart notice, setup rows, operators offered, instance change restarts, ε move, operators wait, hand-edited tours, links for four instances, refused link, every control named); the three menu assertions in `problem.spec.ts`, `trap-link.spec.ts` and `landscape-drawer.spec.ts` now list six. Mutation checks: ε-default move, ε-enabled guard, and the permutation-without-options label each fail a test. Unit suite 2059/2059, `npm run check` clean.
