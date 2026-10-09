# 22 Projector mode, keyboard control, accessibility pass

Status: open
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
