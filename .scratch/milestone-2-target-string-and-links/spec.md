# Milestone 2: share links and the target string

Status: ready-for-breakdown

Vocabulary follows `CONTEXT.md` (including the new **Share link** and **Alphabet** entries). Architecture follows ADRs 0001–0003 in `docs/adr/`. Where this spec and those disagree, the ADRs and glossary win and this spec is wrong. Milestone 1 (`.scratch/milestone-1-goldberg/spec.md`) is complete and signed off; this spec builds on it and must not change what it does.

## Problem

An instructor who has prepared a scenario (a configuration, a seed, a hand-edited population) can only hand it to students by describing it, so students rarely see the same run the instructor saw. And the app teaches one example whose chromosome is a handful of bits, so students never see a genetic algorithm working on a representation they would recognise from their own code: a string of characters.

## Goal

1. **Share links**: any configuration can be copied as a link that anyone, on any machine, opens to get the identical paused run at generation 0.
2. **The target string example**: evolve a string toward a chosen target over a chosen alphabet, with matching and mismatching characters highlighted and the mutation and crossover of characters explained, on the same engine, history, playback and view stack.

The second goal is the first real test of the promise made in milestone 1: that the engine and run layers host the other examples without rework. The run layer (ADR 0003) must not change at all. The engine changes only where it assumed a gene is a bit.

## Scope

### In

**Share link** (UI and configuration; no engine change)
- A "Copy link" action in the parameter drawer copies a URL whose hash holds the complete configuration: problem and its options, setup (random or explicit initialization, population size or the hand-edited chromosomes), every parameter, and the seed. Pending (not yet applied) changes are applied first.
- Encoding: the URL hash, `#v1.<payload>`, where the payload is the configuration as compact JSON, UTF-8, base64url. The hash is never sent to a server and works from `file://` and any static host. The link is built from the page's own address, so it works on whatever host serves the app.
- Opening a link starts a fresh, paused run at generation 0 with that configuration and seed. It carries no history, cursor position or playback state. It never starts playing.
- Validation reuses the parameter drawer's validation, so a link can only ever produce a configuration the drawer would accept. A link that is malformed, has an unknown version or problem, has unknown keys, or fails validation opens the default Goldberg configuration and shows one message naming everything that is wrong. Nothing from a bad link is applied partially.
- After a link has loaded, the `#…` part is removed from the address bar (`history.replaceState`), so a reload or bookmark does not silently reset the run to the link's state.
- If the clipboard cannot be written, the link is shown in a text field to select. If the link is longer than about 2,000 characters (a large hand-edited population), the action says so, since some chat and mail tools break long links.
- On `file://` the action still works and says the link only opens on this machine's copy of the app.
- The configuration is one serialisable value with a `v` field and a problem id; presets (whose files already hold a configuration and seed) are the same shape plus a name and text.

**Engine: genes are alphabet indices** (DOM-free TypeScript, test-first; see ADR 0002)
- A gene is a small whole number, its position in the problem's **alphabet**. A problem declares its alphabet (symbols, in order) and how a gene is shown. Binary is the alphabet `0, 1`. `Chromosome` stays a readonly array, now of gene indices. Crossover (one-point, two-point, uniform), pairing, selection, weight chains, elitism, truncation, replacement, stop criteria and the whole run layer treat genes as opaque and do not change.
- **Binary runs are unchanged.** For every configuration milestone 1 supports and every seed, populations, events and metrics are identical to before. This is guarded by golden-run tests recorded before the engine is touched (see Verification).
- **Random initialization** draws one number per gene; the symbol index is `k − 1 − ⌊u·k⌋` for an alphabet of k symbols, which for k = 2 is exactly today's rule (a gene is 1 when its draw is below 0.5).
- **Mutation** replaces a mutated gene with one of the *other* symbols, so a mutated gene always visibly changes. For an alphabet of exactly 2 symbols the replacement is forced and no extra draw is made. For k > 2 each mutated gene costs one extra recorded draw `r` after the draws that decided it; the replacement is the `⌊r·(k−1)⌋`-th other symbol, in alphabet order. This holds in both modes: per-gene (one draw per gene, then `r` for each gene that flips) and per-individual (the individual draw, then the draw that chooses the gene, then `r`). Events record the draws, the old symbol and the new one.
- **Metrics**: diversity (mean pairwise normalised Hamming distance) is computed from per-position symbol counts, which gives identical values for binary. Per-position symbol counts are added to the metrics; the existing allele frequencies remain for binary problems.
- `Scores.decoded` becomes a number or a string. A `Problem` declares the columns the population table shows and their headers (Goldberg: `x`, fitness; target string: matches, fitness), and an optional `landscape` as before.

