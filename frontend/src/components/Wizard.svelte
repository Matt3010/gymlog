<script lang="ts" generics="Id extends string">
  import type { Snippet } from 'svelte';
  import { tasti } from '../lib/fondo.svelte';
  import type { ModalAction } from '../lib/ui.svelte';
  import Button from './Button.svelte';

  /**
   * Una cosa lunga da scrivere, divisa in passi.
   *
   * Quando in una scheda ci sono tre domande diverse una sotto l'altra — cosa
   * fa, quando parte, a quali condizioni — si leggono come un elenco solo, e
   * chi arriva non sa da dove cominciare. Un passo per volta, con in cima
   * dove si è e in fondo come si va avanti, si risponde a una domanda alla
   * volta.
   *
   * Non sa cosa c'è dentro: i passi li disegna chi lo usa, con lo snippet
   * `contenuto`. I passi si possono anche saltare toccandone il nome in
   * cima, perché ognuno si salva da sé mentre lo si scrive e non c'è niente
   * da confermare prima di passare al successivo.
   *
   * Dentro a una finestra i tasti vanno nel suo fondo (`tasti()`), e cambiano
   * col passo: «Indietro» sparisce sul primo, «Avanti» diventa «Fatto»
   * sull'ultimo. Fuori da una finestra se li disegna da sé.
   */
  let {
    passi,
    passo = $bindable(0),
    contenuto,
    onfine,
  }: {
    passi: { id: Id; titolo: string }[];
    passo?: number;
    contenuto: Snippet<[Id]>;
    /** Quando si preme «Fatto» sull'ultimo passo. */
    onfine?: () => void;
  } = $props();

  const ultimo = $derived(passo >= passi.length - 1);

  // i passi possono diminuire mentre si scrive, e chi stava sull'ultimo che
  // se n'è andato resta su quello che adesso è l'ultimo
  $effect(() => {
    if (passo > passi.length - 1) passo = Math.max(0, passi.length - 1);
  });

  function azioni(): ModalAction[] {
    return [
      ...(passo > 0 ? [{ label: 'Indietro', look: 'ghost' as const, onpick: () => ((passo -= 1), false) }] : []),
      ultimo
        ? { label: 'Fatto', look: 'primary' as const, onpick: () => onfine?.() }
        : { label: 'Avanti', look: 'primary' as const, onpick: () => ((passo += 1), false) },
    ];
  }

  const inFinestra = tasti(azioni);
  const corrente = $derived(passi[Math.min(passo, passi.length - 1)] as { id: Id; titolo: string });
</script>

<nav class="passi" aria-label="I passi">
  {#each passi as uno, at (uno.id)}
    <button
      type="button"
      class="passo"
      class:is-qui={at === passo}
      class:is-fatto={at < passo}
      aria-current={at === passo ? 'step' : undefined}
      onclick={() => (passo = at)}
    >
      <span class="numero">{at + 1}</span>
      <span class="titolo">{uno.titolo}</span>
    </button>
  {/each}
</nav>

<div class="contenuto">
  {@render contenuto(corrente.id)}
</div>

{#if !inFinestra}
  <div class="fondo">
    {#each azioni() as azione (azione.label)}
      <Button look={azione.look} onclick={(event: MouseEvent) => void azione.onpick(event.currentTarget as HTMLElement)}>
        {azione.label}
      </Button>
    {/each}
  </div>
{/if}

<style>
  /* dove si è: i numeri in fila, quello di adesso acceso, quelli già fatti
     smorti ma leggibili, perché ci si torna toccandoli */
  .passi {
    display: flex;
    gap: 4px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--hairline-soft);
  }

  .passo {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
    padding: 6px 8px;
    border: 0;
    border-radius: var(--r-sm);
    background: none;
    color: var(--ink-3);
    font-size: 12px;
    text-align: left;
    cursor: pointer;
    transition: background 0.14s, color 0.14s;
  }

  .passo:hover { background: var(--sunken); color: var(--ink-2); }

  .numero {
    flex: none;
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1px var(--hairline);
    font-size: 11px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .titolo { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .passo.is-qui { color: var(--ink); font-weight: 560; }

  .passo.is-qui .numero {
    background: var(--accent);
    box-shadow: none;
    color: var(--on-accent);
  }

  .passo.is-fatto { color: var(--ink-2); }

  /* la colonna non si allarga per quello che contiene (vedi Modal.svelte) */
  .contenuto { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; padding-top: 4px; }

  .fondo { display: flex; justify-content: flex-end; gap: 8px; padding-top: 12px; }

  @media (hover: none) {
    .passo { padding: 10px 8px; }
  }
</style>
