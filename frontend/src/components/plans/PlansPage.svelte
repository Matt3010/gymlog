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

  /** Le schede, per nome: ognuna è un allenamento. */
  let plans = $state<Plan[] | null>(null);
  let error = $state('');

  $effect(() => {
    plansApi.list().then((list) => (plans = list), (failure: Error) => (error = failure.message));
  });

</script>

{#snippet row(plan: Plan)}
  <li>
    <Row flat>
      <a class="go" href={planPath(plan.id)}>
        <span class="name">{plan.name}</span>
        <span class="what">
          {plan.exercises.length === 0 ? 'Nessun esercizio' : plan.exercises.map((exercise) => exercise.exerciseName).join(', ')}
        </span>
      </a>
    </Row>
  </li>
{/snippet}

<PageShell title="Schede" count={plans?.length ?? 0}>
  {#snippet tools()}
    <!-- senza schede il modo di scriverne una è quello dell'elenco vuoto: due sarebbero uno di troppo -->
    {#if plans && plans.length > 0}
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
      {#if plans.length === 0}
        <EmptyState title="Nessuna scheda, per ora." line="Una scheda è un allenamento: i suoi esercizi, con serie, ripetizioni e recupero.">
          <Button look="primary" href={planPath(null)}>Scrivi una scheda</Button>
        </EmptyState>
      {:else}
        <ul class="rows">{#each plans as plan (plan.id)}{@render row(plan)}{/each}</ul>
      {/if}
    </PageCard>
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

  /* gli esercizi su una riga sola: si riconosce la scheda, non serve leggerli tutti */
  .what { font-size: 12px; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
