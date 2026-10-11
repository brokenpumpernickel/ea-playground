# 12 Schema tracker

Status: resolved
Type: task (test-first)
Blocked by: 09
Spec: ../spec.md

## What to build

The schema tracker as the spec and the mock describe it: a pure model (parse and validate a schema over `1`, `0`, `*`, or "block b solved"; per recorded generation the number of instances, their mean fitness and the population's mean fitness; a sentence saying which way it moved) and a view in the place the mock decided, with the notation explained and the standing wording that one run illustrates a tendency and proves nothing. A view setting: it never changes the run, is not in the share link, resets with the run, and follows the history cursor.

## Done when

- Counts and means equal direct computation over each recorded population (property test); invalid schemas (wrong length, other characters) get a readable message and change nothing; a run with and without the tracker is identical.
- Playwright: type a schema, read the values against the engine, scrub history, reset; keyboard operation and names for every control; geometric test at both sizes with the default and with 30 genes.

## Comments

## Answer

The schema tracker is the second view of the stage panel for the trap ("Stage view" / "Schema tracker", two toggle buttons with `aria-pressed`; no tabs for the other problems), as decided in the mock.

- **Model** (`src/ui/schema-model.ts`, test-first): `parseSchema` (1, 0 and *, spaces and line breaks ignored; messages in words: nothing typed, "A schema can only use 1, 0 and * (“x” at position 3 is none of them)", "The schema needs 20 symbols, one per gene (it has 19)"; the wrong symbol is named before the wrong length), `schemaOrder` and `schemaDefiningLength` (the two quantities of the schema theorem), `schemaOfBlock` ("block b solved": for loose linkage the schema is spread out, defining length 15 for 4 blocks of 5), `isInstance`, `schemaHistory` (for every recorded generation: individuals, instances, mean fitness of the instances, mean fitness of the population), `describeSchemaMoment` ("Generation 4: 3 of 12 individuals are instances of 1111**************** (1 in generation 0). Their mean fitness is 17.25, above the population mean 12.4."; singular, none, below, equal) and the standing caveat ("One run illustrates a tendency; it proves nothing. …").
- **View** (`SchemaTracker.svelte`, `StagePanel.svelte`): notation explained, a labelled input (monospace, one symbol per gene, aria-invalid and the message as an alert under it), a button per block ("Block n solved"; from six blocks on numbered buttons with the label "Block solved:" and `aria-label`s), the order and defining length, a bar chart of instances per generation (cursor marked, later generations dimmed, the cursor's count printed) and a line chart of the mean fitness of the instances (solid, ■) against the population's (dashed, ●), the sentence for the cursor's generation (`aria-live`), the caveat, and a hidden table of every recorded generation. It reads the recorded populations only: it never changes a run, is not in the share link, and starts over (stage view, block 1 solved) when the run restarts. The shortcuts do not fire while typing in the field.
- **Tests**: `schema-model.test.ts` (15, including counts and both means equal to a direct computation over every recorded generation of runs in both linkages and five schemas), `schema-view.test.ts` (6), and Playwright `e2e/trap-schema.spec.ts` (13: the toggle and the other problems without it, the table of values on screen equal to the engine's for a typed schema, scrubbing changes the sentence's generation, block buttons for tight and loose, wrong schemas explained and valid ones bring the charts back, the populations with the tracker open are the engine's stage by stage (a run with and without it is the same run), restart starts it over, keyboard order and no unnamed control, and at both sizes in projector mode for 4 × 5, 6 × 5 loose and 3 × 10 the whole tracker fits the panel while ten generations are added). The layout tests found the first version taller than its panel; the charts are lower and the body uses the room the hidden narration leaves.
- `npm run check` clean; 1426 unit tests and 369 Playwright tests pass.
