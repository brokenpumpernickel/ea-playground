# Milestone 8: the best nearest-neighbour baseline

Status: built and verified; instructor review pending.

## Request

The instructor, after asking how the nearest-neighbour baseline is calculated: "We should try all the cities as starting points and choose the one with the shortest path."

## What changed

- **Engine** (`src/engine/tsp.ts`): `nearestNeighbourTour(distance, n, start = 0)` takes a starting city; `bestNearestNeighbour(distance, n)` makes the tour from every city and keeps the shortest (the lowest start among equals). An instance's `nearestNeighbour` is now that best tour and carries its `start`. It costs n³ distance evaluations (52 cities: about 140,000), which is instant.
- **Wording**: the figures beside the map say what the line is ("Nearest neighbour = the shortest of the nearest-neighbour tours tried from every city as the start (here from city 40)"), the instance description in the drawer says it begins at city N, the glossary has it. The plot labels stay "nearest neighbour −8,181" (short; their sentences and the figures card carry the explanation).
- **The baseline is much tighter**: gap over the optimum, from city 1 against the best start: berlin52 19.1 % → 8.5 % (from city 40), eil51 20.0 % → 13.1 % (city 8), ulysses16 45.6 % → 15.8 % (city 3), ulysses22 50.9 % → 16.6 % (city 3), att48 21.0 % → 13.0 % (city 10), burma14 21.8 % → 15.6 % (city 2); the circle is unchanged (0 %).
- **Presets**: the berlin52 family was written against 8,980. Remeasured with the same seeds: the default run (seed 15) ends at 8,794 after 500 generations, **7.5 % above** the best nearest-neighbour tour, which it never gets under; over seeds 1 to 30, **one run in thirty** ends under it (at 8,063, 1.4 % under) where 22 had ended under the single-start tour. The texts of "berlin52: against the nearest neighbour and the optimum", the cycle-crossover preset and the no-crossover preset were rewritten, and their tests assert every number.

## Tests

- Engine: the greedy tour from a given start (hand-worked on a line); the best start hand-worked on four cities on a line (13 from city 1; 11 from cities 2, 3 and 4; the first, city 2, chosen); every instance's best tour is a permutation starting at its start city, never shorter than the optimum, never longer than the tour from city 1 and equal to the minimum over all starts found independently; the six published instances pinned (best length and start).
- UI: the plot model, the mini graph and the map model carry the new baseline; the preset texts and statistics are asserted.
- End-to-end: the figures card says where the baseline starts.

## Comments
