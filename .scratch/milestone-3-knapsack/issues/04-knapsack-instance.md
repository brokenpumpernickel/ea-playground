# 04 The knapsack instance, its validation and the optimum

Status: open
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
