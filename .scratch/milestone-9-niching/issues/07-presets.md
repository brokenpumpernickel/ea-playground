# 07 The presets and their statistics

Status: resolved
Type: task (test-first)
Blocked by: 05, 06
Spec: ../spec.md

## What to build

"Two peaks: fitness sharing" and "Two peaks: deterministic crowding" (population 40, a seed where the plain run lands on the broad hill), their texts asserted number by number on their seeds and over seeds 1 to 100 (the plain run, sharing with roulette and with tournament, crowding at 12, 40 and 60), with the honest caveats; the preset list, links and the drawer accept them.

## Done when

- Tests assert every number in each text; the statistics over seeds 1 to 100 in test files with timeouts.

## Comments

## Answer

**Built:** two presets on the Two peaks landscape, `sa-landscape-two-peaks-sharing.json` ("Two peaks: fitness sharing") and `sb-landscape-two-peaks-crowding.json` ("Two peaks: deterministic crowding"), listed after the other landscape presets, each with population 40 and seed 23, the existing Two peaks preset's crossover (BLX-α, 0.9), mutation, elitism (1) and ε, and its niching setting: **sharing** with roulette-wheel selection and σ = 3 (generation limit 100), **crowding** (σ is not used; selection stays at tournaments of 2, which the drawer shows as "Not used"; generation limit 200). The preset loader now checks a `niching` key (its shape, positive numbers, and that the problem has a distance), naming the file and the field; the drawer shows the preset's Niching section; the link of the run carries it.

**Choices by measurement** (real engine, seeds 1 to 100, population 40, "found" = best so far within ε of the narrow hill's top): sharing with roulette finds the narrow hill in 24 runs at σ = 1.5, 40 at σ = 2, **51 at σ = 3**, 48 at σ = 4 (19 without sharing), so the preset takes σ = 3 (the drawer's default stays 2); sharing with tournaments of 2 does not help (7 against 9 without it). Crowding needs more than 100 generations to bring the narrow group to ε (24 runs at 100, 48 at 200, 58 at 300; both hills still occupied in 90 of 100 at every length), so the limit is 200. Seed 23 is one where the run without niching ends on the broad hill (39 and 40 of 40; never within ε) and both niching runs find the narrow hill (generations 24 and 139, where Run until stop pauses).

**What the texts say, all asserted:** sharing: 39 of 40 on the broad hill without it; with it ε in generation 24 with 6 near the broad hill and 13 near the narrow one, and 4 and 11 in generation 100; over seeds 1 to 100, 51 runs find the narrow hill against 19 without sharing, so 49 still miss it; σ = 2 finds it in 40; tournaments of 2 do not help (7 against 9). Crowding: all 40 on the broad hill from generation 20 without it; with it 36 and 4 in generation 20, 35 and 5 in generation 100, best 0.95 then, ε in generation 139; over seeds 1 to 100 and 200 generations both hills are occupied in 90 runs against 34 without crowding, 48 runs reach ε against 17; both hills kept in 48 runs at population 12 and 99 at 60. The texts say plainly that sharing is no cure and that crowding is slow.

**Tests:** `presets-niching.test.ts` (12): the configuration of both presets and that they differ from the existing Two peaks preset only in niching, selection, size, seed and generation limit; the seed-23 runs with and without niching (counts near each hill at the generations the texts name, the first generation within ε, the stop); the statistics over seeds 1 to 100 (timeouts of two minutes); and each text containing every number the tests measured. `presets.test.ts`: every preset (including both) is a valid configuration the drawer accepts and the engine runs; the niching key's errors named in words, and a distance-less problem refused. End-to-end (`landscape-presets.spec.ts`): the menu lists twelve landscape presets with their texts, each loads with its seed, equals the engine's run for three generations and opens the same run through its link; Run until stop pauses at 24 and 139; the drawer's Niching section follows the preset, and the long texts stay whole in the drawer at 1920×1080, 1366×768 and in projector mode. Mutations: the crowding seed and the sharing radius changed in the files were each caught (2 and 4 failures). 2,407 unit tests, 1,081 end-to-end tests (55 skipped without their switches) and `npm run check` pass. The older tests that counted ten landscape presets, read the summary's two lines or measured it for two lines (landscape-metrics, classroom-m5, string-link, presets-landscape, run-config-strings) now say twelve and allow the peak readout's third line; the ticket 06 commit had left six of those failing (I had read only the tail of its end-to-end output, which hid the failure list), fixed here.
