<script lang="ts" generics="T extends { key: string; wait?: number; state?: 'live' | 'lost' | 'unknown'; says?: string; talk?: boolean; now?: boolean; done?: boolean; fino?: number }">
  import type { Snippet } from 'svelte';
  import { saysLeft, saysWait } from '../lib/timing';

  /**
   * Una sequenza letta dall'alto in basso.
   *
   * Le righe di una scena erano un elenco, e un elenco non dice se le cose
   * succedono insieme o una dopo l'altra: l'attesa scritta all'inizio della
   * riga sembrava una sua etichetta, non il tempo che passa prima. Qui il
   * tempo è la linea, e l'attesa è il pezzo di linea più lungo: si vede in un
   * colpo d'occhio dove la scena si ferma e riprende.
   *
   * Il pallino è lo stesso degli altri posti — verde risponde, rosso no,
   * grigio non si sa — perché un segno imparato una volta vale dappertutto.
   *
   * Mentre la sequenza gira, è la linea a dirlo: si colora fin dove è
   * arrivata e il pallino di adesso batte. Una frase in cima che contava i
   * passi diceva la stessa cosa in un punto che con quei passi non c'entra,
   * e lasciava a chi guarda il compito di ritrovare la riga giusta.
   */
  let {
    steps,
    row,
  }: {
    steps: T[];
    /** Cosa c'è scritto su quella riga: il nome, l'azione, e i suoi comandi. */
    row: Snippet<[T, number]>;
  } = $props();

  /*
   * L'orologio per il conto alla rovescia di un'attesa. Batte solo finché
   * c'è un'attesa che sta passando: una pagina ferma non ha niente da contare.
   */
  let adesso = $state(Date.now());
  const conta = $derived(steps.some((step) => step.fino));
  $effect(() => {
    if (!conta) return;
    adesso = Date.now();
    const batti = setInterval(() => (adesso = Date.now()), 1000);
    return () => clearInterval(batti);
  });
</script>

<ol class="rail">
  {#each steps as step, at (step.key)}
    {@const pausa = step.wait}
    <li
      class:is-first={at === 0}
      class:is-last={at === steps.length - 1}
      class:is-now={step.now}
      class:is-done={step.done}
    >
      {#if pausa}
        <!-- Il tempo che passa: la linea si allunga e si spezza, e in mezzo
             c'è scritto quanto. Anche sulla prima riga — lì non si disegnava,
             ma il server quell'attesa la rispetta lo stesso, e una scena che
             sta ferma mezzo minuto senza dirlo sembra non essere partita. -->
        <span class="attesa">
          {saysWait(pausa)}{#if step.fino}<span class="resta">{' · ancora '}{saysLeft((step.fino - adesso) / 1000)}</span>{/if}
        </span>
      {/if}

      <!-- una riga che parla ha il suo nodo vuoto: non racconta come sta un
           dispositivo, perche' non ne tocca nessuno -->
      <span
        class="nodo is-{step.talk ? 'talk' : (step.state ?? 'live')}"
        role={step.says ? 'img' : undefined}
        aria-label={step.says}
        title={step.says}
      ></span>

      <div class="detto">{@render row(step, at)}</div>
    </li>
  {/each}
</ol>

<style>
  .rail {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
  }

  li {
    position: relative;
    display: grid;
    grid-template-columns: 13px 1fr;
    align-items: center;
    column-gap: 9px;
    padding: 3px 0;
  }

  /* la linea passa dietro ai pallini e si ferma al primo e all'ultimo, se no
     sembra che la scena cominci prima e continui dopo */
  li::before {
    content: '';
    position: absolute;
    left: 6px;
    top: 0;
    bottom: 0;
    width: 1px;
    background: color-mix(in srgb, var(--ink-3) 34%, transparent);
  }

  li.is-first::before { top: 50%; }

  li.is-last::before { bottom: 50%; }

  li.is-first.is-last::before { display: none; }

  .nodo {
    position: relative;
    width: 7px;
    height: 7px;
    margin-left: 3px;
    border-radius: 50%;
    background: var(--ok);
    /* il pallino sta sopra la linea e si porta dietro il suo alone, se no la
       linea gli passa attraverso */
    box-shadow: 0 0 0 3px rgb(var(--base));
  }

  .nodo.is-lost { background: var(--danger); }

  .nodo.is-unknown { background: var(--ink-3); opacity: 0.55; }

  .nodo.is-talk {
    background: rgb(var(--base));
    box-shadow: 0 0 0 3px rgb(var(--base)), inset 0 0 0 1.5px var(--accent);
  }

  /* Fin dove è arrivata: la linea si accende dietro i passi già fatti e si
     ferma a quello di adesso. */
  li.is-done::before, li.is-now::before { background: color-mix(in srgb, var(--accent) 85%, transparent); }

  li.is-now.is-last::before, li.is-now::before { bottom: 50%; }

  li.is-now.is-first::before { top: 50%; }

  /* il passo di adesso: un alone che batte intorno al suo pallino */
  li.is-now .nodo::after {
    content: '';
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    border: 1.5px solid var(--accent);
    animation: batte 1.1s ease-in-out infinite;
  }

  @keyframes batte {
    0%, 100% { opacity: 0.3; transform: scale(0.8); }
    50% { opacity: 1; transform: scale(1.15); }
  }

  @media (prefers-reduced-motion: reduce) {
    li.is-now .nodo::after { animation: none; opacity: 0.9; }
  }

  .detto { min-width: 0; }

  /* l'attesa: una riga che apre spazio prima del nodo, con scritto quanto */
  .attesa {
    grid-column: 1 / -1;
    margin: 2px 0 2px 22px;
    padding: 1px 0;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: var(--accent);
  }

  .resta { color: var(--ink-2); }
</style>
