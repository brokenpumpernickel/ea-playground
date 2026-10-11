# 17 Accessibility and projector pass for the target string

Status: open
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
