<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';

  /**
   * La porta: una scheda sola in mezzo allo schermo.
   *
   * È quella di restaurant-index senza la mappa dietro: qui il paesaggio è un
   * velo di luce sul fondo, perché una porta su un fondo piatto sembra un
   * errore e non un ingresso. Se c'è `onsubmit` la scheda è un modulo, così
   * l'invio da tastiera funziona senza che nessuno ci pensi.
   */
  let {
    title,
    lead,
    onsubmit,
    children,
  }: {
    title: string;
    lead?: string;
    onsubmit?: (event: SubmitEvent) => void;
    children: Snippet;
  } = $props();
</script>

<div class="gate">
  <svelte:element this={onsubmit ? 'form' : 'div'} class="route" {onsubmit}>
    <header class="route-head">
      <span class="wordmark"><Icon name="logo" /> gymlog</span>
      <h1>{title}</h1>
      {#if lead}<p>{lead}</p>{/if}
    </header>
    {@render children()}
  </svelte:element>
</div>

<style>
  .gate {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    padding: calc(24px + env(safe-area-inset-top)) 16px calc(24px + env(safe-area-inset-bottom));
    overflow: auto;
    /* lo stesso colore piatto di ogni altra pagina: il fondo del corpo */
    background: transparent;
    padding-left: max(16px, env(safe-area-inset-left));
    padding-right: max(16px, env(safe-area-inset-right));
    /* un po' sopra il mezzo, dove l'occhio va per primo */
    padding-bottom: calc(12vh + env(safe-area-inset-bottom));
  }

  /* il modulo sta sulla pagina, senza scatola intorno */
  .route {
    position: relative;
    width: min(420px, 100%);
    padding: 0;
    display: grid;
    gap: 18px;
    animation: rise 0.45s var(--ease);
  }

  .route-head { display: grid; gap: 6px; }

  .wordmark {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 12.5px;
    font-weight: 620;
    letter-spacing: -0.01em;
    color: var(--ink-3);
  }

  .wordmark :global(.ico) { width: 15px; height: 15px; }

  h1 {
    margin: 2px 0 0;
    font-size: 22px;
    font-weight: 640;
    letter-spacing: -0.028em;
  }

  .route-head p {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--ink-3);
  }

  /* il tasto grande in fondo, quello che fa andare avanti */
  .route :global(.go) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 18px;
    font-size: 14.5px;
  }

  .route :global(.go .ico) { width: 17px; height: 17px; }
  .route :global(.go:disabled) { opacity: 0.6; }

  @media (max-width: 600px) {
    h1 { font-size: 20px; }
  }
</style>
