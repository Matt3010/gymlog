<script lang="ts">
  import { install } from '../lib/install.svelte';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';

  /**
   * L'invito a installare l'app, con il motivo.
   *
   * In cima alla home è un invito, e chi dice «non ora» non lo rivede
   * (`chiudibile`). Senza, non si chiude: serve dove spiega perché manca
   * qualcosa che c'è solo da installata.
   */
  let { chiudibile = false }: { chiudibile?: boolean } = $props();
</script>

{#if install.possibile && !(chiudibile && install.nonOra)}
  <div class="invito" class:is-card={chiudibile}>
    <Icon name="download" />
    <span class="testo">
      {#if install.iPhone}
        Aggiungi gymlog alla schermata Home e in palestra si apre come un’app, anche senza rete. Tocca
        <b>Condividi</b>, poi <b>Aggiungi alla schermata Home</b>.
      {:else}
        Installala e si apre come un’app, a tutto schermo, anche senza rete.
      {/if}
    </span>
    {#if install.offerta}
      <Button size="sm" look="primary" onclick={() => void install.installa()}>Installa</Button>
    {/if}
    {#if chiudibile}
      <Button look="icon" title="Non ora" onclick={() => install.lascia()}>
        <Icon name="close" />
      </Button>
    {/if}
  </div>
{/if}

<style>
  .invito {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    line-height: 1.45;
    color: var(--ink-2);
  }

  .invito > :global(.ico) { width: 16px; height: 16px; flex: none; color: var(--ink-3); }

  .testo { flex: 1; min-width: 0; }

  .testo b { font-weight: 600; color: var(--ink); }

  /* in cima alla home è una cosa a sé, e si stacca dal resto come le righe
     dell'elenco: un fondo appena più chiaro, niente ombra */
  .is-card {
    padding: 10px 6px 10px 12px;
    border-radius: var(--r-md);
    background: var(--sunken);
  }
</style>
