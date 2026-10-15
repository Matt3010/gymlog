<script lang="ts">
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';

  /** Avanti e indietro in un elenco lungo, con «9-16 di 42»; sparisce quando ci sta tutto in una pagina. Non tiene niente: chiede. */
  let {
    total,
    offset,
    limit,
    onpick,
    busy = false,
    what = 'righe',
    previous = 'Più recenti',
    next = 'Più vecchi',
  }: {
    total: number;
    offset: number;
    limit: number;
    /** Da dove ripartire. Chi lo usa va a prendere quel pezzo. */
    onpick: (offset: number) => void;
    /** Mentre si sta andando a prendere: non si preme due volte. */
    busy?: boolean;
    /** Come si chiamano le cose contate: «avvisi», «luoghi». */
    what?: string;
    /** I nomi dei due tasti, come vanno le righe: dalle più recenti, o in un altro ordine. */
    previous?: string;
    next?: string;
  } = $props();

  const first = $derived(total ? offset + 1 : 0);
  const last = $derived(Math.min(offset + limit, total));
  const indietro = $derived(offset > 0);
  const avanti = $derived(last < total);
</script>

{#if total > limit}
  <div class="pager">
    <span class="dove">{first}–{last} di {total} {what}</span>

    <div class="frecce">
      <Button
        look="icon"
        title={previous}
        disabled={!indietro || busy}
        onclick={() => onpick(Math.max(0, offset - limit))}
      >
        <Icon name="prev" />
      </Button>
      <Button
        look="icon"
        title={next}
        disabled={!avanti || busy}
        onclick={() => onpick(offset + limit)}
      >
        <Icon name="next" />
      </Button>
    </div>
  </div>
{/if}

<style>
  .pager {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 4px;
    padding-top: 10px;
    border-top: 1px solid var(--hairline);
  }

  .dove {
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: var(--ink-3);
  }

  /* come gli altri tasti-icona vicini: non si toccano */
  .frecce { display: flex; gap: 6px; }
</style>
