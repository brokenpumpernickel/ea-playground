# 01 Foundations: distance, peaks, the niching configuration

Status: resolved
Type: task (test-first)
Blocked by: none
Spec: ../spec.md

## What to build

The landscape problem gets an optional `distance` (Euclidean between two individuals' decoded points); the landscape function info gets its known `peaks` (top, height, name) for single peak, two peaks and Himmelblau, each checked against the function; `GenerationConfig` gets an optional `niching` (`{ method: 'none' | 'sharing' | 'crowding'; sigma; alpha }`, absent meaning none, σ and α remembered while another method is chosen) and a `validateNiching` that says in words what is wrong (σ greater than 0, α greater than 0, a method the problem cannot do). No behaviour changes: with `niching` absent or `none` nothing differs.

## Done when

- Unit tests of the distance (decoded points in all three representations), of the peaks against a grid search, of the validation messages; the golden runs untouched.

## Comments

## Answer

**Built** (`src/engine/niching.ts`, `landscape.ts`, `problem.ts`, `generation.ts`): `Problem.distance` (optional; the landscape's is the Euclidean distance between two individuals' decoded points, in all three representations, and an individual without a decoded point is refused in words); `LandscapeFunctionInfo.peaks` for the single peak ("the peak"), the two hills ("broad hill" at (−2.5, −2.5), height 0.6; "narrow hill" at the optimum, height 1.0003) and Himmelblau's four places, none for Rastrigin; the niching configuration `{ method: 'none' | 'sharing' | 'crowding'; sigma; alpha }` with the defaults σ = 2 and α = 1, optional in `GenerationConfig` (absent means none), and `validateNiching`, which says in words what is wrong with σ, α, the method, and a method for a problem with no distance. Nothing else changes: with no niching the engine is untouched (all 2,285 unit tests pass, the golden runs among them).

**Tests** (`niching.test.ts`, 11): the 3-4-5 distance, symmetry and zero, the binary-coded problems measured between decoded points and not bits (one bit of the most significant position moves a point across half the range), every landscape having a distance, the refusal; the peaks (names, tops, heights, the highest equal to the known optimum, inside the bounds, each a local maximum of fitness in rings of radius 10⁻⁴, 10⁻² and 0.1); the validation messages. Mutations (σ may be 0, distance in x only, a peak moved) each fail tests. The broad hill's top was found numerically at (−2.5, −2.5) to under a millionth (the narrow hill's tail there is e⁻¹²¹), so it is stored as exactly that.
