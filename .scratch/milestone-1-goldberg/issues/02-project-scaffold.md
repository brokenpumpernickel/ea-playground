# 02 Project scaffold

Status: open
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

## Comments
