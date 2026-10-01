<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * Quando non c'è ancora niente: cosa manca, e da dove si comincia.
   * Lo stesso disegno di restaurant-index, con le parole che passa chi lo usa.
   */
  let {
    title,
    line,
    children,
  }: {
    title: string;
    line?: string;
    /** Il tasto per cominciare, se c'è. */
    children?: Snippet;
  } = $props();
</script>

<div class="empty">
  <p class="empty-title">{title}</p>
  {#if line}<p class="empty-line">{line}</p>{/if}
  {@render children?.()}
</div>

<style>
  .empty {
    display: grid;
    gap: 8px;
    padding: 10px 8px 6px;
  }

  .empty-title {
    margin: 0;
    font-size: 13px;
    font-weight: 560;
    letter-spacing: -0.008em;
  }

  .empty-line {
    margin: 0;
    font-size: 12.5px;
    line-height: 1.45;
    color: var(--ink-3);
  }

  .empty :global(.btn) { justify-self: start; margin-top: 2px; }
</style>
