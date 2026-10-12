# 05 The landscape problem: functions, optima, both representations

Status: open
Type: task (test-first)
Blocked by: 02
Spec: ../spec.md

## What to build

The landscape as an engine `Problem` built from options `{function, representation, bitsPerVariable}`: the four functions (single peak, two peaks, Rastrigin, Himmelblau) with their bounds, objective and fitness (f for the maximised ones, −f for the minimised ones), the known optimum fitness and the optimum point(s) (found analytically where possible, otherwise by a fine grid search with local refinement asserted by tests); the **binary-coded** representation (2·n bits, alphabet `0, 1`, n from 4 to 12, plain binary or Gray decoding onto the bounds: lo + (hi − lo)·v / (2ⁿ − 1)) and the **real-valued** one; validation of the options in words per field; scores (decoded text "(x, y)", objective, fitness) and columns; a way for the views to ask for the decoded point of any chromosome and the fitness at any point (for the heatmap and surface).

## Done when

- Values on hand-worked points for each function; the optima verified numerically; bounds as stated; fitness = f or −f as stated.
- Decoding: the end points map to the bounds exactly, consecutive integers to evenly spaced values; adjacent Gray words differ in one bit and decode to adjacent values; plain-binary 0111…1 and 1000…0 decode to adjacent values with the largest Hamming distance; real and binary-coded problems give the same fitness at the same decoded point.
- Validation messages name the field; defaults are valid; golden runs unchanged; `npm run check` clean.

## Comments

## Answer
