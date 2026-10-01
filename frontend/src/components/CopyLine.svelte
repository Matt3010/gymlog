<script lang="ts">
  import { toast } from '../lib/toast.svelte';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';

  /**
   * Una riga da copiare, con il suo tasto.
   *
   * Esiste perché le cose che si vedono una volta sola e poi si portano
   * altrove sono più d'una: il comando che installa un agente, il link che
   * invita qualcuno su una mappa. Si leggono uguali e si copiano uguali, e
   * scritte due volte avrebbero finito per copiarsi in due modi diversi.
   */
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
  <code>{text}</code>
  <Button look="icon" {title} onclick={copy}>
    <Icon name={copied ? 'check' : 'link'} />
  </Button>
</div>

<style>
  /* si legge come un terminale perché è una cosa da incollare altrove. I
     `min-width` non sono decorativi: dentro una griglia una cella non scende
     sotto la larghezza del suo contenuto, e una riga senza a capo è larga
     quanto vuole — è così che sfondava il bordo della scheda. */
  .copy-line {
    display: flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
    padding: 4px 4px 4px 9px;
    border-radius: var(--r-sm);
    background: var(--sunken-hover);
    box-shadow: inset 0 0 0 1px var(--hairline-soft);
  }

  .copy-line code {
    flex: 1;
    min-width: 0;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
    font-size: 11px;
    line-height: 1.5;
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
