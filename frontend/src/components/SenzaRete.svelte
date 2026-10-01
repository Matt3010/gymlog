<script lang="ts">
  import { rete } from '../lib/rete.svelte';
  import { outbox } from '../lib/sync';

  /**
   * Una riga che dice che la rete manca, finché manca.
   *
   * Senza, ci si accorgeva della rete caduta solo dopo aver scritto e
   * premuto «Salva». Sta in alto, piccola e ferma, e non chiede niente: se
   * ne va da sola quando la rete torna. È di tutta l'app, non di una pagina.
   *
   * Quello che si segna senza rete resta sul telefono e parte quando torna
   * (lib/outbox): lo dice, con quante modifiche aspettano.
   */
  const waiting = $derived(outbox.pending === 1 ? '1 modifica in attesa.' : `${outbox.pending} modifiche in attesa.`);
</script>

{#if rete.manca}
  <p class="rete" role="status" data-rete>
    <span class="punto" aria-hidden="true"></span>
    Il telefono è senza rete. Quello che segni resta sul telefono e parte quando torna.{#if outbox.pending > 0}{' '}{waiting}{/if}
  </p>
{/if}

<style>
  .rete {
    position: fixed;
    top: calc(12px + env(safe-area-inset-top));
    left: 50%;
    transform: translateX(-50%);
    z-index: var(--z-toast);
    display: flex;
    align-items: center;
    gap: 8px;
    width: max-content;
    max-width: calc(100vw - 32px);
    box-sizing: border-box;
    margin: 0;
    padding: 6px 13px 6px 11px;
    border-radius: 99px;
    background: var(--glass-strong);
    box-shadow: inset 0 0 0 1px var(--hairline);
    color: var(--ink-2);
    font-size: 12px;
    line-height: 1.35;
    pointer-events: none;
  }

  /* il pallino arancione vuol dire «qualcosa non arriva», che è proprio questo */
  .punto {
    flex: none;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--warn);
  }
</style>
