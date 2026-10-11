<script lang="ts">
  import { describeMatchRates, type MatchRate } from './match-rate-model';

  let { rates }: { rates: readonly MatchRate[] } = $props();
</script>

<div class="matchbar" role="img" aria-label={describeMatchRates(rates)}>
  {#each rates as rate (rate.position)}
    <div class="gene" data-position={rate.position} data-share={rate.share}>
      <div class="bar" style="height:{Math.round(rate.share * 60) + 4}px"></div>
      <b>{Math.round(rate.share * 100)}%</b>
      <span>{rate.letter === ' ' ? '␣' : rate.letter}</span>
    </div>
  {/each}
</div>
