<script lang="ts">
  import { install } from '../lib/install.svelte';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';

  /** L'invito a installare l'app. `chiudibile`: «non ora» non lo ripete; senza, spiega cosa c'è solo da installata. */
  let { chiudibile = false }: { chiudibile?: boolean } = $props();
</script>

{#if install.possibile && !(chiudibile && install.nonOra)}
  <div class="invito" class:is-card={chiudibile}>
    <Icon name="download" tone="muted" />
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

  .testo { flex: 1; min-width: 0; }

  .testo b { font-weight: 600; color: var(--ink); }

  /* un fondo appena più chiaro, niente ombra, come le righe dell'elenco */
  .is-card {
    /* 6px tutto intorno ai tasti: sopra, sotto e a destra la stessa distanza, così l'angolo segue */
    padding: 6px 6px 6px 12px;
    /* sta nella pagina, non in una scheda: l'angolo è quello della × (7) più i 6 che la separano dal bordo */
    border-radius: calc(var(--r-in) + 6px);
    background: var(--sunken);
  }

</style>
