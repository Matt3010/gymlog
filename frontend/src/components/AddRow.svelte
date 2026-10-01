<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';
  import Button from './Button.svelte';
  import TextField from './TextField.svelte';
  import Row from './Row.svelte';

  /**
   * La riga in fondo a ogni lista: si scrive un nome e si aggiunge. Il bordo
   * tratteggiato dice che è un posto vuoto da riempire; quando c'è qualcosa
   * da salvare, il + si accende.
   */
  let {
    id,
    placeholder,
    title,
    value = $bindable(''),
    field = $bindable(),
    onadd,
    before,
    after,
    flat = false,
    label,
  }: {
    id?: string;
    placeholder: string;
    title: string;
    value: string;
    /** Il campo, per chi deve metterci dentro il cursore. */
    field?: HTMLInputElement;
    /** Se torna una promessa, la riga aspetta che finisca prima di accettare un altro invio. */
    onadd: (name: string) => void | Promise<unknown>;
    /** Cosa sta prima e dopo il campo: l'emoji di una categoria, il suo colore. */
    before?: Snippet;
    after?: Snippet;
    /** Piatta, come le righe sopra di lei dentro una card (vedi `Row`). */
    flat?: boolean;
    /**
     * La parola sul tasto, «Crea»: con lei il tasto si legge, invece del
     * solo +. Creare è un'azione, e un'azione si dice.
     */
    label?: string;
  } = $props();

  /*
   * Un'aggiunta alla volta. Il campo si svuota quando risponde il server, e
   * nel frattempo un secondo Invio, o un Invio dopo il clic sul +, creava la
   * stessa cosa due volte. Per un agente la seconda si prendeva il comando
   * d'installazione, e la prima restava senza.
   */
  let occupata = false;

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const name = value.trim();
    if (!name || occupata) return;
    occupata = true;
    try {
      await onadd(name);
    } finally {
      occupata = false;
    }
  }
</script>

<!-- il modulo non disegna niente: tutta la geometria è quella della riga, e i
     pezzi stanno nelle stesse fessure delle righe qui sopra -->
<form class="shell" onsubmit={submit}>
  <Row dashed {flat} {id} class={value.trim() ? 'is-ready' : ''}>
    {#snippet lead()}{#if flat && !before}<span class="plus"><Icon name="plus" /></span>{/if}{@render before?.()}{/snippet}

    <TextField
      name="name"
      required
      maxlength={40}
      {placeholder}
      bind:element={field}
      bind:value
    />

    {#snippet trail()}
      {@render after?.()}
      {#if label}
        <Button look="ghost" size="sm" type="submit" extra="add-go" {title}>{label}</Button>
      {:else}
        <Button look="icon" type="submit" extra="add-go" {title}>
          <Icon name="plus" />
        </Button>
      {/if}
    {/snippet}
  </Row>
</form>

<style>
  .shell { display: contents; }

  :global(.row.is-dashed .add-go) { color: var(--ink-3); }

  :global(.row.is-dashed.is-ready .add-go) {
    background: var(--accent);
    color: var(--on-accent);
  }

  .plus { display: grid; place-items: center; width: 28px; color: var(--ink-3); }

  .plus :global(.ico) { width: 16px; height: 16px; }
</style>