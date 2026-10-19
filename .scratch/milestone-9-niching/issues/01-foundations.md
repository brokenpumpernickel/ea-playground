# 01 Foundations: distance, peaks, the niching configuration

Status: open
Type: task (test-first)
Blocked by: none
Spec: ../spec.md

## What to build

The landscape problem gets an optional `distance` (Euclidean between two individuals' decoded points); the landscape function info gets its known `peaks` (top, height, name) for single peak, two peaks and Himmelblau, each checked against the function; `GenerationConfig` gets an optional `niching` (`{ method: 'none' | 'sharing' | 'crowding'; sigma; alpha }`, absent meaning none, σ and α remembered while another method is chosen) and a `validateNiching` that says in words what is wrong (σ greater than 0, α greater than 0, a method the problem cannot do). No behaviour changes: with `niching` absent or `none` nothing differs.

## Done when

- Unit tests of the distance (decoded points in all three representations), of the peaks against a grid search, of the validation messages; the golden runs untouched.

## Comments

## Answer
