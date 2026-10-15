<script lang="ts">
  import { onMount } from 'svelte';
  import { gaAlgorithm, itemName, knapsackLimits, landscapeFunctionInfo, landscapeFunctions, landscapeLimits, linkages, trapLimits, tspCatalogue, tspInstance, tspLimits, validateTsp } from '../engine';
  import ChainEditor from './ChainEditor.svelte';
  import DrawerRow from './DrawerRow.svelte';
  import { changes, chromosomePieces, draftOf, followedTargetFitness, optionsOf, problemOf, resetParams, toParams, toSetup, validate, withInstance, withRepresentation, type Draft, type Field } from './drawer-model';
  import PopulationEditor from './PopulationEditor.svelte';
  import ShareLink from './ShareLink.svelte';
  import { presets as allPresets } from './presets';
  import { trapDefinition } from './trap-text';
  import type { Session } from './session.svelte';

  let { session, onclose }: { session: Session; onclose: () => void } = $props();

  const run = $derived(session.run);
  const entry = $derived(session.problemEntry);
  /** The problem the run has now. */
  const runProblem = $derived(session.problem);

  /** What the run uses now (or will, once pending changes apply): the starting point and the thing to compare with. */
  const effective = () => ({ params: run.parameters, setup: run.setup, seed: run.seed, ...(session.problemOptions ? { options: session.problemOptions } : {}) });
  const fresh = () => draftOf(run.parameters, run.setup, run.seed, session.problemOptions);

  let draft = $state<Draft>(fresh());
  /** The problem the draft describes: the typed alphabet and target, once they are valid (hand-edited strings are read against it). */
  const problem = $derived(problemOf(draft, entry, runProblem));
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
    return validate(draft, problem, sampleFitness(), entry);
  });
  const errors = $derived(validation.errors);

  /** Operator edits are checked against the run as it is, not against setup edits that have not been applied yet. */
  const operatorFields: Field[] = ['tournamentSize', 'chain', 'crossover.operator', 'crossover.probability', 'crossover.alpha', 'mutation.probability', 'mutation.mode', 'mutation.operator', 'mutation.sigma', 'elites', 'truncation.lambda', 'stop.generationLimit', 'stop.target', 'stop.epsilon', 'stop.stagnation'];
  const commit = () => {
    const now = fresh();
    // while the form holds another representation (and so its operators), nothing is applied to the running one: the restart applies it all
    if (draft.landscape && now.landscape && draft.landscape.representation !== now.landscape.representation) return;
    const candidate: Draft = { ...$state.snapshot(draft), init: now.init, size: now.size, chromosomes: now.chromosomes, seed: now.seed, ...(now.options ? { options: now.options } : {}), ...(now.knapsack ? { knapsack: now.knapsack } : {}), ...(now.landscape ? { landscape: now.landscape } : {}), ...(now.tsp ? { tsp: now.tsp } : {}) };
    const found = validate(candidate, runProblem, sampleFitness(), entry).errors;
    if (operatorFields.some((field) => found[field] !== undefined)) return;
    if (changes(candidate, effective()).operator.length === 0) return;
    session.changeParameters(toParams(candidate));
  };

  const setupFields: Field[] = ['size', 'chromosomes', 'seed', 'alphabet', 'target', 'items', 'capacity', 'handling', 'rho', 'blockSize', 'blocks', 'linkage', 'genes', 'function', 'representation', 'bitsPerVariable', 'instance', 'cities', 'citySeed'];
  const setupChanges = $derived.by(() => {
    void session.version;
    return setupFields.some((f) => errors[f]) ? undefined : changes(draft, effective()).reset;
  });
  const anyError = $derived(Object.keys(errors).length > 0);
  const applyReset = () => {
    if (anyError) return;
    const { reset: changed, notes } = changes(draft, effective());
    session.requestReset({
      setup: toSetup(draft, problem),
      seed: Number(draft.seed),
      params: resetParams(draft, runProblem),
      changed,
      ...(notes ? { notes } : {}),
      ...(optionsOf(draft) ? { options: optionsOf(draft)! } : {}),
    });
  };

  // the knapsack's items: two columns of the typed weights and values, with add and remove
  const maxItems = knapsackLimits.maxItems;
  const itemCount = $derived(draft.knapsack?.items.length ?? 0);

  // the trap's sizes as numbers, once they are valid, for the definition under the fields
  const trapSizes = $derived.by(() => {
    const t = draft.trap && optionsOf(draft);
    return t && 'blockSize' in t && !errors.blockSize && !errors.blocks && !errors.genes ? { k: t.blockSize, m: t.blocks } : undefined;
  });
  const linkageHelp = $derived(
    draft.trap?.linkage === 'loose'
      ? `The blocks are interleaved: block 1 is genes 1, ${1 + (trapSizes?.m ?? 5)}, ${1 + 2 * (trapSizes?.m ?? 5)}, …; block 2 is genes 2, ${2 + (trapSizes?.m ?? 5)}, …. A crossover cut then falls inside almost every block.`
      : 'A block’s genes sit side by side: block 1 is genes 1 to k, block 2 the next k, and so on. A cut falls inside a block only now and then.',
  );
  const firstHalf = $derived(Math.ceil(itemCount / 2));
  const addItem = () => draft.knapsack && draft.knapsack.items.length < maxItems && draft.knapsack.items.push({ weight: '5', value: '10' });
  const removeItem = (k: number) => draft.knapsack && draft.knapsack.items.length > knapsackLimits.minItems && draft.knapsack.items.splice(k, 1);
  const wholeIn = (text: string, max: number) => /^\s*\d+\s*$/.test(text) && Number(text) >= 1 && Number(text) <= max;
  const totalWeight = $derived(draft.knapsack ? draft.knapsack.items.reduce((t, i) => t + (wholeIn(i.weight, knapsackLimits.maxWeight) ? Number(i.weight) : 0), 0) : 0);
  const handlingHelp: Record<string, string> = {
    decoder: 'Walks the items in order and packs each one that still fits. Always feasible; the chromosome is not changed.',
    penalty: 'Overweight bags are allowed but lose ρ for every unit of excess weight.',
    'repair-lamarckian': 'Drops the worst value-per-weight items until the bag fits, and writes that back into the chromosome.',
    'repair-baldwinian': 'Drops the same items, but the chromosome keeps its genes: only the bag and the score are repaired.',
  };

  const followed = $derived(followedTargetFitness(draft, runProblem));

  // the landscape: what the function is, which operators the representation offers
  const fnInfo = $derived(draft.landscape ? landscapeFunctionInfo[draft.landscape.function] : undefined);
  const binaryCoded = $derived(draft.landscape !== undefined && draft.landscape.representation !== 'real');
  const realValued = $derived(draft.landscape?.representation === 'real');
  const setupNotes = $derived.by(() => {
    void session.version;
    return anyError ? [] : (changes(draft, effective()).notes ?? []);
  });
  const chooseRepresentation = (value: string) => {
    draft = withRepresentation($state.snapshot(draft) as Draft, value as 'real' | 'plain' | 'gray');
  };
  // the TSP: which instance, what it says about itself, which operators a permutation offers
  const ownInstances = tspCatalogue.filter((c) => c.kind === 'own');
  const libInstances = tspCatalogue.filter((c) => c.kind === 'tsplib');
  const permutation = $derived(draft.tsp !== undefined);
  const sized = $derived(draft.tsp?.instance === 'circle' || draft.tsp?.instance === 'random');
  const lengthText = (value: number, decimals: number) => value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const instanceHelp = $derived.by(() => {
    const options = draft.tsp && optionsOf(draft);
    if (!options || !('instance' in options) || validateTsp(options).length > 0) return undefined;
    const instance = tspInstance(options);
    const d = instance.rule === 'EUC' ? 1 : 0;
    const where = instance.source ? `${instance.source}. ` : '';
    const optimum = instance.optimumSource === 'published' ? 'published; the stored optimal tour has exactly this length' : 'exact, found by Held–Karp or by the circle\'s perimeter';
    const weak = instance.coordinates.length >= 40 ? ' A plain GA ends far from the optimum on an instance this size within a classroom number of generations; the gap to it is shown.' : '';
    return `${instance.comment}. ${instance.coordinates.length} cities; distance rule ${instance.ruleText}. ${where}Optimum ${lengthText(instance.optimum, d)} (${optimum}); the best nearest-neighbour tour (tried from every city as the start; it begins at city ${instance.nearestNeighbour.start + 1}) gives ${lengthText(instance.nearestNeighbour.length, d)}.${weak}`;
  });
  const chooseInstance = (value: string) => {
    draft = withInstance($state.snapshot(draft) as Draft, { instance: value });
  };
  const chooseMutationType = (value: string) => {
    draft.mutation.operator = value as Draft['mutation']['operator'];
    commit();
  };
  const chooseOperator = (value: string) => {
    draft.crossover.operator = value as Draft['crossover']['operator'];
    if (value === 'blx-alpha') draft.crossover.alpha ??= '0.5';
    else delete draft.crossover.alpha;
    commit();
  };

  // "was → now" for settings that are pending
  const applied = $derived.by(() => {
    void session.version;
    return draftOf(run.snapshot(run.lastCycle).params, run.setup, run.seed, session.problemOptions);
  });
  const isPending = (label: string) => session.pending.includes(label);
  const pendingFor = (label: string, was: string, now: string) => (isPending(label) ? `${was} → ${now}` : undefined);
  const tag = (label: string) => (isPending(label) ? '' : undefined);

  const size = $derived(draft.init === 'random' ? Number(draft.size) : chromosomePieces(draft.chromosomes, problem).length);
  const elitePercent = $derived.by(() => {
    const e = Number(draft.elites);
    return size > 0 && Number.isFinite(e) ? `${Math.round((e / size) * 1000) / 10}% of N` : '';
  });
  const warnings = $derived.by(() => {
    if (anyError) return [];
    return gaAlgorithm.warnings(toSetup(draft, problem), toParams(draft));
  });
  const blamed = $derived(validation.chainStep);

  // only the presets of the problem that is running
  const presets = $derived(allPresets.filter((p) => p.problem === session.problemEntry.id));
  let chosenPreset = $state('');
  $effect(() => {
    if (!presets.some((p) => p.id === chosenPreset)) chosenPreset = presets[0]?.id ?? '';
  });
  const preset = $derived(presets.find((p) => p.id === chosenPreset));
  const loadPreset = () => {
    if (!preset) return;
    session.requestPreset(preset);
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

  {#if presets.length > 0}
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
  {/if}

  <div class="sec" data-section="share">
    <h3>Share</h3>
    <ShareLink {session} />
  </div>

  <div class="sec" data-section="setup">
    <h3>Run setup <span class="tag reset"><span aria-hidden="true">↺</span> needs reset</span></h3>
    {#if draft.landscape}
      <DrawerRow label="Function" id="function" error={errors.function} help={fnInfo ? `${fnInfo.formula}. ${fnInfo.goal === 'maximise' ? 'Higher f is better, so fitness = f.' : 'f is to be made small, so fitness = −f: higher fitness is always better.'}` : undefined}>
        <select id="function" bind:value={draft.landscape.function} aria-describedby="function-help">
          {#each landscapeFunctions as fn (fn)}<option value={fn}>{landscapeFunctionInfo[fn].name} ({landscapeFunctionInfo[fn].goal})</option>{/each}
        </select>
      </DrawerRow>
      <DrawerRow label="Representation" id="representation" error={errors.representation} help={realValued ? 'Two real numbers, x and y. BLX-α, arithmetic crossover and Gaussian mutation are available.' : 'Each variable is written in bits (x first, then y); the bit operators of the earlier problems apply.'}>
        <select id="representation" value={draft.landscape.representation} onchange={(e) => chooseRepresentation(e.currentTarget.value)} aria-describedby="representation-help">
          <option value="real">Real-valued (x, y)</option>
          <option value="plain">Binary-coded, plain binary</option>
          <option value="gray">Binary-coded, Gray code</option>
        </select>
      </DrawerRow>
      {#if binaryCoded}
        <DrawerRow label="Bits per variable n" id="bits" error={errors.bitsPerVariable} help={`${landscapeLimits.minBits} to ${landscapeLimits.maxBits}. A chromosome has 2 × n bits: n for x, then n for y; a variable is decoded as lo + (hi − lo) · v / (2ⁿ − 1).`}>
          <input id="bits" type="text" inputmode="numeric" bind:value={draft.landscape.bits} aria-invalid={errors.bitsPerVariable ? 'true' : undefined} aria-describedby={errors.bitsPerVariable ? 'bits-error' : 'bits-help'} />
        </DrawerRow>
      {/if}
    {/if}
    {#if draft.tsp}
      <DrawerRow label="Instance" id="instance" error={errors.instance} help={instanceHelp}>
        <select id="instance" value={draft.tsp.instance} onchange={(e) => chooseInstance(e.currentTarget.value)} aria-describedby={errors.instance ? 'instance-error' : 'instance-help'}>
          <optgroup label="Own instances (exact optimum)">
            {#each ownInstances as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
          </optgroup>
          <optgroup label="TSPLIB (Reinelt, 1991; published optimum)">
            {#each libInstances as c (c.id)}<option value={c.id}>{c.name} · {c.cities} cities · {c.rule}</option>{/each}
          </optgroup>
        </select>
      </DrawerRow>
      {#if sized}
        <DrawerRow label="Number of cities n" id="cities" error={errors.cities} help={`${tspLimits.minCities} to ${tspLimits.maxCities}. ${draft.tsp.instance === 'circle' ? 'The cities are evenly spaced on a circle.' : 'The cities are placed at random in a square, from the instance seed below.'}`}>
          <input id="cities" type="text" inputmode="numeric" bind:value={draft.tsp.n} aria-invalid={errors.cities ? 'true' : undefined} aria-describedby={errors.cities ? 'cities-error' : 'cities-help'} />
        </DrawerRow>
      {/if}
      {#if draft.tsp.instance === 'random'}
        <DrawerRow label="Instance seed" id="city-seed" error={errors.citySeed} help="Which cities the random instance has; the same seed and n always give the same map. (The run's own seed, below, decides the population and the operators' draws.)">
          <input id="city-seed" type="text" inputmode="numeric" bind:value={draft.tsp.seed} aria-invalid={errors.citySeed ? 'true' : undefined} aria-describedby={errors.citySeed ? 'city-seed-error' : 'city-seed-help'} />
        </DrawerRow>
      {/if}
    {/if}
    {#if draft.knapsack}
      <DrawerRow label="Constraint handling" id="handling" error={errors.handling} help={handlingHelp[draft.knapsack.handling]}>
        <select id="handling" bind:value={draft.knapsack.handling} aria-describedby="handling-help">
          <option value="decoder">First-fit decoder</option>
          <option value="penalty">Penalty</option>
          <option value="repair-lamarckian">Repair (Lamarckian)</option>
          <option value="repair-baldwinian">Repair (Baldwinian)</option>
        </select>
      </DrawerRow>
      {#if draft.knapsack.handling === 'penalty'}
        <DrawerRow label="Penalty ρ" id="rho" error={errors.rho} help="Fitness lost per unit of weight above the capacity. Too small and an overweight bag can beat the optimum; too large and the search avoids the boundary.">
          <input id="rho" type="text" inputmode="decimal" bind:value={draft.knapsack.rho} aria-invalid={errors.rho ? 'true' : undefined} aria-describedby={errors.rho ? 'rho-error' : 'rho-help'} />
        </DrawerRow>
      {/if}
      <DrawerRow label="Capacity" id="capacity" error={errors.capacity} help={`How much the bag holds, at most the total weight (${totalWeight}).`}>
        <input id="capacity" type="text" inputmode="numeric" bind:value={draft.knapsack.capacity} aria-invalid={errors.capacity ? 'true' : undefined} aria-describedby={errors.capacity ? 'capacity-error' : 'capacity-help'} />
      </DrawerRow>
      <div class="itemtable" data-field="items" class:bad={errors.items !== undefined}>
        <div class="chead" id="items-heading">Items ({knapsackLimits.minItems} to {maxItems})</div>
        <div class="itemgrid" role="group" aria-labelledby="items-heading" aria-describedby={errors.items ? 'items-error' : undefined}>
          {#each [draft.knapsack.items.slice(0, firstHalf), draft.knapsack.items.slice(firstHalf)] as half, h (h)}
            <table>
              <thead><tr><th></th><th>Weight</th><th>Value</th><th></th></tr></thead>
              <tbody>
                {#each half as item, j (h * firstHalf + j)}
                  {@const k = h * firstHalf + j}
                  <tr>
                    <td><b>{itemName(k)}</b></td>
                    <td><input type="text" inputmode="numeric" id="item-weight-{k}" aria-label={`Item ${itemName(k)} weight`} bind:value={item.weight} aria-invalid={wholeIn(item.weight, knapsackLimits.maxWeight) ? undefined : 'true'} class:bad={!wholeIn(item.weight, knapsackLimits.maxWeight)} /></td>
                    <td><input type="text" inputmode="numeric" id="item-value-{k}" aria-label={`Item ${itemName(k)} value`} bind:value={item.value} aria-invalid={wholeIn(item.value, knapsackLimits.maxValue) ? undefined : 'true'} class:bad={!wholeIn(item.value, knapsackLimits.maxValue)} /></td>
                    <td><button class="btn quiet tiny" type="button" aria-label={`Remove item ${itemName(k)}`} disabled={itemCount <= knapsackLimits.minItems} onclick={() => removeItem(k)}><span aria-hidden="true">✕</span></button></td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/each}
        </div>
        <button class="btn" type="button" id="add-item" disabled={itemCount >= maxItems} onclick={addItem}>+ Add item</button>
        {#if errors.items}<p class="err" role="alert" id="items-error">{errors.items}</p>{/if}
      </div>
    {/if}
    {#if draft.trap}
      <DrawerRow label="Block size k" id="block-size" error={errors.blockSize} help={`Genes per block, ${trapLimits.minBlockSize} to ${trapLimits.maxBlockSize}.`}>
        <input id="block-size" type="text" inputmode="numeric" bind:value={draft.trap.blockSize} aria-invalid={errors.blockSize ? 'true' : undefined} aria-describedby={errors.blockSize ? 'block-size-error' : 'block-size-help'} />
      </DrawerRow>
      <DrawerRow label="Number of blocks m" id="blocks" error={errors.blocks ?? errors.genes} help={`${trapLimits.minBlocks} to ${trapLimits.maxBlocks} blocks, at most ${trapLimits.maxGenes} genes in all${trapSizes ? ` (${trapSizes.k} × ${trapSizes.m} = ${trapSizes.k * trapSizes.m})` : ''}.`}>
        <input id="blocks" type="text" inputmode="numeric" bind:value={draft.trap.blocks} aria-invalid={errors.blocks || errors.genes ? 'true' : undefined} aria-describedby={errors.blocks || errors.genes ? 'blocks-error' : 'blocks-help'} />
      </DrawerRow>
      <DrawerRow label="Linkage" id="linkage" error={errors.linkage} help={linkageHelp}>
        <select id="linkage" bind:value={draft.trap.linkage} aria-describedby="linkage-help">
          {#each linkages as linkage (linkage)}<option value={linkage}>{linkage === 'tight' ? 'Tight: a block’s genes sit side by side' : 'Loose: the blocks are interleaved'}</option>{/each}
        </select>
      </DrawerRow>
      <p class="trapdef" data-testid="trap-definition"><b>The trap.</b> {trapDefinition(trapSizes?.k, trapSizes?.m)}</p>
    {/if}
    {#if draft.options}
      <DrawerRow label="Target" id="target" wide error={errors.target} help={`The string to evolve toward, at most 24 characters from the alphabet. ${[...draft.options.target].length} characters, so the best possible fitness is ${[...draft.options.target].length}.`}>
        <input id="target" class="textfield" type="text" spellcheck="false" autocomplete="off" bind:value={draft.options.target} aria-invalid={errors.target ? 'true' : undefined} aria-describedby={errors.target ? 'target-error' : 'target-help'} />
      </DrawerRow>
      <DrawerRow label="Alphabet" id="alphabet" wide error={errors.alphabet} help={`Every symbol a gene can take, in order, each once. ${[...draft.options.alphabet].length} symbols. A space (shown as ␣) counts as a symbol.`}>
        <input id="alphabet" class="textfield" type="text" spellcheck="false" autocomplete="off" bind:value={draft.options.alphabet} aria-invalid={errors.alphabet ? 'true' : undefined} aria-describedby={errors.alphabet ? 'alphabet-error' : 'alphabet-help'} />
      </DrawerRow>
    {/if}
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
      <DrawerRow label="Chromosomes" id="chromosomes" wide error={errors.chromosomes} help={problem.bounds ? 'One per line: x and y separated by a space or a comma (a semicolon also ends a chromosome). The table shows what each decodes to and its fitness.' : 'One per line (spaces and commas also separate them). The table shows what each decodes to and its fitness.'}>
        <PopulationEditor bind:text={draft.chromosomes} {problem} error={undefined} />
      </DrawerRow>
    {/if}
    <DrawerRow label="Seed" id="seed" error={errors.seed} help="The same seed and settings always give the same run.">
      <input id="seed" type="text" inputmode="numeric" bind:value={draft.seed} aria-invalid={errors.seed ? 'true' : undefined} aria-describedby={errors.seed ? 'seed-error' : 'seed-help'} />
    </DrawerRow>
    <div class="applyreset">
      <button class="btn primary" onclick={applyReset} disabled={anyError || !setupChanges || setupChanges.length === 0} data-testid="apply-reset">Apply and restart</button>
      <span class="help">
        {#if anyError}Fix the highlighted fields first.{#if errors['crossover.operator']} The crossover type does not fit the target (see Crossover).{/if}
        {:else if setupChanges && setupChanges.length > 0}Changed: {setupChanges.join(', ')}. Restarts the run from generation 0.{#each setupNotes as note (note)}{' '}<span data-testid="reset-note">{note}</span>{/each}{#if setupChanges.includes('Target fitness')} The stop at “target fitness reached” moves to the new {draft.options ? "target's length" : draft.trap ? 'optimum, k × m' : "instance's optimum"} ({followed}).{/if}
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
    <DrawerRow label="Type" id="crossover-type" error={errors['crossover.operator']} pending={tag('Crossover type')} help={permutation ? 'Offered for permutations: order, partial-mapped and cycle crossover. One-point, two-point and uniform crossover would repeat and lose cities, so they are not offered.' : undefined}>
      <select id="crossover-type" value={draft.crossover.operator} onchange={(e) => chooseOperator(e.currentTarget.value)}>
        {#if permutation}
          <option value="ox">Order crossover (OX)</option>
          <option value="pmx">Partial-mapped (PMX)</option>
          <option value="cx">Cycle (CX)</option>
        {:else}
          <option value="one-point">One-point</option>
          <option value="two-point">Two-point{realValued ? ' (needs 3 genes)' : ''}</option>
          <option value="uniform">Uniform</option>
          {#if realValued}
            <option value="blx-alpha">BLX-α</option>
            <option value="arithmetic">Arithmetic</option>
          {/if}
        {/if}
      </select>
    </DrawerRow>
    {#if draft.crossover.alpha !== undefined}
      <DrawerRow label="α" id="crossover-alpha" error={errors['crossover.alpha']} pending={pendingFor('Crossover α', applied.crossover.alpha ?? '', draft.crossover.alpha)} help="How far a child gene may fall outside the interval between its parents' values, as a share of that interval's length on each side. 0 keeps children between their parents. Values beyond the bounds are clamped.">
        <input id="crossover-alpha" type="text" inputmode="decimal" bind:value={draft.crossover.alpha} onchange={commit} aria-invalid={errors['crossover.alpha'] ? 'true' : undefined} aria-describedby={errors['crossover.alpha'] ? 'crossover-alpha-error' : 'crossover-alpha-help'} />
      </DrawerRow>
    {/if}
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
    {#if permutation}
      <DrawerRow label="Type" id="mutation-operator" error={errors['mutation.operator'] ?? errors['mutation.mode']} pending={tag('Mutation type')} help="One move per mutated individual: swap exchanges two cities, inversion reverses the slice between two positions (a 2-opt move), insertion takes a city out and puts it back elsewhere.">
        <select id="mutation-operator" value={draft.mutation.operator} onchange={(e) => chooseMutationType(e.currentTarget.value)} aria-describedby="mutation-operator-help">
          <option value="swap">Swap</option>
          <option value="inversion">Inversion (2-opt move)</option>
          <option value="insertion">Insertion</option>
        </select>
      </DrawerRow>
    {:else}
    <DrawerRow label="Mode" id="mutation-mode" pending={tag('Mutation mode')}>
      <select id="mutation-mode" value={draft.mutation.mode} onchange={(e) => { draft.mutation.mode = e.currentTarget.value as Draft['mutation']['mode']; commit(); }}>
        <option value="per-gene">Per gene</option>
        <option value="per-individual">Per individual</option>
      </select>
    </DrawerRow>
    {/if}
    <DrawerRow
      label="Probability pm"
      id="mutation-probability"
      error={errors['mutation.probability']}
      pending={pendingFor('Mutation probability', applied.mutation.probability, draft.mutation.probability)}
      help={permutation ? 'Applies per individual, not per city: one draw u per offspring decides whether its tour is mutated at all (u < pm), then the positions are drawn and one move is made.' : 'Per gene: every gene of every offspring draws u and flips if u < pm. Per individual: one draw per offspring decides whether it is mutated at all, then one more draw picks the single gene that flips.'}
    >
      <input id="mutation-probability" type="text" inputmode="decimal" bind:value={draft.mutation.probability} onchange={commit} aria-invalid={errors['mutation.probability'] ? 'true' : undefined} />
    </DrawerRow>
    {#if draft.mutation.sigma !== undefined}
      <DrawerRow label="Step σ" id="mutation-sigma" error={errors['mutation.sigma']} pending={pendingFor('Mutation σ', applied.mutation.sigma ?? '', draft.mutation.sigma)} help="Gaussian mutation adds a normal step to a gene: σ × the gene's range × z, where z is a standard normal draw (from two uniform draws). Values beyond the bounds are clamped.">
        <input id="mutation-sigma" type="text" inputmode="decimal" bind:value={draft.mutation.sigma} onchange={commit} aria-invalid={errors['mutation.sigma'] ? 'true' : undefined} aria-describedby={errors['mutation.sigma'] ? 'mutation-sigma-error' : 'mutation-sigma-help'} />
      </DrawerRow>
    {/if}
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
    {#if draft.stop.epsilon}
      <DrawerRow label="Within ε of the optimum" id="stop-epsilon" error={errors['stop.epsilon']} help={permutation ? 'Reported when the best tour so far is within ε of the optimum: its fitness is at least the best possible fitness minus ε. The default is half a unit for whole-number distances, so it means reaching the optimum, and 0.000001 for real ones.' : "Reported when the best fitness seen so far is at least the best possible fitness minus ε (a real-valued search never hits the optimum exactly). The default is one thousandth of the function's fitness range."}>
        <label class="switch"><input id="stop-epsilon-on" type="checkbox" role="switch" aria-label="Stop within ε of the optimum" checked={draft.stop.epsilon.enabled} onchange={(e) => { draft.stop.epsilon!.enabled = e.currentTarget.checked; commit(); }} /></label>
        <input id="stop-epsilon" type="text" inputmode="decimal" bind:value={draft.stop.epsilon.value} onchange={commit} disabled={!draft.stop.epsilon.enabled} aria-invalid={errors['stop.epsilon'] ? 'true' : undefined} aria-describedby={errors['stop.epsilon'] ? 'stop-epsilon-error' : 'stop-epsilon-help'} />
      </DrawerRow>
    {:else}
    <DrawerRow label="Target fitness reached" id="stop-target" error={errors['stop.target']} help="Reported when the best fitness seen so far is at least this.">
      <label class="switch"><input id="stop-target-on" type="checkbox" role="switch" aria-label="Use a target fitness" checked={draft.stop.target.enabled} onchange={(e) => { draft.stop.target.enabled = e.currentTarget.checked; commit(); }} /></label>
      <input id="stop-target" type="text" inputmode="decimal" bind:value={draft.stop.target.value} onchange={commit} disabled={!draft.stop.target.enabled} />
    </DrawerRow>
    {/if}
    <DrawerRow label="Stagnation window" id="stop-stagnation" error={errors['stop.stagnation']} help="Reported when best so far has not improved for this many generations.">
      <label class="switch"><input id="stop-stagnation-on" type="checkbox" role="switch" aria-label="Use a stagnation window" checked={draft.stop.stagnation.enabled} onchange={(e) => { draft.stop.stagnation.enabled = e.currentTarget.checked; commit(); }} /></label>
      <input id="stop-stagnation" type="text" inputmode="numeric" bind:value={draft.stop.stagnation.window} onchange={commit} disabled={!draft.stop.stagnation.enabled} />
    </DrawerRow>
  </div>
</aside>
