# 01 Throwaway visual mock of the Goldberg screen

Status: open
Type: prototype (needs instructor review)
Blocked by: none
Spec: ../spec.md

## What to build

A static HTML/CSS/SVG mock of the Goldberg screen at 1920×1080 with hand-made data for the textbook population (01101, 11000, 01000, 10011). No engine, no framework. Show, as separate mock screens or states:

- The full layout: stage ribbon and transport controls on top, stage view and population table in the main area, fitness and diversity plots and a scrub bar in the bottom strip, collapsed parameter drawer.
- The selection stage (weight table with raw fitness → weight → probability, roulette wheel), mating pool and pairs.
- The crossover stage (cut point, inherited bits per parent, a bypass) and the mutation stage (draws, flipped genes, a bypass).
- The replacement stage (elites, survivors, offspring discarded by truncation).
- Projector mode versus a 1366×768 render.

Use text sizes of roughly 20 px body at 1080p, and give every colour-coded meaning a symbol or pattern.

## Output

- The mock under `.scratch/milestone-1-goldberg/mock/` (it is thrown away afterwards).
- A short list in this file under `## Answer` of what the mock revealed that the engine's events must carry (for example, "the crossover view needs the cut point and both parents' indices").

## Done when

The instructor has reviewed the mock and either approved the layout or listed changes that were made. The event-needs list is complete.

## Comments
