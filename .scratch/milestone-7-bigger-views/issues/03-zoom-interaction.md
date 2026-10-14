# 03 Zoom and pan in the page

Status: open
Type: task (test-first)
Blocked by: 02
Spec: ../spec.md

## What to build

The wheel zooms about the pointer, a drag pans, a double-click and a Reset view button return to the whole map, + − arrows 0 do the same from the keyboard on the focused map, and the toolbar has the buttons so nothing is mouse-only; the corner note says the zoom. The picture keeps the sizes of dots, lines and numbers while zooming; zoom and pan are kept while stepping, playing and scrubbing and reset when the instance changes.

## Done when

- Playwright: wheel about a pointer keeps the city under it, drag, double-click, buttons and keys; sizes unchanged on screen (data attributes); kept across steps, play and scrub; reset with the instance; no marker or label outside the picture at any zoom at both sizes; reduced motion (no animated zoom); the map's name and sentence say the zoom; every control named.

## Comments

## Answer
