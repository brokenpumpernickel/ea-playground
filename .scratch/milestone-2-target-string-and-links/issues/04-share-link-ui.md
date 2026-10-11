# 04 Share link: copy, open, bad links

Status: resolved
Type: task
Blocked by: 03
Spec: ../spec.md

## What to build

The user-facing side of the share link:

- A "Copy link" action in the parameter drawer copies `page address + encodeConfig(current configuration)`, with pending changes applied first. If the clipboard cannot be written, the link is shown in a text field to select. A link over about 2,000 characters shows a warning that some chat and mail tools break long links. On `file://` the action says the link only opens on this machine's copy.
- On load, a `#v1.…` hash is decoded. A valid one starts a fresh, paused run at generation 0 with that configuration and seed (never playing, no history or cursor). Any invalid one opens the default Goldberg configuration and shows one dismissible message listing everything that is wrong (accessible: `role="alert"`).
- After any load the hash is removed from the address bar (`history.replaceState`) so a reload does not silently reset the run to the link's state.
- Works with storage blocked, from `file://`, and with a link pasted into a fresh tab.

## Done when

- Playwright: copy a link from a configured run (pc changed, a hand-edited population, a non-default seed), open it in a fresh page, and compare the populations after several generations with the engine's run for that configuration. Copy with the clipboard blocked shows the text field. A long hand-edited population shows the warning.
- Playwright: every bad-link case opens the default configuration with a readable message, applies nothing partially, clears the address bar, and never starts playback.
- The milestone 1 e2e suite still passes untouched.

## Comments

## Answer

- **Copy link** (a new "Share" section in the parameter drawer, `ShareLink.svelte`): copies the page's own address plus `encodeConfig` of the run's current configuration (`session.shareConfig`: pending parameters included, setup edits that were never applied not). If the clipboard refuses, the link is shown in a read-only field that selects itself, with an alert. A link over 2,000 characters shows a warning. Opened from `file://`, it says the link only opens on this computer.
- **Opening** (`share-link.ts`, `App.svelte`): a hash starting `#v` and a digit is an attempt at a share link. A good one starts a fresh, paused run at generation 0 with its setup, parameters and seed (the session takes an optional starting configuration; nothing plays, no history or cursor). A damaged one opens the defaults and shows a dismissible `role="alert"` notice listing every problem. Any other hash (an in-page anchor) is left alone. After a link loads, the hash is removed with `history.replaceState` so a reload does not silently reset the run (guarded in case a context refuses).
- Tests: `share-link.test.ts` (6, link building and what an address asks for), two session tests (starting from a configuration; the share configuration), and `e2e/share.spec.ts` (17): a configured run (hand-edited population, new seed, a pending operator change) copied and opened in a fresh page shows the same seed, population and setting and, after three generations, the engine's run for that configuration; the address is cleared and a reload gives the defaults; an unrelated hash is left alone; nine kinds of bad link each open the defaults with a readable message, never start playing, clear the address and can be dismissed; a link with several problems lists them all and applies none of its good parts; clipboard refused shows the field; a 220-chromosome population triggers the length warning and a short link does not; the file:// note; works with storage blocked.
- Found while testing: structural problems (unknown key, wrong type) are reported before semantic ones (a probability of 1.5), by design, so a link with both shows the structural ones first and the rest after they are fixed.

All 835 + 8 new unit tests, `npm run check` and the 93 Playwright tests pass.
