<script lang="ts">
  import { onMount } from 'svelte';
  import { adminApi } from '../../lib/endpoints';
  import type { UserUsage } from '../../lib/types';
  import Alert from '../Alert.svelte';
  import Loader from '../Loader.svelte';
  import PageCard from '../PageCard.svelte';
  import PageShell from '../PageShell.svelte';

  /**
   * Come usano l'app tutti gli utenti, per chi la amministra: quanti sono,
   * quanti tornano, e per ognuno quanto ha e quando c'era. Solo conti e
   * date: gli allenamenti di qualcun altro restano suoi.
   */
  let users = $state<UserUsage[] | null>(null);
  let error = $state('');

  onMount(() => {
    adminApi.usage().then((usage) => (users = usage.users), (failure: Error) => (error = failure.message));
  });

  const DAY = 86_400_000;
  const startOfDay = (date: Date): number => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  /** Giorni di calendario da quel momento a oggi. */
  const daysSince = (iso: string): number => Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / DAY);
  const when = (iso: string): string => {
    const days = daysSince(iso);
    return days <= 0 ? 'oggi' : days === 1 ? 'ieri' : `${days} giorni fa`;
  };
  /** L'ultima volta che ha fatto qualcosa: aperto l'app o iniziato un allenamento. */
  const lastActive = (user: UserUsage): string | null =>
    [user.lastSeenAt, user.lastWorkoutAt].filter((one): one is string => one !== null).sort().at(-1) ?? null;
  const activeWithin = (days: number) => (users ?? []).filter((user) => {
    const last = lastActive(user);
    return last !== null && daysSince(last) < days;
  }).length;
  const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

  const totals = $derived(users === null ? [] : [
    { label: 'Utenti', value: users.length },
    { label: 'Attivi in 7 giorni', value: activeWithin(7) },
    { label: 'Attivi in 30 giorni', value: activeWithin(30) },
    { label: 'Allenamenti in 30 giorni', value: users.reduce((sum, user) => sum + user.workoutsLast30Days, 0) },
  ]);
</script>

<PageShell title="Utilizzo">
  {#if users === null}
    {#if !error}<Loader />{/if}
  {:else}
    <PageCard label="In tutto">
      <dl class="tiles">
        {#each totals as tile (tile.label)}
          <div><dt class="eyebrow">{tile.label}</dt><dd>{tile.value}</dd></div>
        {/each}
      </dl>
    </PageCard>

    <PageCard label="Utenti">
      <span class="eyebrow">Utenti</span>
      <ul class="rows">
        {#each users as user (user.id)}
          <li class="user">
            <span class="name">{user.username}{#if user.isAdmin}{' '}<span class="badge">admin</span>{/if}</span>
            <span class="when">
              {user.lastSeenAt === null ? 'Non visto da 30 giorni' : `Visto ${when(user.lastSeenAt)}`} · {user.lastWorkoutAt === null ? 'nessun allenamento' : `ultimo allenamento ${when(user.lastWorkoutAt)}`}
            </span>
            <span class="what">
              {count(user.workouts, 'allenamento', 'allenamenti')}{user.workouts > 0 ? ` (${user.workoutsLast30Days} in 30 giorni)` : ''}
              · {count(user.sets, 'serie', 'serie')} · {count(user.exercises, 'esercizio', 'esercizi')} · {count(user.plans, 'scheda', 'schede')}
            </span>
          </li>
        {/each}
      </ul>
    </PageCard>
  {/if}

  {#if error}<Alert message={error} />{/if}
</PageShell>

<style>
  .tiles {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px 10px;
    margin: 0;
  }

  /* un nome su due righe non abbassa il suo numero: i numeri stanno tutti in fondo, in fila */
  .tiles div { display: grid; grid-template-rows: 1fr auto; align-items: end; gap: 3px; min-width: 0; }

  dd {
    margin: 0;
    font-size: 17px;
    font-weight: 620;
    letter-spacing: -0.015em;
    font-variant-numeric: tabular-nums;
  }

  .rows { display: grid; margin: 0; padding: 0; list-style: none; }

  /* un utente per riga, piatta, separata dal tratto come le righe di ogni elenco */
  .user {
    display: grid;
    gap: 2px;
    padding: 10px 0;
    border-bottom: 1px solid var(--hairline-soft);
  }

  /* lo spazio sotto il titolo lo dà la card: la prima riga non ne aggiunge */
  .user:first-child { padding-top: 0; }

  .user:last-child { border-bottom: 0; padding-bottom: 0; }

  .name { display: flex; align-items: center; gap: 6px; font-weight: 580; overflow-wrap: anywhere; }

  .badge {
    padding: 1px 7px;
    border-radius: 99px;
    background: var(--sunken);
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--ink-2);
  }

  .when, .what { font-size: 12.5px; color: var(--ink-3); }

  .when { color: var(--ink-2); }
</style>
