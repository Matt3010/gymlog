<script lang="ts">
  /**
   * Un campo di testo, scritto una volta sola.
   *
   * Il vestito stava già nel foglio dei controlli — tutti gli `input`
   * dell'app hanno lo stesso fondo e lo stesso bordo — ma tutto il resto no:
   * ogni posto si rifaceva la misura, il tipo, il modo di leggere quello che
   * si scrive, e i due o tre accorgimenti che servono perché il gestore di
   * password del browser non si metta a riempire campi che non sono
   * password. Dieci copie di quella roba divergono, e infatti divergevano.
   *
   * Le varianti sono quelle che l'app usa davvero: testo, posta, password,
   * ricerca, e in gymlog il testo lungo delle note (`multiline`, un
   * `textarea` con gli stessi accorgimenti). Non una in più — un componente
   * con dieci vestiti è un foglio di stile con un nome diverso.
   */
  import { modifiche } from '../lib/fondo.svelte';
  import { ui } from '../lib/ui.svelte';

  type Kind = 'text' | 'email' | 'password' | 'search' | 'multiline';

  let {
    value = $bindable(''),
    onchange,
    oninput,
    kind = 'text',
    size,
    placeholder,
    label,
    maxlength = 140,
    autocomplete,
    required = false,
    autofocus = false,
    /**
     * Sorda finché non la tocchi.
     *
     * Certi gestori di password riempiono qualunque campo somigli a un
     * accesso, e in mezzo a un collegamento — l'indirizzo di una telecamera,
     * il codice di un servizio — ci si ritrova l'email di qualcun altro. Un
     * campo che nasce in sola lettura non lo tenta, e al primo tocco torna
     * normale.
     */
    shy = false,
    readonly,
    extra = '',
    element = $bindable(),
    ...rest
  }: {
    value?: string;
    /** Quando si è finito di scrivere: l'invio, o il dito altrove. */
    onchange?: (next: string) => void;
    /** Mentre si scrive, per chi deve rispondere a ogni lettera (la ricerca). */
    oninput?: (next: string) => void;
    kind?: Kind;
    /** `sm`: alto quanto una pastiglia, per stare in fila con le altre cose. */
    size?: 'sm';
    placeholder?: string;
    /** Come si chiama questo campo, per chi non lo vede. */
    label?: string;
    maxlength?: number;
    autocomplete?: AutoFill;
    required?: boolean;
    autofocus?: boolean;
    shy?: boolean;
    /**
     * Una classe in più per chi lo ospita.
     *
     * Si aggiunge, non sostituisce: passandola come `class` avrebbe cancellato
     * quella del componente, e il campo sarebbe rimasto senza la sua misura.
     * Va raggiunta con `:global`, perché il markup è di qui.
     */
    extra?: string;
    /** Per chi deve metterci il fuoco da fuori. */
    element?: HTMLInputElement | HTMLTextAreaElement;
    /** Si legge e non si scrive. Senza, decide `shy`. */
    readonly?: boolean;
    [key: string]: unknown;
  } = $props();

  let touched = $state(false);

  /*
   * Sola lettura per davvero, quando chi lo usa lo chiede.
   *
   * Senza questo l'unico modo di ottenerla era passarla fra gli attributi in
   * coda, e funzionava solo finche' nessuno cambiava l'ordine in cui sono
   * scritti qui sotto: una cosa che regge per caso.
   */
  const chiuso = $derived(readonly ?? (shy && !touched));

  /*
   * Quello che c'era prima che ci scrivessi, per sapere se hai scritto
   * qualcosa che non è ancora da nessuna parte.
   *
   * Un valore che cambia mentre il campo non ha il fuoco non l'hai scritto
   * tu — è arrivato da un'altra scheda, o chi lo usa l'ha svuotato dopo
   * averlo aggiunto — e diventa il nuovo punto di partenza. Un campo che
   * consegna da sé (`onchange`) ha consegnato quando lasci il campo, e
   * anche lì si riparte da capo. Una ricerca non è lavoro da salvare.
   */
  // svelte-ignore state_referenced_locally
  let base = value;
  $effect.pre(() => {
    const ora = value;
    if (!element || element !== document.activeElement) base = ora;
  });
  modifiche(() => kind !== 'search' && !chiuso && (value ?? '') !== (base ?? ''));

  /*
   * Consegna quello che hai scritto, una volta sola: all'invio o lasciando
   * il campo. Non mentre si chiede se buttarlo — rispondere alla domanda
   * vuol dire lasciare il campo, e si salverebbe proprio quello che stai
   * buttando — e allora lo si consegna la prossima volta che lo lasci.
   */
  function consegna(ora: string): void {
    if (!onchange || ui.inDubbio || ora === base) return;
    base = ora;
    onchange(ora);
  }
</script>

{#if kind === 'multiline'}
  <!-- svelte-ignore a11y_autofocus -->
  <textarea
    class={extra ? `text-field ${extra}` : 'text-field'}
    bind:this={element}
    bind:value
    {placeholder}
    {maxlength}
    {required}
    {autofocus}
    readonly={chiuso}
    aria-label={label}
    onfocus={() => (touched = true)}
    oninput={(event) => oninput?.(event.currentTarget.value)}
    onchange={(event) => consegna(event.currentTarget.value)}
    onblur={(event) => consegna(event.currentTarget.value)}
    {...rest}
  ></textarea>
{:else}
<!-- svelte-ignore a11y_autofocus -->
<input
  type={kind}
  class={extra ? `text-field ${extra}` : 'text-field'}
  class:is-sm={size === 'sm'}
  bind:this={element}
  bind:value
  {placeholder}
  {maxlength}
  {required}
  {autofocus}
  autocomplete={autocomplete ?? (kind === 'search' ? ('off' as AutoFill) : undefined)}
  readonly={chiuso}
  aria-label={label}
  onfocus={() => (touched = true)}
  oninput={(event) => oninput?.(event.currentTarget.value)}
  onchange={(event) => consegna(event.currentTarget.value)}
  onblur={(event) => consegna(event.currentTarget.value)}
  onkeydown={(event) => {
    // l'invio vale come «ho finito», dove non c'è un modulo che lo prende
    if (event.key === 'Enter' && onchange && !event.currentTarget.form) event.currentTarget.blur();
  }}
  data-lpignore={shy ? 'true' : undefined}
  data-1p-ignore={shy ? 'true' : undefined}
  {...rest}
/>
{/if}

<style>
  /* la misura corta: la stessa di una pastiglia e dei campi dell'orario,
     perche' sulla stessa riga due altezze diverse si vedono subito */
  .text-field.is-sm {
    height: 26px;
    padding: 0 9px;
    border-radius: var(--r-sm);
    font-size: 11.5px;
  }
</style>
