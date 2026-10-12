# 16 Accessibility and projector pass for the landscape

Status: resolved
Type: task
Blocked by: 08, 09, 12, 13, 15
Spec: ../spec.md

## What to build

The pass of milestones 1–4 on the new screens: names and sentences for individuals, the heatmap and the surface, real tables, the colour-only audit extended with the new meanings (markers and their shapes, elites, best, selected, parents, children, mutated, trails, isolines and the colour scale, the optimum marks, minimised-function labels), keyboard-only operation of a full generation with the landscape view open including the surface controls and the marker selection, no control without a name with menu, drawer and view open, reduced motion, and no overflow or overlap at 1920×1080 and 1366×768 in projector mode for every stage, the landscape view, the drawer and the menu, for both representations, 12 and 60 individuals and each function. Carry over milestones 3 and 4's lessons: geometric tests of overlap, clipping and width stability at every micro-step of several generations (narration included), rows inside cards and not only scrolling regions, run with extreme data. Capture screenshots for ticket 17.

## Done when

- The audit list is extended in this file with each colour-coded meaning and its non-colour carrier.
- Playwright: keyboard-only generation, accessibility-tree check, reduced motion, geometry tests at both sizes for the cases above.
- Screenshots at both sizes are under `.scratch/milestone-5-landscape/screenshots/`.

## Comments

## Answer

`e2e/landscape-a11y.spec.ts` (30 tests, all passing) and 28 screenshots in `.scratch/milestone-5-landscape/screenshots/`: 14 states at 1920×1080 in projector mode (`1920-NN-*.png`) and the same at 1366×768 (`1366-NN-*.png`): the start, every stage of a generation with the real pair (selection to replacement), the landscape view with trails, zoomed and rotated, with an individual selected, the Gray-coded 12-bit mutation cards, the Himmelblau landscape view, the drawer with a preset, and the menu.

### Colour-only audit

| Meaning | Colour | Carried also by | Checked by |
|---|---|---|---|
| Individual / elite / best of the generation | marks | ● circle / ◆ diamond / ★ star, each with its number beside it (up to 16 individuals, beyond that only the ones that matter); in the table ★ for an elite and the "×n" count; the key line and the sentence name them | shapes contain diamond and circle and no other than the three; every label starts with the individual's number; the key text lists the words |
| Parent A / B of the pair under way | marks | ▢ square with the letter A, B or AB, and the pair's sentence in the narration | a lettered square exists at the crossover stage |
| Offspring | marks | ▲ triangle; the one being mutated has an arrow from where it came from; a gene clamped to the bound has ▮ in its label and "clamped to the bound" in its name | marks tests (ticket 12), unchanged |
| Selected individual | ring colour | a ring and a cross around the mark, the id button pressed (`aria-pressed`, bold and underlined number in the table), the sentence "Individual n is selected: …" | one ring and one cross; the sentence contains "is selected"; the button is pressed |
| Mark hidden behind a ridge of the surface | faint mark | a dashed ring (`stroke-dasharray`) and no label | the style rule has the dash |
| Trails: earlier generations | fading dots | smaller dots, fading with age, and a toolbar group named "Trails: earlier generations as fading dots" with the number of generations on its buttons. *Limit:* the age of one dot is only its lightness; the positions table lists the current population only | dots smaller than marks; the group is named |
| Fitness on the heatmap and the surface | colour ramp | on the surface also the height; the colour scale and the isolines carry numbers; the sentence states the range, the optimum's place and "higher is better"; the optimum is marked ✕ and named in the sentence | sentence for every function, equal to the heatmap's text alternative |
| Minimised functions (fitness = −f) | – | "fitness = −f" in the figure caption, the table column note, the legend of the fitness plot, the optimum label, and "f is minimised, so fitness = −f and higher is always better" in the sentence | caption, legend and sentence for Rastrigin |
| Spread of x and of y | bar length | the figure printed beside the bar, the caption, the last six generations printed | metrics tests (ticket 13) |
| Decoded and Hamming diversity | two lines | solid line with ● against dotted line with ◇, named in the legend and the hidden table | metrics tests (ticket 13) |
| The two variables of a binary-coded chromosome | grouping | the labels "x · n bits" and "y · n bits" over the groups, a gap between them, and the sentence of the variable row | table tests (ticket 8) |

### Other checks (all in `landscape-a11y.spec.ts`)

- Every chromosome in the table is a `role="img"` named by its numbers ("Chromosome x = 2.406, y = −0.289"); the picture sentence is the heatmap's text alternative; the surface and the heatmap's marks are named groups; the hidden table of positions (Individual, x, y, Fitness, Role) equals the engine's population, number by number.
- Keyboard only: Tab to the problem menu, four Down arrows to Landscape, Enter, Restart and apply; Tab to the Landscape tab and Enter; Tab to the heatmap's marks and the arrow keys select individuals (the id button follows); Tab to the surface and the arrow keys turn it (its pixels change); then every stage of a generation with the stage shortcut, to generation 1 with all six stages done and the landscape view still open.
- No control without a name with the menu, the drawer, the landscape view, a selection and trails open, for the real and the Gray-coded representation.
- Reduced motion: every transition duration is 0 s, no animation runs (`document.getAnimations()` is empty) on the stage view or the landscape view, with trails and a rotated surface.
- At 1920×1080 and 1366×768 in projector mode, for six cases (every function; real, plain and Gray; 12 and 60 individuals; extreme data with both bounds, zero and duplicates; Rastrigin Gray at 12 bits): after the start, after a generation, inside each of the six stages, with the landscape view (also zoomed, with 5-generation trails), the drawer and the menu open, nothing overflows the page, no two panels overlap, nothing scrolls sideways, nothing leaves its panel and the menu stays on screen; and the narration stays inside its box at every micro-step of two generations.

### Found and fixed in this pass

- **Mutation cards with more than 20 bits.** With 12 bits per variable (24 genes) the draws under each gene (0.242 and so on) made the cards 112 px wider than their panel, so the last genes' draws were cut off at both sizes. Above 20 genes a binary-coded landscape now prints only the draws that flipped a gene (as .04), as the trap already did, in narrower columns (`draw-text.ts`, unit-tested at the threshold; `.bits.vars.crowded`). Found by the extreme-data case; it would have shown to any student who chose 11 or 12 bits.
- The key line and the sentences under the pictures are 14 px in projector mode instead of 13 px (the stage still fits at both sizes).
- Not changed: the header subtitle of Himmelblau wraps onto two lines ("optimum f = 0 (4 places)"); it fits its box and is left for the instructor's review in ticket 17.

`npm run check` clean; 1889 unit tests and the whole Playwright suite pass.
