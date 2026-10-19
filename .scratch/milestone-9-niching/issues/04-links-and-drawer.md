# 04 Share links and the drawer

Status: resolved
Type: task (test-first)
Blocked by: 02, 03
Spec: ../spec.md

## What to build

Niching in the run configuration (an optional field, old links unchanged, bad values said in words), the drawer's Niching control for the landscape (none / fitness sharing / deterministic crowding, σ and α with their help text, the tip about roulette and population 30, elitism and truncation shown as off under crowding with the reason), pending-change behaviour at the next generation boundary, the restart rules unchanged.

## Done when

- Round-trip of every niching setting in a link; bad options refused in words; the drawer model; Playwright: the controls, the pending chip, the disabled elitism under crowding, the other problems without the control.

## Comments

## Answer

**Built:** niching in the run configuration and the drawer. `drawer-model.ts`: the draft gains `niching` (method, σ and α as typed text, present for the landscape or when a link gave one), validation (σ and α numbers greater than 0 while sharing is chosen and not checked otherwise; a method for a problem with no distance refused with the engine's own sentence; **elites and truncation are not checked under crowding**, where they do not apply), `toParams` (the `niching` key is **absent for none with the default radius and shape**, so every old run and link is exactly what it was; present, with σ and α kept, otherwise; a radius typed as text that is not a number does not become NaN while the method is none) and `changes` (a change of method is "Niching", the radius and the shape are "Sharing σ" and "Sharing α" and count only while sharing is the method, in the run and in the draft: they wait for the next generation boundary like the other operator settings). `run-config.ts`: `params.niching` is an optional key with exactly `method`, `sigma`, `alpha`, each checked in words ("must be an object", "is missing", "unknown key", "must be a number", the three method names), and its meaning is checked through the drawer's validation, so a niching method in a link for a problem with no distance is refused in words and nothing is applied; a link made before niching existed opens as before. `Drawer.svelte`: a **Niching** section for the landscape (a labelled select None / Fitness sharing / Deterministic crowding with a help sentence per method, σ and α fields with their help and pending tags, and the tip that sharing works best with roulette-wheel selection and a population of 30 or more); under crowding the Selection and Replacement sections say "Not used" with the reason and offer no selection method, elites or truncation; choosing none brings them back; σ and α are remembered through the other methods.

**Tests:** unit (`drawer-niching.test.ts` 17, `run-config-niching.test.ts` 5): the draft for none, sharing, crowding and for the other problems (no niching); the draft back to parameters (no key for none with the defaults, a remembered radius kept, no NaN, every setting round-trips, a restart applies it); the messages for σ, α and the method, the crowding exception for elites and truncation, the refusal for a problem with no distance; when each change takes effect; every setting round-trips in a share link as the same run (populations, five generations), a link with no niching key is byte-for-byte what it was; the link's shape and meaning errors in words. End-to-end (`e2e/niching-drawer.spec.ts`, 8): the section and its three options, none by default and no niching in the link; the other problems have no section; sharing shows σ = 2 and α = 1 and the tip, is pending in the chip and the field, is in the link at once and applies at the next generation; σ and α changed each pending on its own with "was → now", a bad entry said in words and applying nothing (the link keeps the last good radius); crowding says what it replaces and switches off (no selection method, elites or truncation in the drawer) and none brings them back; a radius and shape set while sharing are remembered through crowding and none; a link with niching opens with it and Apply and restart keeps it; every control named and reached by Tab in order. 2,367 unit tests, 1,039 end-to-end tests (55 skipped without their switches) and `npm run check` pass.
