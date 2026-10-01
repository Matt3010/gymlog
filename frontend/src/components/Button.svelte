<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * L'unico bottone dell'app. Le varianti stanno qui dentro, non sparse in un
   * foglio globale: chi lo usa sceglie un `look`, non una classe da ricordare.
   *
   * - `primary`: la cosa da fare, una per schermata
   * - `ghost`:   l'alternativa, con il suo contorno
   * - `icon`:    un'icona sola, nelle testate e nelle righe
   * - `round`:   un cerchio pieno, per l'azione principale di una testata
   * - `glass`:   un'icona sopra un'immagine, con il suo vetro scuro sotto
   * - `link`:    un comando scritto piccolo, in mezzo al testo
   * - `danger`:  quello che porta via qualcosa
   * - `danger-solid`: lo stesso, ma quando è lui la risposta a una domanda
   *
   * `tone="danger"` lo tinge di rosso qualunque forma abbia: il rosso in
   * quest'app vuol dire una cosa sola, «questo porta via qualcosa», e lo dice
   * il componente, non un foglio di stile qui accanto.
   *
   * `size="sm"` lo rimpicciolisce, per quando sta dentro a qualcosa di
   * piccolo — il foglietto di una domanda, una fascia in fondo a una card.
   * Vale per le forme che hanno del testo dentro; `icon` ha già la sua misura.
   *
   * Con `href` diventa un link che si veste da bottone. `extra` serve a chi lo
   * ospita per decorarlo (la classe finisce sull'elemento, ma va raggiunta con
   * :global perché il markup è di questo componente).
   */
  type Look = 'primary' | 'ghost' | 'icon' | 'round' | 'glass' | 'link' | 'danger' | 'danger-solid';

  let {
    look = 'ghost',
    tone,
    size,
    href,
    disabled = false,
    extra = '',
    children,
    ...rest
  }: {
    look?: Look;
    tone?: 'danger';
    /** Più piccolo del normale: dentro un popover, in fondo a una card. */
    size?: 'sm';
    href?: string;
    disabled?: boolean;
    extra?: string;
    children: Snippet;
    [key: string]: unknown;
  } = $props();

  const classes = $derived(
    ['btn', look, tone === 'danger' ? 'is-danger' : '', size === 'sm' ? 'is-sm' : '', extra]
      .filter(Boolean)
      .join(' '),
  );
</script>

