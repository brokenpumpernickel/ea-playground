# 02 Project scaffold

Status: resolved
Type: task
Blocked by: none
Spec: ../spec.md

## What to build

Set up the repository so later tickets only add code (ADR 0002):

- Vite + Svelte 5 + TypeScript app, Vitest for unit tests, Playwright configured for rendered checks.
- Source layout: `src/engine` (GA engine), `src/run` (algorithm-agnostic run, history, playback), `src/ui` (views).
- A TypeScript project configuration for `src/engine` and `src/run` that does **not** include DOM types, so they cannot import browser APIs. A check that fails if either imports from `src/ui` or uses DOM globals.
- `npm test`, `npm run build`, `npm run dev`, and a Playwright smoke test that loads the empty app.
- A `.gitignore`, and no runtime network requests or CDN references.

## Done when

- A trivial test passes in each of the three folders' test setups, and the build produces a static site that opens without a server for the app shell.
- A deliberate DOM import inside `src/engine` makes the check fail (and is then removed).

## Answer

Done.

- `npm test` runs Vitest, with one smoke test each in `src/engine`, `src/run` and `src/ui`.
- `npm run build` runs the checks, then produces a single self-contained `dist/index.html` (via vite-plugin-singlefile), so it also opens from a folder.
- `npm run test:e2e` builds, then opens that file from disk in Playwright and asserts that no non-`file:` request is made. It uses the Edge that ships with Windows, so no browser download is needed; set `PW_CHANNEL` to change it.

Layering, enforced by `npm run check`:

- `tsconfig.engine.json` covers `src/engine` and `src/run` with no DOM lib and no ambient types. A `document` reference fails the type check (verified with a temporary file).
- `scripts/check-boundaries.mjs`: `src/run` imports nothing from `src/engine` or `src/ui`; `src/engine` may import `src/run` but not `src/ui`; neither may import svelte, vite or three, or call the unseeded random source. Verified with a temporary bad file, which was then removed.
- Consequence for ticket 12: the shared run contract (cycle, stage and event types) lives in `src/run` and the GA engine implements it. Run-layer tests use a fake engine.

Notes:

- Svelte components need a `<script lang="ts">` block, or svelte-check cannot resolve the import.
- `npm audit` reports 3 high advisories, all via vite-plugin-singlefile → micromatch → braces (a regex denial of service in a build-time glob dependency, not shipped in the app). The suggested fix downgrades the plugin to 0.9.0, so it was not applied.

## Comments
