<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * Un'istruzione che galleggia in alto mentre si sta facendo una cosa sola.
   *
   * In restaurant-index diceva di toccare la mappa dove sta il luogo nuovo;
   * qui dice quello che le passa chi la mostra, e quando smettere: con `esc`
   * ricorda che Esc torna indietro.
   */
  let { esc = false, children }: { esc?: boolean; children: Snippet } = $props();
</script>

<div id="hint" role="status">
  {@render children()}
  {#if esc}<kbd>Esc</kbd>{/if}
</div>

<style>
/* hint -------------------------------------------------------------------- */

#hint {
  position: absolute;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-hint);
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 14px;
  border-radius: 99px;
  background: rgb(14 17 22 / 0.86);
  -webkit-backdrop-filter: blur(20px);
  backdrop-filter: blur(20px);
  color: #fff;
  font-size: 12.5px;
  white-space: nowrap;
  box-shadow: var(--shadow-3);
  animation: drop-in 0.3s var(--ease);
}

#hint kbd {
  font: inherit;
  font-size: 10.5px;
  padding: 1px 6px;
  border-radius: 6px;
  background: rgb(255 255 255 / 0.14);
  color: rgb(255 255 255 / 0.75);
}
</style>