**Problem: target string**
- Chromosome length is the target's length. The **alphabet** and **target** are configurable; both are part of the setup, so changing them is a reset.
- Default alphabet: `A`–`Z` and space (27 symbols). Default target: `HELLO WORLD`. Limits: target 1–24 characters, alphabet 2–40 distinct symbols, every target character in the alphabet, population up to the existing 500 (with the existing warning). Symbols are case-sensitive as typed. A space is shown as `␣` inside cells.
- Objective value is the number of positions equal to the target; fitness equals the objective (identity rule, shown as such). Known optimum: the target's length.
- Defaults: population 12, one-point crossover with pc 0.8, per-gene mutation with pm of about 1/length (0.09 for the default target), no elites, roulette with Identity. Stop: generation limit 100, target reached (every position matches), stagnation window 15. Fitness can be zero for every individual; the existing automatic switch to Shift handles that and says so.
- A hand-edited initial population is typed as strings and validated against the alphabet and the length, with a message naming the character or chromosome that is wrong.

**Problem selection and presets**
- A "Problem" menu in the top-left brand area ("Goldberg x² ▾") lists the problems. Choosing one goes through the existing restart notice and loads that problem's default configuration and seed.
- Preset files gain a `problem` field and the preset menu shows only the current problem's presets. Choosing a preset of another problem switches the problem (through the same notice). The four Goldberg presets keep their seeds and verified behaviours.
- Target string presets, each with a seed verified by a test as milestone 1's were, and each description claiming only what holds for its seed:
  1. **Evolve a word**: the defaults, converging to the target.
  2. **No mutation**: a letter missing from the initial population can never appear, so the run stalls short of the target.
  3. **Mutation too high**: the population never settles; best of generation falls below best so far. It is only described as failing if a verified seed actually fails.

**UI for the target string**
- Chromosome cells show letters. Matching positions are marked as matches without relying on colour (the mock decides the exact marks; the starting proposal is a filled cell with a ✓ for a match and the target letter in small type under a mismatch). The same cells serve the population table, crossover cards (inheritance hatching and cut points), the mutation view (flipped gene marked with ✱ and shown as `old → new`, with the replacement draw `r` when k > 2), the evaluation view and the replacement view.
- The population table, evaluation view and hand-edited population table take their columns and headers from the problem's declaration. Weight and probability columns are unchanged.
- The bottom strip: fitness and diversity plots as today; the gene-share panel becomes **Match rate per position** (for each position, the share of the population that has the target's letter there). Goldberg keeps "Share of 1s per gene". The function plot toggle is offered only to problems that declare a landscape.
- The drawer's run setup gains the alphabet and target fields for the target string (with live validation), and the hand-edited population editor uses the problem's alphabet.
- Everything from milestone 1's accessibility pass applies to the new views: real tables, an accessible name and sentence for each chromosome (spelled letters, which positions match), a non-colour carrier for every colour-coded meaning (the audit list in ticket 22 is extended), keyboard operation, reduced motion, projector mode, and a layout that works at 1920×1080 and 1366×768.

**Hosting**
- One ticket: a documented build-and-publish workflow for GitHub Pages, so a copied link opens for anyone. Publishing is outward-facing, so the workflow is added and run only with the instructor's explicit go-ahead.

### Out

- The other three examples (knapsack, deceptive trap, 2-D landscape), later milestones.
- Servers, accounts, short links, saved runs, or any runtime network request. A link is the whole state.
- Links that carry history, the cursor position or playback state.
- Keeping the address bar in sync with the settings as they change.
- Real-valued or permutation representations, and TSP (still deferred).
- Mutation operators for characters other than "replace with a different symbol", and crossover operators other than the three existing ones.
- Per-position or per-gene mutation rates.

## Acceptance criteria

1. **Binary is untouched.** Every milestone 1 test passes (apart from mechanical type renames), and golden runs recorded before the engine change reproduce exactly afterwards: populations, events and metrics for the default configuration and the four Goldberg presets, in both mutation modes, with and without elites, truncation, tournament, and each crossover operator. The four Goldberg presets still behave as their descriptions say.
2. **Alphabet mutation.** A mutated gene never keeps its old symbol. For k = 2 no extra draw is made; for k > 2 exactly one recorded replacement draw follows each mutated gene, in the stated order, in both modes. Over many draws the replacement symbols are uniform over the other k − 1 symbols and the mutation rates match the configured probability within a stated tolerance.
3. **Target string numbers.** Fitness is the count of positions equal to the target, checked on hand-worked examples (including all matching, none matching, repeated letters, a space). The known optimum is the target's length. All-zero fitness switches the chain to Shift and says so.
4. **String operators.** Crossover and mutation bypass, copy-independence, odd mating pool, elitism, truncation and size invariants hold for strings exactly as milestone 1's criteria 4 and 6 state for bits.
5. **Reproducibility and agreement.** A seeded target-string run is identical by micro-step, stage, generation and run-until and at every playback tier, and replaying a generation's events reproduces the population (milestone 1's criteria 2 and 3, for strings).
6. **Share-link round trip.** For every preset (both problems) and a set of generated configurations (including a hand-edited population and non-default parameters), encoding then decoding gives a configuration equal to the original, and a run opened from the link has populations, events and metrics identical to the original run with the same seed.
7. **Bad links.** Each of these opens the default Goldberg configuration with one readable message naming what is wrong and applies nothing partially: not base64url, not JSON, unknown version, unknown problem, unknown key, wrong type, a value the drawer would reject (for example pc 1.5, a target character outside the alphabet), a truncated link, an empty payload. The address bar is cleared after any load. A link never starts playback.
8. **Problem switching.** Choosing a problem shows the restart notice, loads that problem's defaults and seed, and shows only its presets; the previous problem's configuration is not carried over; cancelling changes nothing.
9. **Views.** For the target string: matches are marked without relying on colour; the mutation view shows `old → new` and the replacement draw; letters, spaces and the ✓/✱ marks have accessible names; match rate per position equals the population's actual matches; diversity equals the pairwise definition. Goldberg's screens and plots are visually and textually unchanged.
10. **Hosting and rendered review.** A copied link opens correctly on the published site. In a real browser at 1920×1080 in projector mode, a full target-string generation can be stepped through, every label is legible at a distance, and no colour-coded meaning relies on colour alone; the layout is also checked at 1366×768. The instructor signs off.

