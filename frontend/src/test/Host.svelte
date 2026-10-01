<script lang="ts">
  import type { Component } from 'svelte';
  import Modal from '../components/Modal.svelte';
  import PickPopover from '../components/PickPopover.svelte';
  import SurePopover from '../components/SurePopover.svelte';
  import Toast from '../components/Toast.svelte';
  import NowBar from '../components/workouts/NowBar.svelte';
  import { ui } from '../lib/ui.svelte';

  /**
   * A screen as the app shows it, for the screens' tests: the page, and over
   * it what App.svelte hosts — the windows, the questions, the message, and
   * the bar of the workout in progress.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { page: Page, params = {} }: { page: Component<any>; params?: Record<string, unknown> } = $props();

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') ui.escape();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<Page {...params} />

{#each ui.modals as request (request)}
  <Modal {request} davanti={request === ui.modal} />
{/each}
{#if ui.sure}<SurePopover />{/if}
{#if ui.pick}<PickPopover />{/if}
<NowBar />
<Toast />
