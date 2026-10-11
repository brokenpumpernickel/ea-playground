# 03 Configuration schema and share-link codec

Status: open
Type: task (test-first)
Blocked by: none
Spec: ../spec.md

## What to build

One serialisable value describes a run's whole configuration: `{ v: 1, problem, setup, params, seed }`, where `problem` is a problem id (`goldberg` now) with its options (none for Goldberg), `setup` holds the initialization (random size or explicit chromosomes) and `params` is the existing parameter object. Presets are this shape plus `name`, `lesson` and `lookFor` (the existing preset files already match it; add the `problem` and `v` fields).

Build, in `src/ui` (or a new `src/config` if that is cleaner, but outside `src/engine` and `src/run`):

- `encodeConfig(config) → '#v1.<base64url>'` (compact JSON, UTF-8, base64url, no padding) and `decodeConfig(hash) → { ok: true, config } | { ok: false, problems: string[] }`.
- Decoding is strict: not base64url, not JSON, unknown version, unknown problem, unknown or missing keys, wrong types, and any value the parameter drawer's validation would reject (`drawer-model`'s `validate`, reused, so a link can only produce a configuration the drawer accepts). All problems are collected and reported together, in words, never partially applied.
- The configuration the app currently runs can be turned into this value (`configOf(run)`), and a decoded one into `GaSetup`, `GaParams` and a seed.

## Done when

- Round trip: for the default configuration, every preset, and generated configurations (random and hand-edited populations, every selection method, chain, crossover and mutation setting, truncation, stop criteria, seeds 0 and 2³²−1), `decode(encode(c))` equals `c`.
- A run made from a decoded configuration has populations, events and metrics identical to the original run with the same seed.
- Each bad-link case from the spec (not base64url, not JSON, unknown version, unknown problem, unknown key, wrong type, pc 1.5, truncated, empty payload) gives a readable message naming what is wrong; several problems in one link are all reported.

## Comments
