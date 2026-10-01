<script lang="ts" generics="T">
  import { ui } from '../lib/ui.svelte';
  import type { Vista } from '../lib/vista.svelte';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';

  /**
   * Come si guarda un elenco di schede, detto sopra l'elenco.
   *
   * Una tabella si ordina toccando l'intestazione di una colonna. Un elenco
   * di schede non ha intestazioni, e il comando deve stare da qualche parte:
   * qui, piccolo, in alto a destra, dove si cerca. La vista è la stessa
   * delle tabelle (lib/vista.svelte.ts), quindi scegliere e girare vogliono
   * dire la stessa cosa nei due posti.
   *
   * Il criterio si sceglie dal foglietto delle scelte che usa tutta l'app,
   * il verso con la freccia accanto: toccare di nuovo il criterio già scelto
   * lo girerebbe lo stesso, ma è un gesto che nessuno indovina.
   *
   * È una barra e non un tasto solo perché una vista domani potrà anche
   * filtrare, e il comando per farlo starà qui accanto.
   */
  let { vista, label = 'In che ordine' }: { vista: Vista<T>; label?: string } = $props();

  function scegli(event: MouseEvent): void {
    ui.askPick(event.currentTarget as HTMLElement, {
      title: label,
      options: vista.criteri.map((one) => ({ id: one.id, label: one.label })),
      current: vista.ordine,
      onPick: (id: string) => vista.ordina(id),
    });
  }
</script>

{#if vista.criteri.length > 1}
  <div class="vista" role="group" aria-label={label}>
    <Button look="link" extra="vista-per" title={label} onclick={scegli}>
      <!-- «Per nome» e non «Nome»: accanto a un elenco di schede la sola
           parola sembra un'etichetta, non un comando -->
      Per {vista.criterio?.label.toLowerCase()}
    </Button>
    <Button
      look="icon"
      size="sm"
      extra="vista-verso"
      title={vista.verso === 'asc' ? 'In ordine crescente, tocca per girarlo' : 'In ordine decrescente, tocca per girarlo'}
      onclick={() => vista.gira()}
    >
      <Icon name={vista.verso === 'asc' ? 'sortAsc' : 'sortDesc'} />
    </Button>
  </div>
{/if}

<style>
  .vista {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }

  .vista :global(.vista-verso .ico) { width: 15px; height: 15px; }
</style>
