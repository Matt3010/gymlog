<script lang="ts">
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';

  /**
   * Avanti e indietro in un elenco lungo.
   *
   * Dice sempre dove si è e quanto manca — «9-16 di 42» — perché un «avanti»
   * da solo non si preme: non si sa se porta a un'altra riga o ad altre
   * quaranta. Quando ci sta tutto in una pagina sparisce: una barra di
   * navigazione per tre righe è arredamento.
   *
   * Non sa niente di quello che sta paginando e non tiene niente: chiede, e
   * chi lo usa va a prendere. Cosi' vale per un elenco che sta in memoria
   * come per uno che arriva dal server venti alla volta.
   */
  let {
    total,
    offset,
    limit,
    onpick,
    busy = false,
    what = 'righe',
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
        title="Più recenti"
        disabled={!indietro || busy}
        onclick={() => onpick(Math.max(0, offset - limit))}
      >
        <Icon name="prev" />
      </Button>
      <Button
        look="icon"
        title="Più vecchi"
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

  .frecce { display: flex; gap: 2px; }
</style>
