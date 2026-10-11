# 10 Problem registry, problem menu and switching

Status: resolved
Type: task
Blocked by: 03, 08, 09
Spec: ../spec.md

## What to build

- A problem registry (data): id, name, the options it takes, its default configuration and seed, its per-problem presentation (columns, gene panel kind, whether it has a function plot).
- A "Problem" menu in the top-left brand area ("Goldberg x² ▾") listing the problems. Choosing one goes through the existing restart notice (naming what is lost) and loads that problem's default configuration and seed; cancelling changes nothing. The share-link configuration carries the problem id, and the link codec's problem list comes from the registry.
- Keyboard accessible, with an accessible name, in all themes and projector mode, without breaking the brand area's layout at 1366×768.

## Done when

- Playwright: switch to the target string and back; the notice names what is lost; cancel changes nothing; the defaults of each problem load; the previous problem's configuration is not carried over; the problem menu is operable by keyboard.
- Unit tests for the registry and the codec's use of it.

## Comments

## Answer

- **Registry** (`src/ui/problems.ts`, data): for each problem its id, name, logo, subtitle, whether it takes options, default options, an options validator (for anything that came from a link), how to build the engine problem, and the configuration it opens with (population, parameters, seed). Goldberg opens as before; the target string opens with `HELLO`, population 12, tournament 3, pm 0.1 and seed 42. Adding a problem is adding an entry; presets, links and the menu read the same list.
- **Problem menu** (`ProblemMenu.svelte`) in the brand area: the problem's name as a button with a ▾ (`aria-haspopup="menu"`, `aria-expanded`), a menu of radio items with the current one checked and focused on opening, Arrow keys, Home, End, Enter, Escape (returns focus), a click outside closes it, and the arrow keys inside it never reach the stepping shortcuts. The logo tile, the subtitle ("Match “HELLO” · 27 symbols") and the population table's columns follow the problem.
- **Switching** is a reset through the existing restart notice ("Switching to the problem Target string restarts the run from generation 0 and discards the 2 recorded generations (1–2)."), loading the other problem's defaults; cancelling changes nothing; choosing the running problem or an unknown one does nothing; nothing of the previous problem (parameters, options, preset label) is carried over.
- **Links**: a configuration now has an optional `options` (the string problem's alphabet and target), required for a problem that takes them and refused for one that does not, so every link made before this change still opens; the problem list in the "unknown problem" message comes from the registry. The share link carries the running problem and its options.
- **Presets** shown in the drawer are those of the running problem (the section is hidden when there are none, as for the target string until ticket 15).

Evidence: unit tests for the registry (defaults of both problems run and validate; fresh option copies; option validation in words), for the codec with options (round trip, every bad-options case, a Goldberg link without options still valid, options refused for Goldberg, a typed population checked against the alphabet, elites against the string problem's own size), and for the session (confirm, cancel, switching back, starting from a string configuration); `e2e/problem.spec.ts` (8): the menu and its roles, the notice and cancel, the string problem's defaults compared with the engine's run for three generations and its own column ("Fitness = matches", "n of 5"), nothing carried over when switching back, presets per problem, a copied string link opening the string problem with the same population, keyboard operation, and the menu fitting at 1366×768 in projector mode. All 944 unit tests, `npm run check` and the 101 Playwright tests pass (the keyboard-order test now expects the problem menu as the first stop).

Left for later tickets, as planned: marking matches (11), crossover and mutation for letters (12), the match-rate panel (13: the bottom strip still shows "Share of 1s per gene" for this problem), and the alphabet and target fields in the drawer (14).
