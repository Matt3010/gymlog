<script lang="ts">
  import { toast } from '../lib/toast.svelte';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';

  /** Una riga da copiare, con il suo tasto. */
  let {
    text,
    title,
    fallita,
  }: {
    text: string;
    /** Cosa fa il tasto, detto per quella riga: «Copia il comando». */
    title: string;
    /** Cosa dire se il browser non lascia copiare. */
    fallita: string;
  } = $props();

  let copied = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      clearTimeout(timer);
      timer = setTimeout(() => (copied = false), 1600);
    } catch {
      toast.show(fallita);
    }
  }
</script>

<div class="copy-line">
  <Button look="icon" {title} onclick={copy}>
    <Icon name={copied ? 'check' : 'link'} />
  </Button>
  <code>{text}</code>
</div>

<style>
  /* i `min-width` servono: in una griglia una cella non scende sotto il suo contenuto, e la riga sfondava la scheda */
  .copy-line {
    /* contiene il tasto che galleggia, anche con un comando di una riga sola */
    display: flow-root;
    min-width: 0;
    padding: 6px 6px 6px 10px;
    border-radius: var(--r-in);
    background: var(--sunken-hover);
    box-shadow: inset 0 0 0 1px var(--hairline-soft);
  }

  /* il tasto in alto a destra, e il comando che gli gira intorno: nessun vuoto sopra o sotto */
  .copy-line :global(.btn.icon) { float: right; margin-left: 8px; }

  .copy-line code {
    display: block;
    /* la prima riga a metà del tasto */
    padding-top: 7px;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
    font-size: 11px;
    line-height: 1.5;
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
