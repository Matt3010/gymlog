<script lang="ts">
  import type { Snippet } from 'svelte';
  import { perNome, Vista } from '../lib/vista.svelte';
  import { unici } from '../lib/unici';
  import Icon from './Icon.svelte';
  import TextField from './TextField.svelte';

  /**
   * Scegliere una voce da un elenco lungo, dentro una finestra.
   *
   * I fusi orari sono più di quattrocento, le marche che si possono collegare
   * quasi mille: in un elenco così si cerca, non si scorre. Era scritto per i
   * fusi, e il catalogo delle marche lo voleva uguale. La ricerca è quella di
   * ogni altro elenco dell'app, la vista.
   */
  interface Voce {
    id: string;
    name: string;
    /**
     * Quello che si legge a destra: l'ora di un fuso. Come funzione quando
     * costa ricavarla, così si chiede solo per le righe che si vedono.
     */
    note?: string | (() => string);
  }

  let {
    voci,
    chiave,
    placeholder,
    vuoto,
    scelta,
    onpick,
    prima,
  }: {
    voci: Voce[];
    /** Dove la vista si ricorda come l'hai lasciata. */
    chiave: string;
    placeholder: string;
    /** Cosa dire quando la ricerca non trova niente. */
    vuoto: string;
    /** La voce di adesso, segnata con la spunta. */
    scelta?: string;
    onpick: (id: string) => void;
    /** Qualcosa da proporre in cima quando non si sta cercando. */
    prima?: Snippet;
  } = $props();

  // svelte-ignore state_referenced_locally
  const vista = new Vista<Voce>({
    chiave,
    criteri: [{ id: 'nome', label: 'Nome', per: perNome }],
    testoDi: (voce) => voce.name,
  });

  /*
   * Quante righe si disegnano al massimo.
   *
   * Il catalogo ha quasi mille voci, e disegnarle tutte a ogni apertura
   * faceva aspettare la finestra per mostrare righe che nessuno scorre fino
   * in fondo: chi cerca una marca scrive il suo nome. Le altre si dicono
   * con un numero, e arrivano scrivendo.
   */
  const MASSIMO = 60;

  const trovate = $derived(vista.applica(voci));
  /* La voce scelta resta anche oltre il taglio, in fondo alle altre: aprire
     la finestra dei fusi e non trovarci il proprio, finché non lo si
     scrive, faceva credere che non fosse scelto niente. */
  const elenco = $derived.by(() => {
    const prime = trovate.slice(0, MASSIMO);
    const sua = scelta === undefined || prime.some((voce) => voce.id === scelta) ? undefined : trovate.find((voce) => voce.id === scelta);
    return sua ? [...prime, sua] : prime;
  });
  const altre = $derived(trovate.length - elenco.length);

  const nota = (voce: Voce): string | undefined => (typeof voce.note === 'function' ? voce.note() : voce.note);
</script>

<!-- svelte-ignore a11y_autofocus -->
<TextField kind="search" {placeholder} bind:value={vista.cerca} autofocus />

{#if prima && !vista.cerca.trim()}{@render prima()}{/if}

<ul class="elenco">
  {#each unici(elenco, (one) => one.id) as voce (voce.id)}
    {@const detto = nota(voce)}
    <li>
      <button type="button" class="voce" class:is-on={voce.id === scelta} onclick={() => onpick(voce.id)}>
        <span class="nome">{voce.name}</span>
        {#if detto}<span class="nota">{detto}</span>{/if}
        {#if voce.id === scelta}<Icon name="check" />{/if}
      </button>
    </li>
  {:else}
    <li class="vuoto">{vuoto}</li>
  {/each}
  {#if altre > 0}
    <li class="vuoto">{altre === 1 ? 'Ne resta fuori un’altra' : `Ne restano fuori altre ${altre}`}, scrivi per restringere l’elenco.</li>
  {/if}
</ul>

<style>
  .elenco {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* anche per chi mette qualcosa in cima, così la prima riga è uguale alle altre */
  .voce, :global(.search-picker-voce) {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 9px 10px;
    border: 0;
    border-radius: var(--r-sm);
    background: none;
    color: var(--ink-2);
    font-size: 13px;
    text-align: left;
    cursor: pointer;
    transition: background 0.14s;
  }

  .voce:hover { background: var(--sunken); }

  .voce.is-on { color: var(--ink); font-weight: 560; }

  .nome { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .nota { font-variant-numeric: tabular-nums; font-size: 12px; color: var(--ink-3); }

  .voce :global(.ico) { width: 15px; height: 15px; color: var(--ok); }

  .vuoto { padding: 12px 10px; font-size: 12px; color: var(--ink-3); }

  @media (hover: none) {
    .voce, :global(.search-picker-voce) { padding: 12px 10px; }
  }
</style>
