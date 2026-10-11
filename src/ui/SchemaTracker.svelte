<script lang="ts">
  import type { BlockInfo } from './block-context';
  import { describeSchemaMoment, parseSchema, schemaCaveat, schemaDefiningLength, schemaOfBlock, schemaOrder, type SchemaPoint } from './schema-model';

  /**
   * The schema tracker: the student types a schema (or picks "block b solved") and sees, for every recorded generation,
   * how many individuals are instances, their mean fitness against the population's, and a sentence about the generation
   * the cursor is on. It reads the run and never changes it. `history` is given when the text is a valid schema.
   */
  let {
    info,
    text,
    oninput,
    history,
    now,
  }: {
    info: BlockInfo;
    text: string;
    oninput: (text: string) => void;
    history?: readonly SchemaPoint[];
    now: number;
  } = $props();

  const length = $derived(info.blockSize * info.blocks);
  const parsed = $derived(parseSchema(text, length));
  const points = $derived(parsed.ok && history ? history : []);
  const sentence = $derived(parsed.ok && points.length > 0 ? describeSchemaMoment(parsed.text, points, now) : '');

  const W = 520;
  const H = 136;
  const L = 52;
  const R = W - 14;
  const T = 18;
  const B = 98;
  const axes = [15, 30, 50, 100, 200, 500, 1000, 2000];
  const last = $derived(points.length > 0 ? points[points.length - 1]!.generation : 0);
  const xMax = $derived(axes.find((limit) => limit >= last) ?? Math.ceil(last / 1000) * 1000);
  const X = (generation: number) => L + ((R - L) * generation) / xMax;
  const size = $derived(points[0]?.size ?? 1);
  const countMax = $derived(Math.max(1, ...points.map((p) => p.instances), size));
  const fitnessMax = $derived(info.optimum);
  const YCount = (n: number) => B - ((B - T) * n) / countMax;
  const YFit = (v: number) => B - ((B - T) * v) / fitnessMax;
  const barWidth = $derived(Math.max(1.5, Math.min(30, ((R - L) / xMax) * 0.7)));
  const ticksX = $derived(Array.from({ length: 6 }, (_, k) => (xMax / 5) * k));
  const countTicks = $derived(Array.from({ length: 5 }, (_, k) => Math.round((countMax / 4) * k)).filter((v, k, a) => a.indexOf(v) === k));
  const fitTicks = $derived([0, 1, 2, 3, 4].map((k) => Math.round((fitnessMax / 4) * k)).filter((v, k, a) => a.indexOf(v) === k));
  const fmt = (x: number) => String(Number(x.toFixed(2)));
  const meanPath = (pick: (p: SchemaPoint) => number | null) => {
    let d = '';
    for (const p of points) {
      const v = pick(p);
      if (v === null) continue;
      d += `${d === '' || points.indexOf(p) > 0 && pick(points[points.indexOf(p) - 1]!) === null ? 'M' : 'L'}${X(p.generation)},${YFit(v)} `;
    }
    return d.trim();
  };
  const fixed = $derived(parsed.ok ? schemaOrder(parsed.symbols) : 0);
  const spread = $derived(parsed.ok ? schemaDefiningLength(parsed.symbols) : 0);
</script>

