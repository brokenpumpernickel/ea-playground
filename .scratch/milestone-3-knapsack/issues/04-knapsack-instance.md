# 04 The knapsack instance, its validation and the optimum

Status: resolved
Type: task (test-first)
Blocked by: none
Spec: ../spec.md

## What to build

In the engine, DOM-free:
- The instance type: items (weight, value, letter name A, B, C, … by position) and a capacity; the limits and messages from the spec (2–20 items, weights 1–99, values 1–999, capacity from 1 to the total weight, at least one item that fits alone). Messages name the item or field.
- The dynamic-programming optimum (value and one optimal bag), cross-checked against brute force.
- **The built-in instance**: 12 items and a capacity of about 40–50% of the total weight such that (verified by tests): the DP optimum equals brute force; value-per-weight greedy is strictly worse than the optimum; the share of the 4,096 bags that are feasible is about one half. Record the instance and the numbers in this file.
- Pure helpers the handling methods will share: weight, value and feasibility of a bag, value per weight.

## Done when

- Hand-worked bags of the built-in instance (empty, full, exactly at capacity, one over) give the stated weight, value and feasibility.
- DP equals brute force on the built-in instance and on 200 generated small instances; every validation message appears for a bad instance; limits are exact at the boundaries.
- The built-in instance meets all three design conditions, asserted by tests.

## Comments

## Answer

`src/engine/knapsack-instance.ts` (pure, DOM-free): `KnapsackInstance`, `knapsackLimits`, `itemName` (A, B, C, …), `bagWeight`, `bagValue`, `valuePerWeight`, `optimalBag` (dynamic programming), `greedyByRatio`, `validateKnapsackInstance` and `validateKnapsackInstanceFields` (messages grouped under `items` and `capacity`, as the string problem's option messages are, for the drawer), and the built-in instance.

**The built-in instance** (the one the mock used, now confirmed with an independent script):

| item | A | B | C | D | E | F | G | H | I | J | K | L |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| weight | 9 | 12 | 3 | 3 | 10 | 14 | 4 | 5 | 11 | 7 | 6 | 13 |
| value | 4 | 20 | 21 | 17 | 5 | 23 | 7 | 14 | 8 | 12 | 21 | 19 |

Capacity 48 of a total weight of 97 (49.5%). The optimum is **123**, reached only by the bag **B, C, D, F, G, H, K** (weight 47). Packing by best value per weight takes C, D, K, H, G, J, B for **112** (weight 40), 11 short of the optimum. Exactly **2,048 of the 4,096 bags (half)** fit.

**Messages** (the drawer will show them under the item table and the capacity): "A knapsack needs at least 2 items (there is 1).", "A knapsack can have at most 20 items (there are 21).", "Item F: the weight must be a whole number from 1 to 99 (it is 0).", the same for the value (1 to 999), "The capacity must be a whole number of at least 1 (it is 0).", "The capacity can be at most the total weight, 97 (it is 120): a bag that holds everything is no puzzle.", "No item fits on its own: the lightest weighs 15 but the capacity is 5." While a weight is wrong the totals are not used to blame the capacity.

**Tests** (`knapsack-instance.test.ts`, 17, hand-worked numbers rather than read from the code): empty, full (97 and 171), exactly at capacity (A, B, C, E, F: 48 and 73) and one over (A, B, E, F, G: 49 and 59); DP equals brute force on the built-in instance (123, and exactly half feasible) and on 200 generated instances (and returns a feasible bag worth that much); greedy gets 112 on the built-in one and skips an item that does not fit but carries on; the design conditions; every validation message, the limits at the boundaries and the grouping.

State: 1054 unit tests, `npm run check` clean.
