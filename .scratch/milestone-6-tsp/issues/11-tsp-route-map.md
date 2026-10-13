# 11 The route map

Status: open
Type: task (test-first)
Blocked by: 08, 09
Spec: ../spec.md

## What to build

The second view of the stage panel ("Stage view | Route map"), with the narration bar still visible: the cities as numbered dots (the numbers dropped or shrunk when crowded), GEO instances drawn longitude across and latitude up, the population's edges faint with width by the number of individuals that use them (toggle, on), the best tour bold, the selected individual's tour orange and dotted, the optimal tour dashed grey (toggle, off), the side column of best now, best so far, average, optimum and nearest neighbour with the gap; the stage marks (crossover: the child's edges shared / from A / from B / new, the kept slice ringed; mutation: removed edges dashed with ✕, added edges bold, the end cities ringed, the population's edges dimmed); a sentence and a hidden table of tours as the text alternative; the view stays when the run restarts.

## Done when

- Every drawn edge equals the tour it belongs to (data attributes), the edge widths equal the population's edge counts, the best, selected and optimal tours are the right ones, stage marks equal the events at the cursor, the same individual is highlighted in the table and on the map; GEO and ATT instances draw where their coordinates say; no marker or label outside the picture at both sizes at every micro-step of two generations; the other problems have no route map.

## Comments

## Answer