{#if href}
  <!--
    Un <a> non sa cosa sia `disabled`: se lo è, gli si toglie l'indirizzo e lo
    si dice all'assistenza vocale. Il resto (niente clic, niente tab) lo fa il
    CSS qui sotto.
  -->
  <a
    href={disabled ? undefined : href}
    aria-disabled={disabled ? 'true' : undefined}
    tabindex={disabled ? -1 : undefined}
    {...rest}
    class={classes}
  >
    {@render children()}
  </a>
{:else}
  <button
    type="button"
    {disabled}
    {...rest}
    class={classes}
  >
    {@render children()}
  </button>
{/if}

<style>
  .btn {
    font: inherit;
    cursor: pointer;
    text-decoration: none;
    /* un'icona accanto alla scritta sta in riga con lei, in ogni forma: le
       forme che si dispongono da sé (icon, round, glass) lo dicono dopo */
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  /* i due modi di essere spento: quello vero dei bottoni e quello dei link */
  .btn:disabled, .btn[aria-disabled='true'] {
    cursor: default;
    pointer-events: none;
  }

  /* La misura piccola. Sta qui e non in chi lo ospita, se no ogni schermata
     si inventa la sua. Viene dopo le forme apposta: a parità di peso vince
     l'ultima, e `icon` resta fuori perché la sua misura ce l'ha già.
     `nowrap` perché il posto stretto è il motivo per cui esiste. */
  .btn.is-sm:not(.icon):not(.round) :global(.ico) { width: 15px; height: 15px; }

  .btn.is-sm:not(.icon):not(.round) {
    padding: 7px 12px;
    font-size: 12.5px;
    white-space: nowrap;
  }

  /* ------------------------------------------------------------- primary -- */
  .primary {
    border: 0;
    border-radius: var(--r-md);
    padding: 10px 18px;
    background: var(--accent-grad);
    color: var(--on-accent);
    font-weight: 560;
    letter-spacing: -0.008em;
    box-shadow: var(--shadow-1), inset 0 1px 0 rgb(255 255 255 / 0.14);
    transition: transform 0.14s var(--ease), box-shadow 0.2s, filter 0.2s;
  }

  @media (hover: hover) {
  .primary:hover { filter: brightness(1.08); box-shadow: var(--shadow-2); }
}
  .primary:active { transform: translateY(1px); }

  /* --------------------------------------------------------------- ghost -- */
  .ghost {
    border: 1px solid var(--hairline);
    border-radius: var(--r-md);
    padding: 10px 16px;
    background: transparent;
    color: var(--ink-2);
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }

  @media (hover: hover) {
  .ghost:hover { background: var(--sunken); color: var(--ink); }
}

  /* ---------------------------------------------------------------- icon -- */
  .icon {
    display: grid;
    place-items: center;
    flex: none;
    width: 30px;
    height: 30px;
    padding: 0;
    border: 0;
    border-radius: var(--r-sm);
    background: transparent;
    color: var(--ink-3);
    transition: background 0.15s, color 0.15s;
  }

  @media (hover: hover) {
  .icon:hover { background: var(--sunken-hover); color: var(--ink); }
}


  /* Dove si tocca, un tasto è largo quanto un dito: trenta pixel sono la
     misura di un puntatore, non di un polpastrello. Il disegno dentro resta
     quello — a crescere è quello che si può prendere. */
  @media (hover: none) {
    .icon { width: 40px; height: 40px; }
    .icon.is-sm { width: 34px; height: 34px; }
  }
  .icon:disabled, .icon[aria-disabled='true'] { opacity: 0.3; }

  /* il vetro sopra un'immagine ------------------------------------------- */

  /* Come `icon`, ma sopra qualcosa che non sappiamo di che colore sia: quale
     grigio ci sia dietro lo decide quello che riprende una telecamera, non
     noi, e un'icona bianca su un'inquadratura di giorno sparisce. Quindi ogni
     tasto si porta il suo fondo scuro. Il fondo c'e' sempre e non solo al
     passaggio del mouse, perche' su un telefono un mouse non c'e' e un tasto
     che si vede solo passandoci sopra li' non si vede mai. */
  .glass {
    display: grid;
    place-items: center;
    flex: none;
    width: 26px;
    height: 26px;
    padding: 0;
    border: 0;
    border-radius: var(--r-sm);
    background: rgb(0 0 0 / 0.3);
    -webkit-backdrop-filter: blur(4px);
    backdrop-filter: blur(4px);
    color: rgb(255 255 255 / 0.85);
    transition: background 0.15s, color 0.15s;
  }

  .glass :global(.ico) { width: 13px; height: 13px; }

  @media (hover: hover) {
  .glass:hover:not(:disabled) { background: rgb(0 0 0 / 0.72); color: #fff; }
}

  .glass:disabled, .glass[aria-disabled='true'] { opacity: 0.45; }

  /* il tondo pieno ------------------------------------------------------- */

  /* Un cerchio pieno d'accento: in una testata dove gli altri tasti sono
     smorti, questo è quello che fa succedere qualcosa. La forma non sa cosa
     ha dentro — un triangolo per far partire una scena, ma domani una freccia
     o un più — e sta qui e non in un foglio accanto a chi la usa, se no il
     prossimo cerchio sarebbe di un altro verde. */
  .round {
    display: grid;
    place-items: center;
    flex: none;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: var(--accent);
    color: var(--on-accent);
    transition: background 0.15s, filter 0.15s, transform 0.14s var(--ease);
  }

  .round :global(.ico) { width: 14px; height: 14px; }

  /* quello piccolo, per le righe strette */
  .round.is-sm { width: 24px; height: 24px; }

  .round.is-sm :global(.ico) { width: 12px; height: 12px; }

  @media (hover: hover) {
  .round:hover:not(:disabled) { filter: brightness(1.08); }
}
  .round:active:not(:disabled) { transform: scale(0.94); }

  .round:disabled, .round[aria-disabled='true'] {
    background: var(--sunken-hover);
    color: var(--ink-3);
  }

  /* ---------------------------------------------------------------- link -- */
  .link {
    padding: 3px 8px;
    border: 0;
    border-radius: 99px;
    background: none;
    color: var(--ink-3);
    font-size: 11px;
    font-weight: 560;
    letter-spacing: 0.02em;
    transition: background 0.15s, color 0.15s;
  }

  @media (hover: hover) {
  .link:hover { background: var(--sunken-hover); color: var(--ink); }
}

  /* Dove si tocca, anche un comando scritto piccolo vuole un dito: lo spazio
     si aggiunge dentro e si toglie fuori, così la riga resta dov'era e a
     crescere è solo quello che si può prendere. */
  @media (hover: none) {
    .link { padding: 10px 8px; margin: -10px 0; }
  }

  /* -------------------------------------------------------------- danger -- */
  .danger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-right: auto;
    padding: 10px 10px 10px 0;
    border: 0;
    background: none;
    color: color-mix(in srgb, var(--danger) 80%, transparent);
    font-size: 13px;
    transition: color 0.15s;
  }

  @media (hover: hover) {
  .danger:hover { color: var(--danger); }
}
  .danger :global(.ico) { width: 16px; height: 16px; }

  /* ---------------------------------------------------------------- tono -- */
  /* il rosso si vede prima di leggere: chi porta via qualcosa lo porta addosso */
  .is-danger { color: color-mix(in srgb, var(--danger) 80%, transparent); }

  @media (hover: hover) {
  .is-danger:hover {
      color: var(--danger);
      background: color-mix(in srgb, var(--danger) 14%, transparent);
    }
}

  /* --------------------------------------------------------- danger-solid -- */
  /* quando la domanda è "lo elimino?", la risposta si prende il colore: è
     l'unica cosa rossa sullo schermo, e non si preme per sbaglio */
  .danger-solid {
    padding: 7px 14px;
    border: 0;
    border-radius: var(--r-md);
    background: var(--danger);
    color: #fff;
    font-size: 12.5px;
    font-weight: 560;
    letter-spacing: -0.008em;
    box-shadow: var(--shadow-1);
    transition: filter 0.15s, transform 0.14s var(--ease);
  }

  @media (hover: hover) {
  .danger-solid:hover { filter: brightness(1.1); }
}
  .danger-solid:active { transform: translateY(1px); }

  /*
   * Sul telefono un tasto con delle parole è largo quanto la card in cui sta:
   * si preme col pollice, in piedi, e un bersaglio stretto in un angolo si
   * manca. Restano piccoli i tasti-icona nelle righe (frecce, ✕, cestino,
   * matita) e quelli `sm`, che stanno in fila con altre cose — una testata,
   * una domanda, un invito.
   */
  @media (max-width: 600px) {
    .btn:not(.icon):not(.round):not(.glass):not(.link):not(.is-sm) { width: 100%; }
  }
</style>
