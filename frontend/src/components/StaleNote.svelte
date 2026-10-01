<script lang="ts">
  /*
   * Quando l'ultima rilettura di qualcosa non è arrivata.
   *
   * Quello che c'era resta sullo schermo, perché è vecchio e non sbagliato:
   * svuotarlo faceva sparire le cose da sotto a chi ci lavorava. Ma chi
   * guarda deve sapere che non è fresco, e perché, se no crede a un elenco
   * che nel frattempo è cambiato.
   *
   * In restaurant-index parlava di agenti, dispositivi e scene; qui chi la
   * usa dice di cosa (`what`: «gli allenamenti»), il perché (`problem`) e se
   * una lettura buona c'è già stata (`letto`).
   */
  let { what, problem, letto }: { what: string; problem: string | null; letto: boolean } = $props();
</script>

{#if problem}
  <p class="stale" role="status">
    {#if letto}
      Quello che vedi è dell’ultima lettura riuscita, perché {what} non si rileggono ({problem}).
    {:else}
      {what[0]?.toUpperCase()}{what.slice(1)} non si vedono perché la prima lettura non è riuscita
      ({problem}). Ricaricando la pagina si riprova.
    {/if}
  </p>
{/if}

<style>
  .stale {
    margin: 0;
    max-width: 62ch;
    font-size: 12px;
    line-height: 1.45;
    color: var(--warn);
  }
</style>
