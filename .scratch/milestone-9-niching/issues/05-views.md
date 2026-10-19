# 05 The views: sharing columns and ring, the duel table

Status: open
Type: task (test-first)
Blocked by: 04
Spec: ../spec.md

## What to build

The selection view with sharing gets the columns "niche count" and "shared" after the weight chain's last column and says what they are; the tournament view shows the shared weights it compared; the selected individual gets a σ-radius ring on the heatmap (and a note); with crowding the selection view says "every individual once, in random order"; the replacement view shows the duels (pair, parents, children, the matching and its distances, each duel's result with the discarded mark on the loser); the narration and the sentences say the same.

## Done when

- Playwright against the engine's events at every stage and micro-step: columns, ring position and radius, duel rows, narration; geometry at both sizes and in projector mode.

## Comments

## Answer
