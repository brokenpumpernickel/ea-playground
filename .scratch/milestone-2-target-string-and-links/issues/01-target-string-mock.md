# 01 Throwaway visual mock of the target-string screens

Status: resolved
Type: prototype (needs instructor review)
Blocked by: none
Spec: ../spec.md

## What to build

A static HTML/CSS/SVG mock at 1920×1080 with hand-made data, reusing the Studio look of milestone 1 (`.scratch/milestone-1-goldberg/mock/studio.html`). No engine, no framework. Default configuration: target `HELLO WORLD`, 27-symbol alphabet, population 12, a generation in progress. Show, as separate screens or states:

- The full layout with the problem menu in the brand area ("Target string ▾").
- The population table with letter cells, the matches column and fitness, with matching and mismatching positions marked. Try at least two ways of marking a match without relying on colour (for example a filled cell with ✓, and the target letter in small type under a mismatch; or a baseline tick) and recommend one.
- The crossover cards (inheritance hatching and cut points on letters) and the mutation view (per-gene draws, a flipped gene shown as `old → new`, the replacement draw `r`, a bypass).
- The evaluation and replacement views with letters.
- The bottom strip with fitness, diversity and **Match rate per position**.
- The drawer's run setup with the alphabet and target fields, including an invalid target (a character outside the alphabet).
- How a space looks in a cell (`␣`), at projector size, and at 1366×768.

Use roughly 20 px body text at 1080p, and give every colour-coded meaning a symbol or pattern.

## Output

- The mock under `.scratch/milestone-2-target-string-and-links/mock/` (thrown away afterwards).
- The instructor has chosen how matches are marked, and whether `␣` is legible.
- A short list under `## Answer` of what the views need from the engine's events and metrics (for example, "the mutation view needs the old and new symbol and the replacement draw").

## Done when

The instructor has reviewed the mock and chosen how matches are marked, and the list of what the engine and views need is written under `## Answer`.

## Comments

## Answer

Open `mock/index.html` in a browser (it is a single page using the app's own stylesheet; the bar at the top switches screen, marking variant, theme and projector mode). Screenshots of every state are in `mock/screenshots/`.

### What the mock shows

Selection, crossover, mutation, evaluation and replacement for the default configuration (target `HELLO WORLD`, 27 symbols, population 12), the bottom strip (fitness, diversity, **Match rate per position**), and the drawer with an invalid target (a comma outside the alphabet), the alphabet field, the preset menu and Copy link. The brand area shows the problem menu ("Target string ▾").

### The two ways of marking a match (the choice the instructor must make)

- **A: ✓ or the target letter under every cell.** Matching cells are filled and bold, and under each cell is a ✓ (match) or the target's letter (mismatch). Very explicit, but it doubles the height of every chromosome row. A crossover card needs about 330 px for two parents and two children, so the second pair no longer fits without scrolling, and it cannot be used inside the population table at all (12 rows would not fit).
- **B: the target shown once, matches marked by fill and a heavy baseline.** The target is printed once, aligned above the columns (table header, crossover card, mutation and evaluation lists). Matching cells are filled with a heavy baseline; mismatching cells have a dashed outline. No row gets taller, so everything fits, and the reader compares each letter with the one above its column. No colour is needed (fill, baseline and dashed outline differ).

**Recommendation: B**, because A does not fit the existing layouts. A hybrid is possible: B everywhere, plus A's ✓ and target letter only in the (large) crossover cards if you want it there.

### What the mock revealed for the engine and views

- **Population table**: with 11 letters per row the table is too wide with the milestone 1 columns. In the mock it fits by merging "Matches" and "Fitness" into one column (the two numbers are always equal for this problem: "7 of 11", with "= matches" under the header). The problem's column declaration (ticket 05) must therefore let a problem declare one column, not two, and a header note.
- **Mutation view**: a column per gene plus a result column (milestone 1's table) is far wider than the stage panel for 11 genes. The mock instead puts each gene's draw u *under its cell*, the result row below it with the flipped gene marked by ✱ and its outline, and the `X → G (r = 0.26)` label. Four offspring fit; more scroll. Events need the replacement draw `r`, the old symbol and the new one per mutated gene (ticket 06 already records them).
- **Replacement view**: three columns of 11 letters do not fit. The mock shows two (offspring with survive/discard, and the next population with the elite first) and mentions the old population in the explanation, since the table on the right already shows it during this stage. The view model must therefore not require the old population list.
- **Crossover cards** work as they are (hatching and the cut line carry over to letters); with variant A they get too tall.
- **Match rate per position** fits as bars with a percentage and the target letter under each bar. Diversity needs a label that says "mismatch" not "Hamming" for this problem.
- **Space** is shown as `␣`; at normal size it is small but readable in the large cells and faint in the small table cells. The instructor should judge it on a projector (the mock has a projector switch). Alternatives if it is not legible: a bold `·`, or a boxed `␣` with a thicker stroke.
- **Problem menu and drawer**: the brand area has room for "Target string ▾" and a one-line subtitle. The drawer's setup section fits the target, alphabet, population size and seed; a 27-symbol alphabet field is wider than its box and needs a longer input (or a wrapped one).

### Decisions needed from the instructor

1. Marking: A, B, or B with A's ✓ in the crossover cards only?
2. Is `␣` legible enough at projector size, or should the space symbol change?
3. Do the three layout changes above (one fitness column, draws under cells in the mutation view, two-column replacement) look acceptable?

### Instructor's decisions

1. **Marking: B.** The target is printed once, aligned above the columns; matches are filled with a heavy baseline, mismatches have a dashed outline. No ✓ or target letter under cells (not even in the crossover cards).
2. **`␣` is legible enough** at projector size; the space symbol stays `␣`.
3. **The three layout changes are accepted**: one merged fitness column ("7 of 11", "= matches" under the header), draws under each letter with the result row below in the mutation view, and a two-column replacement view that leaves the old population to the table on the right.

Tickets 11 and 12 follow these decisions.