## Verification approach

- **Golden runs first.** Before any engine change, record the output (populations, events, metrics) of fixed seeds across the binary configurations listed in criterion 1 as test fixtures. They are the safety net for the generalisation and are kept afterwards.
- Vitest unit tests, test-first through public interfaces: alphabet handling, the initialization and mutation rules including draw order, target-string scoring and validation, per-position metrics, the configuration codec (round trip, every bad-link case), the link and preset validators.
- Statistical tests for criterion 2's rates and uniformity (as milestone 1's rate tests).
- Property-style round-trip tests for the codec over generated configurations.
- Playwright for the scripted scenarios: copy a link, open it in a fresh page and compare the run with the engine's; open each kind of bad link; switch problems; run the target-string presets and check each description's claim; keyboard-only generation on the target string. 1080p and 1366×768 screenshots reviewed by a person.
- Presets are verified by tests that run each preset's seed and assert exactly what its description says.

## Build sequence

1. Throwaway static mock of the target-string screens at 1920×1080 with hand-made data (letters, match marks, population table, crossover and mutation views, match-rate panel, problem menu), reviewed by the instructor. It settles the match marks and reveals what the views need. Can run in parallel with step 2.
2. Golden-run fixtures, then the configuration schema (with version and problem id) and the share link on Goldberg.
3. Engine: genes as alphabet indices, binary identical.
4. Target string problem and its metrics.
5. UI: problem declaration of columns, problem menu, the target-string views, drawer fields.
6. Target string presets with verified seeds, and the link extended to the new problem's options.
7. Hosting workflow (with the instructor's go-ahead).
8. Rendered review and sign-off.

## To decide during implementation (record the choice here when made)

- ~~Exactly how a match is marked without colour.~~ **Decided (ticket 01):** the target is shown once above the columns; matching cells are filled with a heavy baseline and mismatching cells have a dashed outline. The space symbol stays `␣`. Layouts: one merged fitness column in the population table, per-gene draws under each letter in the mutation view, and a two-column replacement view that leaves the old population to the table.
- The seeds for the three target-string presets (found by search and verified, as in milestone 1).
- Names of the new engine interfaces (the alphabet declaration, the problem's column declaration).
- Whether to write an ADR for "genes are alphabet indices" when the engine ticket lands. It is hard to reverse, surprising without context, and the result of a real trade-off, so it probably should be.
- The link-length warning threshold (starting at 2,000 characters) after trying real hand-edited populations.
- Whether the symbol shown for a space (`␣`) is legible at projector size.

## Comments
