<script lang="ts">
  import { onMount } from 'svelte';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';

  /** Un guaio detto per intero: cos'è successo e, se c'è, come uscirne. */
  let {
    message,
    action,
  }: {
    message: string;
    action?: { label: string; run: () => void };
  } = $props();

  /*
   * Un guaio compare spesso in fondo, dove si stava scrivendo: lì la barra
   * delle sezioni lo coprirebbe finché non si scorre. Appena c'è, la pagina
   * si sposta quanto basta a vederlo (niente, se si vede già) — ma non se
   * così il campo in cui si sta scrivendo uscirebbe dallo schermo: uno
   * comparso lontano non porta via la pagina da quello che si scrive.
   */
  let element = $state<HTMLElement>();
  onMount(() => {
    if (!element) return;
    const box = element.getBoundingClientRect();
    const needed = box.bottom + (parseFloat(getComputedStyle(element).scrollMarginBottom) || 0) - window.innerHeight;
    if (needed <= 0) return;
    const focused = document.activeElement;
    const writing = focused instanceof HTMLElement && focused.matches('input, textarea, select') ? focused.getBoundingClientRect() : null;
    if (writing && writing.top - needed < 0) return;
    element.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  });
</script>

<p class="alert" role="alert" bind:this={element}>
  <Icon name="alert" />
  <span>{message}</span>
  {#if action}
    <Button look="link" extra="alert-fix" onclick={action.run}>{action.label}</Button>
  {/if}
</p>

<style>
  .alert {
    display: flex;
    align-items: center;
    gap: 9px;
    margin: 0;
    padding: 9px 10px 9px 12px;
    border-radius: var(--r-md);
    background: color-mix(in srgb, var(--danger) 11%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--danger) 26%, transparent);
    font-size: 12.5px;
    line-height: 1.4;
    color: var(--ink);
    animation: rise 0.22s var(--ease);
    /* visto per intero vuol dire sopra la barra delle sezioni, con lo spazio di una card */
    scroll-margin-top: var(--card-pad);
    scroll-margin-bottom: calc(var(--tab-bar) + var(--card-pad));
  }

  .alert :global(.ico) { width: 15px; height: 15px; flex: none; color: var(--danger); }

  .alert span { flex: 1; min-width: 0; }

  .alert :global(.btn.alert-fix) {
    flex: none;
    padding: 4px 10px;
    border: 0;
    border-radius: 99px;
    background: var(--sunken-hover);
    color: var(--ink);
    font: inherit;
    font-size: 12px;
    font-weight: 560;
    transition: background 0.14s;
  }

  @media (hover: hover) {
  .alert :global(.btn.alert-fix:hover) { background: var(--sunken); }
}
</style>
