<script lang="ts" generics="P extends Record<string, unknown>">
  import type { Component } from 'svelte';

  /**
   * Un pezzo dell'app che si scarica quando serve.
   *
   * La prima schermata è la mappa, e prima pesava quanto tutta l'app: le
   * pagine di servizio, la conversazione per collegare un account, Leaflet
   * anche su un telefono dove la mappa non c'è. Ognuna di queste adesso
   * arriva la prima volta che la si apre, e dopo resta in memoria.
   *
   * Mentre arriva non si mostra niente: è una frazione di secondo, e un
   * segnaposto che lampeggia per così poco si nota più del vuoto.
   */
  let {
    load,
    props,
  }: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    load: () => Promise<{ default: Component<any> }>;
    props?: P;
  } = $props();
</script>

{#await load() then modulo}
  {@const Pezzo = modulo.default}
  <Pezzo {...props ?? {}} />
{:catch errore}
  <p class="lazy-fail">
    Questa parte dell’app non si è scaricata, forse perché la rete è caduta. Ricarica la pagina.
    <small>{errore.message}</small>
  </p>
{/await}

<style>
  .lazy-fail {
    margin: 24px 16px;
    font-size: 13px;
    line-height: 1.5;
    color: var(--ink-2);
  }

  .lazy-fail small {
    display: block;
    color: var(--ink-3);
  }
</style>
