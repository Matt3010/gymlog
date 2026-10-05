<script lang="ts">
  import type { Snippet } from 'svelte';
  import AccountButton from './AccountButton.svelte';
  import Icon from './Icon.svelte';

  /**
   * Il foglio di ogni pagina: la testata e, sotto, le schede.
   *
   * È la PageShell di restaurant-index senza la fila delle stanze, che qui
   * sta in fondo (TabBar), e con le schede in una colonna sola anche su uno
   * schermo largo: quello che si legge è un elenco da scorrere col pollice,
   * non un giornale.
   */
  let {
    title,
    count,
    lead,
    back,
    meta,
    tools,
    children,
  }: {
    title: string;
    /** Quante cose ci sono dentro, se dirlo aiuta. Zero non si scrive. */
    count?: number;
    /** Una riga che dice a cosa serve la pagina. */
    lead?: string;
    /** Dove porta il ritorno in cima, quando la pagina sta dentro un'altra. */
    back?: { href: string; label: string };
    /** Una riga sotto il titolo, dentro la testata. */
    meta?: Snippet;
    /** I comandi che valgono per tutta la pagina, accanto al titolo. */
    tools?: Snippet;
    children: Snippet;
  } = $props();
</script>

<div class="page">
  <header>
    {#if back}
      <a class="back" href={back.href}>
        <Icon name="prev" />
        {back.label}
      </a>
    {/if}

    <div class="named">
      <h1>{title}</h1>
      {#if count}<span class="how-many">{count}</span>{/if}
      <!-- i comandi della pagina, poi chi sei: sempre lì, in ogni pagina -->
      <span class="tools">{@render tools?.()}<AccountButton /></span>
    </div>
    {#if lead}<p class="lead">{lead}</p>{/if}
    {@render meta?.()}
  </header>

  <div class="cards">
    {@render children()}
  </div>
</div>

<style>
  .page {
    min-height: 100%;
    /* Gli angoli del telefono: installata nella schermata home la pagina
       arriva fin sotto l'orologio. In fondo, lo spazio della barra e quello
       di un messaggio, che non deve coprire gli ultimi tasti. */
    padding: calc(24px + env(safe-area-inset-top)) max(16px, env(safe-area-inset-right))
      var(--sopra-alla-barra) max(16px, env(safe-area-inset-left));
  }

  @media (max-width: 600px) {
    .page {
      padding-right: max(12px, env(safe-area-inset-right));
      padding-left: max(12px, env(safe-area-inset-left));
    }
  }

  header {
    max-width: 640px;
    margin: 0 auto 18px;
    display: grid;
    gap: 6px;
  }

  .back {
    justify-self: start;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 4px;
    font-size: 12.5px;
    color: var(--ink-3);
    text-decoration: none;
    transition: color 0.16s;
  }

  @media (hover: hover) {
  .back:hover { color: var(--ink); }
}

  /* dove si tocca, il ritorno è alto quanto un dito; il titolo non si muove */
  @media (hover: none) {
    .back { padding: 10px 2px; margin: -10px -2px -6px; }
  }

  .back :global(.ico) { width: 15px; height: 15px; }

  .named { display: flex; align-items: baseline; gap: 9px; min-width: 0; }

  h1 {
    margin: 0;
    min-width: 0;
    font-size: 24px;
    font-weight: 620;
    letter-spacing: -0.022em;
    color: var(--ink);
    overflow-wrap: anywhere;
  }

  .how-many {
    font-size: 12.5px;
    font-variant-numeric: tabular-nums;
    color: var(--ink-3);
  }

  .tools { margin-left: auto; align-self: center; display: flex; gap: 6px; }

  .lead {
    margin: 0;
    max-width: 62ch;
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--ink-3);
  }

  /* I blocchi della pagina — le card, un invito, un avviso, una fila di
     tasti — uno sotto l'altro, sempre alla stessa distanza: la dà la
     colonna, non il margine di ognuno, così anche quello che non è una card
     (l'invito a installare) non si appiccica alla card sotto. */
  .cards {
    max-width: 640px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 14px;
  }
</style>
