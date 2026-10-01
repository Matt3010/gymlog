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
  /* dentro una card lo spazio intorno lo dà la card: qui niente di suo */
  .empty {
    display: grid;
    gap: 6px;
    padding: 0;
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

  .empty :global(.btn) { margin-top: 4px; }

  @media (min-width: 601px) { .empty :global(.btn) { justify-self: start; } }
</style>
