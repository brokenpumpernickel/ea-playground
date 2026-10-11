# 03 Configuration schema and share-link codec

Status: resolved
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

## Answer

`src/ui/run-config.ts` (outside `src/engine` and `src/run`, so the layer rules are untouched):

- `RunConfig` is `{ v: 1, problem, setup: { init }, params, seed }`. `configOf(setup, params, seed)` builds one from a run and `setupOf(config)` gives back the engine setup. `problemIds()` lists the problems a configuration may name (just `goldberg` for now; ticket 10 turns this into the real registry).
- `encodeConfig(config)` gives `#v1.<payload>`: compact JSON, UTF-8, base64url, no padding.
- `decodeConfig(hash)` (the `#` is optional) returns `{ ok: true, config }` or `{ ok: false, problems }`. It is strict and collects every structural problem at once, by path: not a share link, empty payload, characters that cannot be in a link, a different version, unreadable (cut short or damaged), not an object, unknown or missing keys at every level, wrong types, a version inside the payload that disagrees, an unknown problem (naming the ones that exist), a seed outside 0–4294967295. Only when the structure is sound does it check meaning, by reusing the drawer's own `validate` (first without fitness, then with the fitness the run starts with, so an invalid weight chain is reported with the engine's message). A bad link never yields a configuration.
- Preset files now carry `v` and `problem` (all four say `goldberg`), and `presetFromData` requires them.

Tests (`run-config.test.ts`, 29): the format; round trip of the default, every preset, the extreme seeds, the link without its `#`, and 240 generated configurations (random and hand-edited populations, every selection method, chain, operator, mutation mode, truncation and stop setting); a run made from a decoded link equals the original run (populations, events, metrics); eleven kinds of unreadable link; unknown problem, version, unknown and missing keys, wrong types, seeds, values the drawer refuses, an invalid chain, several problems reported together, and no partial result. Mutations proved the tests bite (accepting an empty payload; skipping the drawer validation).

One edge worth knowing: the engine accepts λ = 0 when every individual is an elite, but the drawer (and therefore a link) requires λ of at least 1. That is the drawer's existing rule, left as it is.

All 835 unit tests, `npm run check` and the 76 Playwright tests pass.
