<script lang="ts">
  import type { Autosave } from '../lib/autosave.svelte';

  /**
   * Come va il salvataggio, detto piano accanto a quello che si scrive:
   * «Salvataggio…» mentre parte, «Salvata» quando è arrivato. Niente quando
   * non è successo niente; il motivo di un rifiuto lo dice un `Alert` di chi
   * lo usa, perché va letto.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { saver }: { saver: Autosave<any> } = $props();
</script>

<span class="save-status" role="status" aria-label="Salvataggio">
  {saver.status === 'saving' ? 'Salvataggio…' : saver.status === 'saved' ? 'Salvata' : ''}
</span>

<style>
  .save-status { font-size: 11.5px; font-weight: 500; letter-spacing: 0; text-transform: none; color: var(--ink-3); }
</style>
