<script lang="ts" generics="T extends string">
  /**
   * Le linguette dell'app. Erano scritte tre volte — la scheda di gestione,
   * quella di un luogo, e i due modi dell'indice — e tre copie della stessa
   * cosa ricominciano a divergere di un pixel per volta. Chi le usa passa
   * delle voci, non delle classi.
   *
   * Due vestiti, come per `Button`:
   *
   * - `pill`: la pastiglia, per scegliere cosa riempie una scheda intera
   * - `text`: due parole in maiuscoletto separate da un punto. Quella accesa
   *   fa da titolo della sezione, l'altra sta lì pronta — nel pannello è
   *   l'intestazione stessa, e una pastiglia lì peserebbe troppo
   *
   * Se le voci hanno un `href` diventano collegamenti dentro un `nav`: le
   * pagine di servizio sono indirizzi veri, e un indirizzo si deve poter
   * aprire in un'altra scheda, copiare, mettere fra i preferiti. Il vestito
   * resta questo — una barra che cambia pagina e una che cambia sezione non
   * hanno motivo di essere due disegni diversi.
   */
  type Look = 'pill' | 'text';

  let {
    value,
    options,
    onpick,
    label = 'Sezioni',
    look = 'pill',
  }: {
    value: T;
    options: { id: T; label: string; title?: string; href?: string }[];
    /** Non serve se le voci sono collegamenti: ci pensa il browser. */
    onpick?: (id: T) => void;
    /** Come si chiama questo gruppo di linguette, per chi non lo vede. */
    label?: string;
    look?: Look;
  } = $props();
</script>

{#snippet tab(option: { id: T; label: string; title?: string; href?: string })}
  {#if option.href}
    <!-- niente `role="tab"`: qui non si scopre un pannello, si cambia pagina -->
    <a
      class="tab"
      class:is-on={value === option.id}
      href={option.href}
      title={option.title}
      aria-current={value === option.id ? 'page' : undefined}
    >
      {option.label}
    </a>
  {:else}
    <button
      class="tab"
      class:is-on={value === option.id}
      type="button"
      role="tab"
      aria-selected={value === option.id}
      title={option.title}
      onclick={() => onpick?.(option.id)}
    >
      {option.label}
    </button>
  {/if}
{/snippet}

{#if options.some((one) => one.href)}
  <nav class="tabs {look} is-nav" aria-label={label}>
    {#each options as option (option.id)}{@render tab(option)}{/each}
  </nav>
{:else}
  <div class="tabs {look}" role="tablist" aria-label={label}>
    {#each options as option, at (option.id)}
      {#if look === 'text' && at > 0}<span class="split" aria-hidden="true"></span>{/if}
      {@render tab(option)}
    {/each}
  </div>
{/if}

<style>
  .tabs { display: flex; align-items: center; }

  .tab {
    border: 0;
    background: none;
    text-decoration: none;
    transition: background 0.16s, color 0.16s, box-shadow 0.16s, opacity 0.16s;
  }

  /* la pastiglia ---------------------------------------------------------- */

  .tabs.pill {
    gap: 2px;
    padding: 3px;
    margin-bottom: 12px;
    border-radius: 99px;
    background: var(--sunken);
  }

  .tabs.pill .tab {
    flex: 1 1 50%;
    min-width: 0;
    padding: 7px 9px;
    border-radius: 99px;
    color: var(--ink-3);
    font-size: 12.5px;
    font-weight: 540;
    white-space: nowrap;
  }

  @media (hover: hover) {
  .tabs.pill .tab:hover { color: var(--ink-2); }
}

  /* quando sono indirizzi stanno larghe quanto la parola: in testa a una
     pagina una barra tirata per tutta la riga sembrerebbe la pagina stessa */
  .tabs.pill.is-nav { justify-self: start; align-self: start; margin-bottom: 0; }

  .tabs.pill.is-nav .tab { flex: none; }

  .tabs.pill .tab.is-on {
    background: var(--glass-strong);
    color: var(--ink);
    /* una sfocatura larga uscirebbe dai 3px di bordo e si leggerebbe come
       meno spazio sotto */
    box-shadow: 0 1px 2px rgb(10 13 18 / 0.18);
  }

  /* le due parole --------------------------------------------------------- */

  .tabs.text { gap: 8px; }

  .tabs.text .tab {
    padding: 0;
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.085em;
    text-transform: uppercase;
    color: var(--ink-3);
    opacity: 0.55;
  }

  @media (hover: hover) {
  .tabs.text .tab:hover { opacity: 1; }
}

  /*
   * Dove si tocca, una linguetta è alta quanto un dito.
   * Scritta così com'è misurava quindici pixel: si legge benissimo e si
   * prende per sbaglio, perché il polpastrello ne copre quaranta. Lo spazio
   * si aggiunge sotto e sopra al testo, non intorno alla fila, così la riga
   * resta dov'era e a crescere è solo il bersaglio.
   */
  @media (hover: none) {
    .tabs.text { gap: 4px; margin: -11px 0; }
    .tabs.text .tab { padding: 11px 5px; }

    /* Anche quelle a pastiglia: erano alte trentadue pixel, e un polpastrello
       ne copre quaranta. Qui lo spazio si aggiunge e basta, perché la barra è
       già un blocco suo e crescere di otto pixel non sposta niente. */
    .tabs.pill .tab { padding: 11px 14px; font-size: 13px; }
  }

  .tabs.text .tab.is-on { color: var(--ink); opacity: 1; }

  .tabs.text .split {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: var(--ink-3);
    opacity: 0.35;
  }
</style>