<div class="schema" data-testid="schema-tracker">
  <p class="expl">
    A schema fixes some genes and leaves the others free: <b>1</b> = the gene must be 1, <b>0</b> = it must be 0, <b>*</b> = anything. An individual is an <i>instance</i> of a schema when it matches every fixed gene.
  </p>
  <div class="srow">
    <label for="schema-input">Schema ({length} symbols)</label>
    <input
      id="schema-input"
      class="textfield"
      type="text"
      spellcheck="false"
      autocomplete="off"
      value={text}
      style="width:{length * 15 + 24}px"
      aria-invalid={parsed.ok ? undefined : 'true'}
      aria-describedby={parsed.ok ? 'schema-facts' : 'schema-error'}
      oninput={(e) => oninput(e.currentTarget.value)}
    />
    {#if info.blocks > 5}<span class="pick" id="schema-pick">Block solved:</span>{/if}
    {#each Array.from({ length: info.blocks }, (_, b) => b + 1) as b (b)}
      <button class="btn quiet" class:compact={info.blocks > 5} type="button" data-block-solved={b} aria-label="Block {b} solved" onclick={() => oninput(schemaOfBlock(info, b))}>{info.blocks > 5 ? b : `Block ${b} solved`}</button>
    {/each}
  </div>
  {#if !parsed.ok}
    <p class="err" role="alert" id="schema-error" data-testid="schema-error">{parsed.message}</p>
  {:else}
    <p class="sfacts" id="schema-facts" data-testid="schema-facts"><span><b>order</b> {fixed} <i>(fixed genes)</i></span><span><b>defining length</b> {spread} <i>(distance between the outermost fixed genes)</i></span></p>
    <div class="scharts">
      <figure>
        <figcaption>Instances in the population</figcaption>
        <svg viewBox="0 0 {W} {H}" width="100%" role="img" aria-label={`Instances of ${parsed.text} in each generation, out of ${size} individuals.`} data-plot="schema-count" data-now={now}>
          {#each countTicks as v (v)}<line class="gr" x1={L} x2={R} y1={YCount(v)} y2={YCount(v)} /><text x={L - 8} y={YCount(v) + 6} text-anchor="end">{v}</text>{/each}
          {#each ticksX as g (g)}<text x={X(g)} y={B + 20} text-anchor="middle">{fmt(g)}</text>{/each}
          <text x={(L + R) / 2} y={H - 2} text-anchor="middle" style="font-size:14px">generation</text>
          {#each points as p (p.generation)}
            <rect x={X(p.generation) - barWidth / 2} y={YCount(p.instances)} width={barWidth} height={B - YCount(p.instances)} fill="var(--seq3)" opacity={p.generation > now ? 0.35 : 1} data-gen={p.generation} data-value={p.instances} />
          {/each}
          {#if points.some((p) => p.generation === now)}
            {@const here = points.find((p) => p.generation === now)!}
            <line x1={X(now)} x2={X(now)} y1={T - 6} y2={B} stroke="var(--ink)" stroke-width="2" />
            <text x={X(now)} y={YCount(here.instances) - 6} text-anchor="middle" style="font-weight:700;font-size:17px">{here.instances}</text>
          {/if}
        </svg>
      </figure>
      <figure>
        <figcaption>Mean fitness: <b>■</b> of the instances · <b>●</b> of the whole population (dashed)</figcaption>
        <svg viewBox="0 0 {W} {H}" width="100%" role="img" aria-label={`Mean fitness of the instances of ${parsed.text} and of the whole population in each generation, scale 0 to ${fitnessMax}.`} data-plot="schema-fitness" data-now={now}>
          {#each fitTicks as v (v)}<line class="gr" x1={L} x2={R} y1={YFit(v)} y2={YFit(v)} /><text x={L - 8} y={YFit(v) + 6} text-anchor="end">{v}</text>{/each}
          {#each ticksX as g (g)}<text x={X(g)} y={B + 20} text-anchor="middle">{fmt(g)}</text>{/each}
          <text x={(L + R) / 2} y={H - 2} text-anchor="middle" style="font-size:14px">generation</text>
          <path d={meanPath((p) => p.populationMean)} fill="none" stroke="var(--s1)" stroke-width="2.5" stroke-dasharray="7 4" />
          <path d={meanPath((p) => p.instanceMean)} fill="none" stroke="var(--s2)" stroke-width="2.5" />
          {#each points as p (p.generation)}
            <circle cx={X(p.generation)} cy={YFit(p.populationMean)} r="3.5" fill="var(--s1)" data-series="populationMean" data-gen={p.generation} data-value={p.populationMean} />
            {#if p.instanceMean !== null}<rect x={X(p.generation) - 3.5} y={YFit(p.instanceMean) - 3.5} width="7" height="7" fill="var(--s2)" data-series="instanceMean" data-gen={p.generation} data-value={p.instanceMean} />{/if}
          {/each}
          {#if points.some((p) => p.generation === now)}<line x1={X(now)} x2={X(now)} y1={T - 6} y2={B} stroke="var(--ink)" stroke-width="2" />{/if}
        </svg>
      </figure>
    </div>
    <p class="sum" data-testid="schema-sentence" aria-live="polite">{sentence}</p>
    <table class="sr-only" aria-label="Instances of the schema by generation" data-testid="schema-table">
      <thead><tr><th>Generation</th><th>Instances</th><th>Mean fitness of the instances</th><th>Mean fitness of the population</th></tr></thead>
      <tbody>
        {#each points as p (p.generation)}<tr><td>{p.generation}</td><td>{p.instances}</td><td>{p.instanceMean === null ? 'none' : fmt(p.instanceMean)}</td><td>{fmt(p.populationMean)}</td></tr>{/each}
      </tbody>
    </table>
  {/if}
  <p class="caveat" data-testid="schema-caveat">{schemaCaveat}</p>
</div>
