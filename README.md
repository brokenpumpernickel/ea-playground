# Evolutionary algorithms teaching app

An interactive web app for teaching evolutionary algorithms, starting with genetic algorithms: step through evaluation, selection, pairing, crossover, mutation and replacement, and watch both the fitness and the actual solutions change. Examples so far: Goldberg's x² and a target string.

**Use it:** https://brokenpumpernickel.github.io/ea-playground/

## Share links

The "Copy link" button in the Parameters drawer copies a link that carries the whole configuration (problem and its options, setup including a hand-edited population, every parameter, the seed). Opening it starts a fresh, paused run at generation 0 that is identical to the one it was copied from. It carries no history and no position in the run.

Links are made from the address the app was opened from. From the published site above they work for anyone. If you open `dist/index.html` from a folder on your computer, the app works the same, but links copied there only open on that computer.

## Publishing

Every push to `main` runs `.github/workflows/pages.yml`: install, unit tests, layering and type checks, build (one self-contained `index.html`), then deploy to GitHub Pages. It can also be started by hand from the Actions tab. The browser tests (Playwright, using Edge) are not run there; run them locally.

## Working on it

```bash
npm ci
npm run dev          # development server
npm test             # unit tests
npm run test:e2e     # builds, then runs the browser tests (needs Microsoft Edge, or set PW_CHANNEL)
npm run build        # checks, then writes dist/index.html
```

The brief is in `CLAUDE.md`, the vocabulary in `CONTEXT.md`, decisions in `docs/adr/`, and the specs and tickets of each milestone under `.scratch/`.
