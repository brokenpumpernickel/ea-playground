# 17 Accessibility and projector pass for the target string

Status: resolved
Type: task
Blocked by: 11, 12, 13, 14
Spec: ../spec.md

## What to build

Apply milestone 1's pass (ticket 22) to the new views: real tables, an accessible name and sentence for each chromosome (spelled letters, which positions match), a non-colour carrier for every colour-coded meaning, keyboard-only operation of a full generation, reduced motion, projector mode, no overflow at 1920×1080 and 1366×768 with the drawer open. Extend the colour-only audit list from ticket 22 with the new meanings (match, mismatch, replaced symbol).

## Done when

- The audit list is extended in this file and shows each colour-coded meaning with its non-colour carrier.
- Playwright: keyboard-only generation on the target string, the accessibility-tree check for unnamed controls with the problem menu and drawer open, reduced motion, no overflow in projector mode at both sizes.
- Screenshots at 1920×1080 (projector mode) and 1366×768 captured for ticket 19.

## Comments

## Answer

Milestone 1's pass (ticket 22) applied to the target string, with three real defects found and fixed along the way.

**Fixed while doing it**
- A chromosome of letters was named "Chromosome HI YO", which a screen reader says as words. It is now spelled and says where it matches: "Chromosome H, I, space, Y, O. 2 of 5 positions match the target (positions 1 and 5)". Binary chromosomes are named as before.
- The replacement view had three columns and overflowed sideways for an 11-letter target. For strings the old population is now left to the table beside the stage (this is the two-column replacement layout you accepted in the mock; it had not been built); the explanation says so and names the elites. Goldberg keeps three columns.
- "being made · micro-step 11 of 11" wrapped and was clipped in the top right once a population of 12 gave two-digit counts (it also affects Goldberg with a bigger population); it no longer wraps.

### Audit: colour-coded meanings added by milestone 2 and what else carries them

(The milestone 1 list in `milestone-1-goldberg/issues/22-projector-keyboard-a11y.md` still holds for everything that is not listed here.)

| Meaning | Colour | Non-colour carrier |
|---|---|---|
| Position matches the target | filled violet | heavy baseline under the cell, bold weight, solid outline, `data-matches`, and in the name "n of N positions match the target (positions …)" |
| Position does not match | plain | dashed outline, regular weight |
| Symbol replaced by mutation | orange | ✱ above the cell, thick outline, "✱ gene n: old → new (r = …)" text (a space as ␣), `aria-label` "gene n flipped" |
| Draw under a letter that flipped it | orange | outline round the number (the number itself and the ✱ above the letter) |
| Space symbol | none | drawn as ␣ and named "space" in the chromosome's name |
| Target (printed above the strings) | grey | the word "target" beside it, `aria-label` "The target is HELLO" |
| Match rate per position bar | violet | printed percentage and the target letter under each bar, the strip's `aria-label` lists them all |
| Current problem in the menu | bold | ✓ before the name and `aria-checked` |
| Alphabet / target field invalid | red border | the message under it, `aria-invalid`, `aria-describedby` |
| Crossover type unsuitable for the target | red border | the message under the type and a pointer beside the restart button |
| Stop reported (stagnation, target reached) | none | the status text names it |

Nothing in the new views is carried by colour alone.

**Tests** (`e2e/string-a11y.spec.ts`, 10 tests, plus the unit tests of the names):
- every chromosome in the table has role `img` and exactly the spelled name with the positions, equal to what the engine produced, including a string with a space;
- real table with named columns and a named target row;
- a full generation by keyboard alone starting from the problem menu (Tab, Enter, arrow, Enter, Tab to "Restart and apply", Enter, then Shift+→ through every stage);
- no control without a name with the problem menu open, the drawer open, the hand-edited editor and an invalid target showing; the setup fields are tied to their messages;
- match and miss by computed style (solid with a baseline versus dashed), a flipped gene by ✱, outline width and its "old → new (r = …)" text, the outlined draw;
- reduced motion: every transition and animation on the string screens is off;
- projector mode at 1920×1080 and 1366×768 with the target HELLO and with HELLO WORLD: after every stage, with the drawer open (with a hand-edited population) and with the problem menu open, the page does not scroll, the canvas is inside the window, no stage view scrolls sideways, and the menu is inside the window.

**Screenshots for ticket 19** are in `.scratch/milestone-2-target-string-and-links/screenshots/`, each at 1920×1080 and at 1366×768, both in projector mode: start, generation 4, tournament, crossover, mutation, evaluation, replacement, problem menu, drawer with an invalid target, drawer with a hand-edited population, the three presets (found at generation 65; no mutation at 22; mutation too high at 30) and Goldberg's drawer (unchanged). I looked at the replacement, crossover, mutation, drawer and preset screens.

State: 1015 unit tests, `npm run check` clean, 159 Playwright tests passing.
