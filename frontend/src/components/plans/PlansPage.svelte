<script lang="ts">
  import Row from '../Row.svelte';
  import { plansApi } from '../../lib/endpoints';
  import { planPath } from '../../lib/routing';
  import type { Plan } from '../../lib/types';
  import Alert from '../Alert.svelte';
  import Button from '../Button.svelte';
  import EmptyState from '../EmptyState.svelte';
  import Icon from '../Icon.svelte';
  import PageCard from '../PageCard.svelte';
  import PageShell from '../PageShell.svelte';
  import Loader from '../Loader.svelte';

  /** Le schede: quelle in uso in cima, le archiviate sotto, a parte. */
  let plans = $state<Plan[] | null>(null);
  let error = $state('');

  $effect(() => {
    plansApi.list().then((list) => (plans = list), (failure: Error) => (error = failure.message));
  });

  const active = $derived((plans ?? []).filter((plan) => !plan.archived));
  const archived = $derived((plans ?? []).filter((plan) => plan.archived));

  const exercisesIn = (plan: Plan) => plan.days.reduce((total, day) => total + day.exercises.length, 0);
</script>

{#snippet row(plan: Plan)}
  <li>
    <Row flat>
      <a class="go" href={planPath(plan.id)}>
        <span class="name">{plan.name}</span>
        <span class="days">
          {plan.days.length === 1 ? '1 giorno' : `${plan.days.length} giorni`} · {exercisesIn(plan) === 1 ? '1 esercizio' : `${exercisesIn(plan)} esercizi`}
        </span>
      </a>
    </Row>
  </li>
{/snippet}

<PageShell title="Schede" count={active.length}>
  {#snippet tools()}
    <!-- senza schede in uso il modo di scriverne una è quello dell'elenco vuoto: due sarebbero uno di troppo -->
    {#if active.length > 0}
      <Button look="ghost" size="sm" href={planPath(null)}>
        <Icon name="plus" /> Nuova
      </Button>
    {/if}
  {/snippet}

  {#if error}<Alert message={error} />{/if}

  {#if plans === null}
    {#if !error}<Loader />{/if}
  {:else}
    <PageCard>
      {#if active.length === 0}
        <EmptyState title="Nessuna scheda in uso." line="Una scheda ha i suoi giorni, e ogni giorno i suoi esercizi con serie e ripetizioni.">
          <Button look="primary" href={planPath(null)}>Scrivi una scheda</Button>
        </EmptyState>
      {:else}
        <ul class="rows">{#each active as plan (plan.id)}{@render row(plan)}{/each}</ul>
      {/if}
    </PageCard>

    {#if archived.length > 0}
      <PageCard>
        <span class="eyebrow">Archiviate</span>
        <ul class="rows">{#each archived as plan (plan.id)}{@render row(plan)}{/each}</ul>
      </PageCard>
    {/if}
  {/if}
</PageShell>

<style>
  .rows { display: grid; margin: 0; padding: 0; list-style: none; }

  /* il collegamento prende tutta la riga che gli dà Row */
  .go {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 2px;
    min-height: 52px;
    padding: 4px 0;
    border-radius: var(--r-sm);
    color: inherit;
    text-decoration: none;
  }

  .name { font-weight: 560; }

  .days { font-size: 12px; color: var(--ink-3); }
</style>
