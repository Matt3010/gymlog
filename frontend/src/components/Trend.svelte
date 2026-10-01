<script lang="ts">
  import type { Trend } from '../lib/trend';
  import Icon from './Icon.svelte';

  /**
   * La freccia di «com'è andata rispetto a prima»: verde in su, rossa in
   * giù, grigia di lato. Il colore non basta da solo: anche la direzione lo
   * dice, e chi non vede sente la frase. Senza un prima, niente.
   */
  let { trend, against = 'last' }: { trend: Trend | undefined; against?: 'last' | 'before' } = $props();

  /* le frasi intere: «di» e «la» si legano in modo diverso a ogni paragone */
  const SAID = {
    last: { up: 'Meglio dell’ultima volta', down: 'Peggio dell’ultima volta', same: 'Come l’ultima volta' },
    before: { up: 'Meglio della volta prima', down: 'Peggio della volta prima', same: 'Come la volta prima' },
  } satisfies Record<string, Record<Trend, string>>;
  const ICON = { up: 'up', down: 'down', same: 'same' } as const;
</script>

<!-- senza un prima non c'è paragone, e niente freccia -->
{#if trend}<span class="trend {trend}" role="img" aria-label={SAID[against][trend]}><Icon name={ICON[trend]} /></span>{/if}

<style>
  .trend {
    display: inline-grid;
    place-items: center;
    flex: none;
    width: 22px;
    height: 22px;
    border-radius: 50%;
  }

  .trend :global(.ico) { width: 14px; height: 14px; }

  .up { background: color-mix(in srgb, var(--ok) 16%, transparent); color: var(--ok); }
  .down { background: color-mix(in srgb, var(--danger) 14%, transparent); color: var(--danger); }
  .same { background: var(--sunken-hover); color: var(--ink-3); }
</style>
