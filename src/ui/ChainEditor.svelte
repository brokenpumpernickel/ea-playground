<script lang="ts">
  import { weightSteps, type StepName } from '../engine';
  import { defaultStep, type ChainStepDraft } from './drawer-model';

  let {
    chain,
    error,
    badStep,
    ontouch,
  }: {
    chain: ChainStepDraft[];
    error?: string;
    /** The 0-based step the engine blames, to be marked. */
    badStep?: number;
    /** Called after every edit, once the chain has its new value. */
    ontouch: () => void;
  } = $props();

  const names = Object.keys(weightSteps) as StepName[];
  let adding = $state<StepName>('shift');

  const move = (index: number, by: -1 | 1) => {
    const target = index + by;
    if (target < 0 || target >= chain.length) return;
    [chain[index], chain[target]] = [chain[target]!, chain[index]!];
    ontouch();
  };
  const remove = (index: number) => {
    chain.splice(index, 1);
    ontouch();
  };
  const add = () => {
    chain.push(defaultStep(adding));
    ontouch();
  };
</script>

<div class="chain" data-testid="chain-editor">
  <ol>
    {#each chain as step, index (index)}
      {@const spec = weightSteps[step.step]}
      <li class:bad={badStep === index} data-step={step.step}>
        <div class="stephead">
          <b>{index + 1}. {spec.label}</b>
          <span class="steptools">
            <button class="btn tiny" onclick={() => move(index, -1)} disabled={index === 0} aria-label="Move step {index + 1} ({spec.label}) up"><span aria-hidden="true">▲</span></button>
            <button class="btn tiny" onclick={() => move(index, 1)} disabled={index === chain.length - 1} aria-label="Move step {index + 1} ({spec.label}) down"><span aria-hidden="true">▼</span></button>
            <button class="btn tiny" onclick={() => remove(index)} aria-label="Remove step {index + 1} ({spec.label})"><span aria-hidden="true">✕</span></button>
          </span>
        </div>
        <p class="help">{spec.description}</p>
        {#each spec.parameters as parameter (parameter.key)}
          <label class="param">
            <span title={parameter.description}>{parameter.label}</span>
            <input
              type="text"
              inputmode="decimal"
              aria-label="Step {index + 1} ({spec.label}) {parameter.key}"
              value={step.params[parameter.key]}
              oninput={(e) => (step.params[parameter.key] = e.currentTarget.value)}
              onchange={ontouch}
            />
            <small>{parameter.description}</small>
          </label>
        {/each}
      </li>
    {/each}
  </ol>
  <div class="addstep">
    <label for="add-step">Add a step</label>
    <select id="add-step" value={adding} onchange={(e) => (adding = e.currentTarget.value as StepName)}>
      {#each names as name (name)}<option value={name}>{weightSteps[name].label}</option>{/each}
    </select>
    <button class="btn" onclick={add}>Add</button>
  </div>
  {#if error}<p class="err" role="alert" id="chain-error">{error}</p>{/if}
</div>
