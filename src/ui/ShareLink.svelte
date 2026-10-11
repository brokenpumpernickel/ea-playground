<script lang="ts">
  import { linkFor, longLinkLimit } from './share-link';
  import type { Session } from './session.svelte';

  let { session }: { session: Session } = $props();

  let link = $state<string | undefined>(undefined);
  let copied = $state<boolean | undefined>(undefined);

  const onFile = typeof location !== 'undefined' && location.protocol === 'file:';
  const tooLong = $derived(link !== undefined && link.length > longLinkLimit);

  async function copy() {
    const url = linkFor(location.href, session.shareConfig);
    link = url;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch {
      // clipboard access can be unavailable or refused; the link is then shown to be copied by hand
      copied = false;
    }
  }
</script>

<div class="ctl wide" data-field="share">
  <span class="label">Link to this configuration</span>
  <p class="help">Opens the same paused run at generation 0, with these settings and this seed, for anyone who has the link. It does not carry the history or where you are in it.</p>
  <div class="sharerow">
    <button class="btn" onclick={copy} data-testid="copy-link">Copy link</button>
    {#if copied === true}<span role="status" data-testid="share-status">Link copied.</span>{/if}
  </div>
  {#if copied === false}
    <p class="err" role="alert" data-testid="share-status">The link could not be copied automatically. Select it below and copy it yourself.</p>
    <input class="linkfield" type="text" readonly value={link} aria-label="Share link" onfocus={(e) => e.currentTarget.select()} data-testid="share-field" />
  {/if}
  {#if tooLong}<p class="err" role="alert" data-testid="share-long">This link is {link!.length} characters long. Some chat and mail tools cut or break links over about {longLinkLimit}; try a smaller population.</p>{/if}
  {#if onFile}<p class="help" data-testid="share-file">This copy of the app is opened from a file, so the link only opens on this computer. Publish the app to share links with others.</p>{/if}
</div>
