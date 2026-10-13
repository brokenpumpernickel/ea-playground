# 01 The TSP mock

Status: resolved
Type: review
Blocked by: —
Spec: ../spec.md

## What to build

A static mock at 1920×1080 of the route map, the population table with long permutations, the OX, PMX and CX cards, the mutation cards, the edge-agreement and diversity panels, the drawer and the instance list, with the decisions to review (`../mock/README.md`).

## Done when

- The instructor has reviewed the mock and decided.

## Comments

## Answer

Reviewed with "all recommended". Decisions (recorded in the spec's "To decide" list): the long-tour layout (whole tour up to 16 cities, shortened with a thumbnail above, the selected individual's route in full under the table, wrapped rows rejected); strips of 16 to 30 px cells; the route map's drawing rules (population edges on, best bold, selected dotted, optimal overlay a toggle, the child's edges classified by origin while stepping, mutation's removed edges crossed out); linear fitness = −length with labelled optimum and nearest-neighbour lines; the instances reduced to burma14, ulysses16, ulysses22, att48, eil51 and berlin52 (a plain GA ends 70 to 280 per cent over the optimum of st70, eil76 and kroA100); the nearest-neighbour line stays.
