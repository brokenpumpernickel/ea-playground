# The engine is a DOM-free TypeScript package inside a static, client-side app

Algorithm state and execution logic live in a plain TypeScript package with no DOM imports, consumed by a Svelte UI built with Vite. The app is a static site with no backend or accounts, so it can be hosted on GitHub Pages or opened from a folder, and a scenario is shared as a config plus seed (URL or JSON). Separating the engine keeps one run usable by stepping, continuous playback, and multiple views, and keeps the algorithms testable without a browser.

## Considered Options

- **Server-backed runs or saved class results**: rejected for now because nothing needs them, and a run is already fully determined by its config and seed.
