# 07 Crossover view: blocks kept and split

Status: open
Type: task (test-first)
Blocked by: 06
Spec: ../spec.md

## What to build

In the crossover view, for each offspring and each block: inherited whole from parent A, whole from parent B, or split (genes from both), derived from the recorded swap mask; marked by shape and word, with the per-pair summary ("4 blocks kept, 1 split"); bypassed pairs show no split (copies). Pure model first, then the view, for tight and loose linkage and all three operators.

## Done when

- For every offspring and block of generated runs, the model's verdict equals what the swap mask gives (property test, tight and loose, all operators, bypasses included); the per-pair summary adds up.
- Rendered check of the marks and a geometric test at both sizes for the default and for 8 × 5 loose, at every micro-step of two generations.
- The crossover view of the other problems is unchanged.

## Comments

## Answer
