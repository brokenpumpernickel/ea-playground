# 01 Throwaway mock of the trap screens

Status: claimed
Type: mock, review (needs instructor)
Blocked by: none
Spec: ../spec.md

## What to build

A static mock (plain HTML and CSS, hand-made data, thrown away afterwards) of the trap screens at 1920×1080 in the style of the milestone 3 mock, reviewed by the instructor. It settles the marks and layouts before anything is built.

Screens: the population table with the block row above the genes and each chromosome's block contributions printed beneath it, for **tight** and for **loose** linkage (show the options for loose: block letters on the genes, and coloured brackets with a non-colour carrier); the Decoded column ("4 · 0 · 3 · 1 · 2") and Fitness; a block at its optimum and a block at the deceptive attractor, each with a shape and a word; the crossover view with each offspring's blocks marked whole from A, whole from B or split, for one-point cuts in tight and in loose linkage, plus the per-pair "kept / split" summary; the mutation view with a changed block ("block 3: 1111 → 1110, 4 → 0") and a flip that changes nothing; the block states panel (optimum / attractor / in between per block, now and over generations) beside the diversity plot; the schema tracker (input with notation help, "block b solved" picker, counts, instance mean fitness against population mean, the wording that says it illustrates and proves nothing); the drawer's trap section (k, m, linkage, with a validation message and the trap definition in the help); the problem menu with Trap in it. Also the stress case: 8 × 5 genes (40) in loose linkage in the population table and in the crossover view, at 1920×1080 and 1366×768.

## Done when

- The instructor has reviewed the mock and decided: how loose linkage is drawn, the Decoded text and column, the marks for optimum/attractor/split/whole/changed, where the schema tracker sits, and any layout change.
- The decisions are recorded in this file and in the spec's "To decide" list; screenshots are kept under `.scratch/milestone-4-deceptive-trap/mock/`.

## Comments
