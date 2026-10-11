# 04 Share link: copy, open, bad links

Status: open
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
