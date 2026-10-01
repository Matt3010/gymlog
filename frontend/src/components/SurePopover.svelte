<script lang="ts">
  import { tick } from 'svelte';
  import { ui } from '../lib/ui.svelte';
  import Button from './Button.svelte';
  import Popover from './Popover.svelte';

  /**
   * La domanda attaccata al tasto che l'ha fatta nascere. Dice per nome cosa
   * succede e cosa si porta dietro.
   *
   * Quasi sempre è l'ultimo passo prima di una cosa che non torna indietro, e
   * allora il tasto è rosso. Con `tone: 'plain'` invece è un bivio — «privato
   * o pubblico?» — e lì il rosso direbbe che una delle due strade fa male.
   */
  const request = $derived(ui.sure!);

  /**
   * La posizione si ricalcolava una volta sola. Ma quello a cui la domanda è
   * attaccata può scorrere via — dentro un elenco che scorre, o con la pagina
   * — e la domanda restava sospesa a mezz'aria, staccata dal tasto che
   * l'aveva fatta nascere. Adesso lo segue; e se quel tasto esce di vista, la
   * domanda si chiude, perché una domanda senza il suo oggetto non si capisce.
   */
  function yes() {
    const run = request.onYes;
    ui.sure = null;
    run();
  }

  // il fuoco sul «no», quando chi chiede lo vuole (`fuoco`)
  let tasti = $state<HTMLElement>();
  $effect(() => {
    if (!request.fuoco || !tasti) return;
    const qui = tasti;
    void tick().then(() => qui.querySelector<HTMLElement>('button')?.focus());
  });

  /** Anche il no può fare qualcosa: in un bivio l'altra strada è una strada. */
  function no() {
    const run = request.onNo;
    ui.sure = null;
    run?.();
  }
</script>

<Popover
  anchor={request.anchor}
  width={264}
  height={request.detail ? 132 : 108}
  id="sure-popover"
  role="alertdialog"
  label={request.title}
  onclose={() => (ui.sure = null)}
  onesc={() => ui.lasciaDomanda()}
>
  <p class="sure-what">{request.title}</p>
  {#if request.detail}<p class="sure-detail">{request.detail}</p>{/if}
  <div class="sure-acts" bind:this={tasti}>
    <Button look="ghost" size="sm" onclick={no}>{request.no ?? 'Annulla'}</Button>
    <Button look={request.tone === 'plain' ? 'primary' : 'danger-solid'} size="sm" onclick={yes}>
      {request.verb}
    </Button>
  </div>
</Popover>

<style>
  /* il vetro, la posizione e l'entrata li mette il foglietto */
  :global(#sure-popover) { padding: 14px; }

  .sure-what {
    margin: 0;
    font-size: 13.5px;
    font-weight: 560;
    letter-spacing: -0.012em;
    color: var(--ink);
  }

  .sure-detail {
    margin: 5px 0 0;
    font-size: 11.5px;
    line-height: 1.45;
    color: var(--ink-3);
  }

  .sure-acts {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 12px;
  }

</style>
