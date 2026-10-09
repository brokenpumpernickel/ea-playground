# 22 Projector mode, keyboard control, accessibility pass

Status: resolved
Type: task
Blocked by: 15, 16, 17, 18
Spec: ../spec.md

## What to build

- Projector mode: larger base font (about 20 px body text at 1080p) and heavier lines, switchable and remembered in local storage (guarded, since storage can be unavailable). The layout also works at 1366×768 without scrolling during a demo.
- Keyboard control for stepping and playback (run/pause, next micro-step, next stage, next generation, previous stage), with the keys labelled on screen. Choose the bindings and record them in the spec.
- A colour-blind-safe palette, and the symbol set for elite, parent, offspring, mutated gene and bypass (record it in the spec). Audit every colour-coded meaning in the table, stage views and plots for a symbol or label.
- Reduced-motion handling: with the setting on, animation becomes instant state changes with the same highlights.
- Real table markup, visible focus states, and accessible names on all controls.

## Done when

- An audit list in this file shows each colour-coded meaning and its non-colour carrier.
- Playwright checks keyboard-only operation of a full generation and the reduced-motion behaviour.
- Screenshots at 1920×1080 (projector mode) and 1366×768 are captured for ticket 23.

## Comments

## Answer

**Keyboard** (`src/ui/shortcuts.ts`, recorded in the spec): → micro-step, ← back, Shift+→ end of stage, Shift+← end of the previous stage, G next generation, Space run/pause, labelled on the buttons. Ignored while typing, inside dialogs, and where the focused control uses the key. Tested as a table of cases (13) and in the browser: a whole generation stepped by keys alone, Space starting and pausing a run, Tab order and visible focus, Enter opening the drawer and Esc closing it, no shortcut firing while typing in a drawer field, and the history bar keeping the arrow keys.

**Projector mode**: the A⁺ button (a pressed/unpressed switch) gives larger text and heavier lines (bigger body and table text, 3 px borders on buttons and genes, thicker plot lines), remembered in `localStorage` behind a try/catch, and working when storage is blocked. To make it fit I also had to repair the toolbar: with the key hints added it was 250 px wider than the 1920 px canvas in both modes. It is now one row at both sizes, with a long status message ellipsised (full text in a tooltip). Tested at 1920×1080 and 1366×768 with the drawer open: no page overflow, canvas inside the window. Screenshots for ticket 23 are in `.scratch/milestone-1-goldberg/screenshots/` (selection, crossover, mutation, replacement and drawer, projector mode, both sizes).

**Reduced motion**: the setting (from the operating system) turns the pin sweep into an instant placement with the same highlights (`data-animated="false"`, tested in both settings); a global rule also removes any CSS transition or animation.

**Tables and names**: all tables use real table markup; focus is outlined on every control (`:focus-visible`); a Playwright test reads the accessibility tree with the drawer closed and open and fails if any button, field, slider or switch has no name. The icon-only buttons (reset, previous stage, new seed, theme, projector) carry `aria-label`s and tooltips; the speed slider is styled as four stops with a thick track and large thumb.

### Audit: every colour-coded meaning and what else carries it

| Meaning | Colour | Non-colour carrier |
|---|---|---|
| Gene is 1 / 0 | filled violet vs plain | the printed digit, bold weight and heavier border on 1 |
| Gene inherited from parent B | tinted | hatched fill, key line, `aria-label` "gene n from parent B" |
| Cut point | none | dashed vertical line and "cut after gene n" text |
| Mutated (flipped) gene | orange | ✱ marker, thick outline, "✱ gene n: 0 → 1" text, `aria-label` "gene n flipped" |
| Crossover recombined / bypassed | green / grey | ✓ "recombined" vs ⤼ "BYPASS" (dashed badge) and the sentence with u and pc |
| Mutation unchanged / bypassed | grey | the word "unchanged" or "⤼ bypassed: mutation is off" |
| Elite | green | ★ and the word "elite" |
| Parent (picked n times) | none | ◆ ×n |
| Survives / discarded / replaced | green / dimmed | ✓ survives, ✕ discarded or replaced, rank text, dimming |
| Tournament winner | green | ✓ and "winner: individual n" |
| Current step (row, card, chip) | violet tint | ▸ marker, underlined chip, `aria-current`, "Micro-step n of m" narration |
| Stage ribbon: done / current / next | filled | ✓ vs number, `aria-current="step"` |
| Pending setting | orange | the word "pending" and "was → now" |
| Invalid field | red border | error text in words, `aria-invalid` |
| Plot series | three hues | marker shape (circle, square, triangle), solid vs dashed line, legend naming each |
| Min–max band | blue tint | ▒ in the legend, and its edges coincide with the best line (top) and the lowest fitness (bottom); the same numbers are in the hidden table |
| Later generations (future) | dimmed | the "now" line labelled "now" and `data-future` |
| Optimum | grey dotted | dotted line labelled "optimum 961" |
| Wheel slices | shades | the individual's number on each slice and the table beside it |
| Gene-share bars | violet | printed value and "gene n" under each bar |

The two items that were colour-only before this ticket were the current-step highlight (now ▸, underline and `aria-current`) and the legend, which named only elite and parent (now all six symbols).
