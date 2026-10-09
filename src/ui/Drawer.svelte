<script lang="ts">
  import { onMount } from 'svelte';
  import { gaAlgorithm } from '../engine';
  import ChainEditor from './ChainEditor.svelte';
  import DrawerRow from './DrawerRow.svelte';
  import { changes, draftOf, toParams, toSetup, validate, type Draft, type Field } from './drawer-model';
  import PopulationEditor from './PopulationEditor.svelte';
  import { presets } from './presets';
  import type { Session } from './session.svelte';

  let { session, onclose }: { session: Session; onclose: () => void } = $props();

  const run = $derived(session.run);
  const problem = $derived(run.setup.problem);

  /** What the run uses now (or will, once pending changes apply): the starting point and the thing to compare with. */
  const effective = () => ({ params: run.parameters, setup: run.setup, seed: run.seed });
  const fresh = () => draftOf(run.parameters, run.setup, run.seed);

  let draft = $state<Draft>(fresh());
  let root: HTMLElement | undefined = $state();

  // reread the run when it was replaced wholesale (reset, new seed, a cancelled change)
  let seenEpoch: number | undefined;
  $effect(() => {
    const epoch = session.epoch;
    if (seenEpoch !== undefined && seenEpoch !== epoch) draft = fresh();
    seenEpoch = epoch;
  });
  onMount(() => root?.focus());

  const sampleFitness = () => run.snapshot(run.lastCycle).state.population.map((i) => i.fitness);
  const validation = $derived.by(() => {
    void session.version;
    return validate(draft, problem, sampleFitness());
  });
  const errors = $derived(validation.errors);

  /** Operator edits are checked against the run as it is, not against setup edits that have not been applied yet. */
  const operatorFields: Field[] = ['tournamentSize', 'chain', 'crossover.probability', 'mutation.probability', 'elites', 'truncation.lambda', 'stop.generationLimit', 'stop.target', 'stop.stagnation'];
  const commit = () => {
    const now = fresh();
    const candidate: Draft = { ...$state.snapshot(draft), init: now.init, size: now.size, chromosomes: now.chromosomes, seed: now.seed };
    const found = validate(candidate, problem, sampleFitness()).errors;
    if (operatorFields.some((field) => found[field] !== undefined)) return;
    if (changes(candidate, effective()).operator.length === 0) return;
    session.changeParameters(toParams(candidate));
  };

  const setupFields: Field[] = ['size', 'chromosomes', 'seed'];
  const setupChanges = $derived.by(() => {
    void session.version;
    return setupFields.some((f) => errors[f]) ? undefined : changes(draft, effective()).reset;
  });
  const anyError = $derived(Object.keys(errors).length > 0);
  const applyReset = () => {
    if (anyError) return;
    const changed = changes(draft, effective()).reset;
    session.requestReset({ setup: toSetup(draft, problem), seed: Number(draft.seed), params: toParams(draft), changed });
  };

  // "was → now" for settings that are pending
  const applied = $derived.by(() => {
    void session.version;
    return draftOf(run.snapshot(run.lastCycle).params, run.setup, run.seed);
  });
  const isPending = (label: string) => session.pending.includes(label);
  const pendingFor = (label: string, was: string, now: string) => (isPending(label) ? `${was} → ${now}` : undefined);
  const tag = (label: string) => (isPending(label) ? '' : undefined);

  const size = $derived(draft.init === 'random' ? Number(draft.size) : draft.chromosomes.split(/[\s,;]+/).filter(Boolean).length);
  const elitePercent = $derived.by(() => {
    const e = Number(draft.elites);
    return size > 0 && Number.isFinite(e) ? `${Math.round((e / size) * 1000) / 10}% of N` : '';
  });
  const warnings = $derived.by(() => {
    if (anyError) return [];
    return gaAlgorithm.warnings(toSetup(draft, problem), toParams(draft));
  });
  const blamed = $derived(validation.chainStep);

  let chosenPreset = $state(presets[0]?.id ?? '');
  const preset = $derived(presets.find((p) => p.id === chosenPreset));
  const loadPreset = () => {
    if (!preset) return;
    session.requestReset({ setup: preset.setup, seed: preset.seed, params: preset.params, changed: [], preset: preset.name });
  };

  const keydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onclose();
    }
  };
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<aside id="drawer" aria-label="Parameters" tabindex="-1" bind:this={root} onkeydown={keydown} data-testid="drawer">
  <div class="dh">
    <h2>Parameters</h2>
    <button class="btn quiet" onclick={onclose} aria-label="Close parameters"><span aria-hidden="true">✕</span> close</button>
  </div>

  {#if warnings.length > 0}
    <div class="warn" role="status" data-testid="drawer-warnings">
      {#each warnings as warning (warning)}<p>{warning}</p>{/each}
    </div>
  {/if}

  <div class="sec" data-section="presets">
    <h3>Presets</h3>
    <DrawerRow label="Preset" id="preset">
      <select id="preset" value={chosenPreset} onchange={(e) => (chosenPreset = e.currentTarget.value)}>
        {#each presets as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
      </select>
    </DrawerRow>
    {#if preset}
      <p class="lesson" data-testid="preset-lesson">{preset.lesson}</p>
      <p class="help" data-testid="preset-lookfor"><b>Look for:</b> {preset.lookFor}</p>
      <div class="applyreset">
        <button class="btn primary" onclick={loadPreset} data-testid="load-preset">Load preset</button>
        <span class="help">Restarts the run with this configuration and seed {preset.seed}.</span>
      </div>
    {/if}
  </div>

  <div class="sec" data-section="setup">
    <h3>Run setup <span class="tag reset"><span aria-hidden="true">↺</span> needs reset</span></h3>
    <DrawerRow label="Initialization" id="init" help="Random draws every gene from the seeded generator. Hand-edited lets you type the starting chromosomes.">
      <select id="init" value={draft.init} onchange={(e) => (draft.init = e.currentTarget.value as Draft['init'])}>
        <option value="random">Random (seeded)</option>
        <option value="explicit">Hand-edited</option>
      </select>
    </DrawerRow>
    {#if draft.init === 'random'}
      <DrawerRow label="Population size N" id="size" error={errors.size} help="How many individuals each generation has.">
        <input id="size" type="text" inputmode="numeric" bind:value={draft.size} aria-invalid={errors.size ? 'true' : undefined} aria-describedby={errors.size ? 'size-error' : 'size-help'} />
      </DrawerRow>
    {:else}
      <DrawerRow label="Chromosomes" id="chromosomes" wide error={errors.chromosomes} help="One per line (spaces and commas also separate them). The table shows what each decodes to and its fitness.">
        <PopulationEditor bind:text={draft.chromosomes} {problem} error={undefined} />
      </DrawerRow>
    {/if}
    <DrawerRow label="Seed" id="seed" error={errors.seed} help="The same seed and settings always give the same run.">
      <input id="seed" type="text" inputmode="numeric" bind:value={draft.seed} aria-invalid={errors.seed ? 'true' : undefined} aria-describedby={errors.seed ? 'seed-error' : 'seed-help'} />
    </DrawerRow>
    <div class="applyreset">
      <button class="btn primary" onclick={applyReset} disabled={anyError || !setupChanges || setupChanges.length === 0} data-testid="apply-reset">Apply and restart</button>
      <span class="help">
        {#if anyError}Fix the highlighted fields first.
        {:else if setupChanges && setupChanges.length > 0}Changed: {setupChanges.join(', ')}. Restarts the run from generation 0.
        {:else}No setup changes.{/if}
      </span>
    </div>
  </div>

  <div class="sec" data-section="selection">
    <h3>Selection</h3>
    <DrawerRow label="Method" id="method" pending={tag('Selection')}>
      <select id="method" value={draft.method} onchange={(e) => { draft.method = e.currentTarget.value as Draft['method']; commit(); }}>
        <option value="roulette">Roulette wheel</option>
        <option value="tournament">Tournament</option>
      </select>
    </DrawerRow>
    {#if draft.method === 'tournament'}
      <DrawerRow label="Tournament size k" id="tournamentSize" error={errors.tournamentSize} help="Each parent is the fittest of k individuals drawn at random, with replacement. Tournament compares fitness directly, so it ignores the weight chain.">
        <input id="tournamentSize" type="text" inputmode="numeric" bind:value={draft.tournamentSize} onchange={commit} aria-invalid={errors.tournamentSize ? 'true' : undefined} />
      </DrawerRow>
    {:else}
      <div class="ctl wide" data-field="chain">
        <span class="label">Weight chain</span>
        <p class="help">raw fitness → weight → probability. Steps can be added, removed and reordered. Tournament ignores the chain.</p>
        <ChainEditor chain={draft.chain} error={errors.chain} badStep={blamed} ontouch={commit} />
      </div>
    {/if}
  </div>

  <div class="sec" data-section="crossover">
    <h3>Crossover</h3>
    <DrawerRow label="Crossover" id="crossover-on" pending={tag('Crossover on/off')} help="Off: selection still runs, but each pair of parents passes to the offspring as copies, with no recombination.">
      <label class="switch"><input id="crossover-on" type="checkbox" role="switch" checked={draft.crossover.enabled} onchange={(e) => { draft.crossover.enabled = e.currentTarget.checked; commit(); }} /> {draft.crossover.enabled ? 'ON' : 'OFF'}</label>
    </DrawerRow>
    <DrawerRow label="Type" id="crossover-type" pending={tag('Crossover type')}>
      <select id="crossover-type" value={draft.crossover.operator} onchange={(e) => { draft.crossover.operator = e.currentTarget.value as Draft['crossover']['operator']; commit(); }}>
        <option value="one-point">One-point</option>
        <option value="two-point">Two-point</option>
        <option value="uniform">Uniform</option>
      </select>
    </DrawerRow>
    <DrawerRow
      label="Probability pc"
      id="crossover-probability"
      error={errors['crossover.probability']}
      pending={pendingFor('Crossover probability', applied.crossover.probability, draft.crossover.probability)}
      help="Applies per pair. One draw u per pair when the crossover stage runs: recombine if u < pc, otherwise bypass (the children are copies). Applies at the next generation boundary."
    >
      <input id="crossover-probability" type="text" inputmode="decimal" bind:value={draft.crossover.probability} onchange={commit} aria-invalid={errors['crossover.probability'] ? 'true' : undefined} />
    </DrawerRow>
  </div>

  <div class="sec" data-section="mutation">
    <h3>Mutation</h3>
    <DrawerRow label="Mutation" id="mutation-on" pending={tag('Mutation on/off')} help="Off: every offspring passes through unchanged.">
      <label class="switch"><input id="mutation-on" type="checkbox" role="switch" checked={draft.mutation.enabled} onchange={(e) => { draft.mutation.enabled = e.currentTarget.checked; commit(); }} /> {draft.mutation.enabled ? 'ON' : 'OFF'}</label>
    </DrawerRow>
    <DrawerRow label="Mode" id="mutation-mode" pending={tag('Mutation mode')}>
      <select id="mutation-mode" value={draft.mutation.mode} onchange={(e) => { draft.mutation.mode = e.currentTarget.value as Draft['mutation']['mode']; commit(); }}>
        <option value="per-gene">Per gene</option>
        <option value="per-individual">Per individual</option>
      </select>
    </DrawerRow>
    <DrawerRow
      label="Probability pm"
      id="mutation-probability"
      error={errors['mutation.probability']}
      pending={pendingFor('Mutation probability', applied.mutation.probability, draft.mutation.probability)}
      help="Per gene: every gene of every offspring draws u and flips if u < pm. Per individual: one draw per offspring decides whether it is mutated at all, then one more draw picks the single gene that flips."
    >
      <input id="mutation-probability" type="text" inputmode="decimal" bind:value={draft.mutation.probability} onchange={commit} aria-invalid={errors['mutation.probability'] ? 'true' : undefined} />
    </DrawerRow>
  </div>

  <div class="sec" data-section="replacement">
    <h3>Replacement</h3>
    <DrawerRow label="Elites e" id="elites" error={errors.elites} pending={pendingFor('Elites', applied.elites, draft.elites)} help={`The e best individuals of a generation are copied unchanged into the next one (${elitePercent || '—'}).`}>
      <input id="elites" type="text" inputmode="numeric" bind:value={draft.elites} onchange={commit} aria-invalid={errors.elites ? 'true' : undefined} />
    </DrawerRow>
    <DrawerRow label="Offspring truncation" id="truncation-on" pending={tag('Offspring truncation on/off')} help="Generate and evaluate λ offspring, then keep only the best N − e.">
      <label class="switch"><input id="truncation-on" type="checkbox" role="switch" checked={draft.truncation.enabled} onchange={(e) => { draft.truncation.enabled = e.currentTarget.checked; commit(); }} /> {draft.truncation.enabled ? 'ON' : 'OFF'}</label>
    </DrawerRow>
    {#if draft.truncation.enabled}
      <DrawerRow label="Offspring λ" id="truncation-lambda" error={errors['truncation.lambda']} pending={pendingFor('Offspring λ', applied.truncation.lambda, draft.truncation.lambda)}>
        <input id="truncation-lambda" type="text" inputmode="numeric" bind:value={draft.truncation.lambda} onchange={commit} aria-invalid={errors['truncation.lambda'] ? 'true' : undefined} />
      </DrawerRow>
    {/if}
  </div>

  <div class="sec" data-section="stop">
    <h3>Stop <span class="note">reported, never forced: stepping continues past them</span></h3>
    <DrawerRow label="Generation limit" id="stop-limit" error={errors['stop.generationLimit']} pending={isPending('Stop criteria') ? '' : undefined}>
      <input id="stop-limit" type="text" inputmode="numeric" bind:value={draft.stop.generationLimit} onchange={commit} aria-invalid={errors['stop.generationLimit'] ? 'true' : undefined} />
    </DrawerRow>
    <DrawerRow label="Target fitness reached" id="stop-target" error={errors['stop.target']} help="Reported when the best fitness seen so far is at least this.">
      <label class="switch"><input id="stop-target-on" type="checkbox" role="switch" aria-label="Use a target fitness" checked={draft.stop.target.enabled} onchange={(e) => { draft.stop.target.enabled = e.currentTarget.checked; commit(); }} /></label>
      <input id="stop-target" type="text" inputmode="decimal" bind:value={draft.stop.target.value} onchange={commit} disabled={!draft.stop.target.enabled} />
    </DrawerRow>
    <DrawerRow label="Stagnation window" id="stop-stagnation" error={errors['stop.stagnation']} help="Reported when best so far has not improved for this many generations.">
      <label class="switch"><input id="stop-stagnation-on" type="checkbox" role="switch" aria-label="Use a stagnation window" checked={draft.stop.stagnation.enabled} onchange={(e) => { draft.stop.stagnation.enabled = e.currentTarget.checked; commit(); }} /></label>
      <input id="stop-stagnation" type="text" inputmode="numeric" bind:value={draft.stop.stagnation.window} onchange={commit} disabled={!draft.stop.stagnation.enabled} />
    </DrawerRow>
  </div>
</aside>
