<script lang="ts">
  let { problems, ondismiss }: { problems: readonly string[]; ondismiss: () => void } = $props();
</script>

<div class="linknotice" role="alert" data-testid="link-notice">
  <div>
    <b>This link could not be opened, so the default configuration is open instead.</b>
    <ul>
      {#each problems as problem (problem)}<li>{problem}</li>{/each}
    </ul>
  </div>
  <button class="btn" onclick={ondismiss}>Dismiss</button>
</div>
