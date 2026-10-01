<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Autosave } from '../../lib/autosave.svelte';
  import { plansApi } from '../../lib/endpoints';
  import { nav } from '../../lib/nav.svelte';
  import { addDay, draftOf, move, newKey, problemOf, toInput, type Draft, type DraftDay } from '../../lib/plan-draft';
  import { planPath, PLANS_PATH } from '../../lib/routing';
  import { toast } from '../../lib/toast.svelte';
  import type { Exercise, PlanInput } from '../../lib/types';
  import Alert from '../Alert.svelte';
  import Button from '../Button.svelte';
  import Icon from '../Icon.svelte';
  import PageCard from '../PageCard.svelte';
  import PageShell from '../PageShell.svelte';
  import PanelSkeleton from '../PanelSkeleton.svelte';
  import SaveStatus from '../SaveStatus.svelte';
  import Switch from '../Switch.svelte';
  import TextField from '../TextField.svelte';
  import { ui } from '../../lib/ui.svelte';
  import ExercisePicker from '../exercises/ExercisePicker.svelte';

  /**
   * Una scheda da scrivere: il nome, i giorni, e in ogni giorno gli esercizi
   * in ordine con serie, ripetizioni e recupero. Si salva da sé mentre la
   * scrivi, tutta insieme (`Autosave`): nessun tasto «Salva». Quella nuova
   * nasce appena ha un nome, e l'indirizzo diventa il suo senza rifare la
   * pagina. Quello che il server rifiuterebbe si dice prima, e non parte.
   */
  let { id }: { id: number | null } = $props();

  let draft = $state<Draft | null>(null);
  let error = $state('');
  let working = $state(false);
  // svelte-ignore state_referenced_locally
  let planId = $state(id);
  /** L'ultima versione mandata, o quella aperta: uguale, non si rimanda. */
  let sent = '';

  const saver = new Autosave<PlanInput>(async (input) => {
    if (planId !== null) return plansApi.save(planId, input);
    const created = await plansApi.create(input);
    planId = created.id;
    nav.rewrite(planPath(created.id));
  });
  // lasciando la pagina parte quello che aspettava
  onDestroy(() => void saver.flush());

  function opened(next: Draft): void {
    sent = JSON.stringify(toInput(next));
    draft = next;
  }

  $effect(() => {
    if (id === null) opened(draftOf(null));
    else plansApi.get(id).then((plan) => opened(draftOf(plan)), (failure: Error) => (error = failure.message));
  });

  const problem = $derived(draft ? problemOf(draft) : null);
  /* il nome che manca a una scheda appena cominciata non è un errore: si aspetta che arrivi */
  const shownProblem = $derived(problem && !(planId === null && draft?.name.trim() === '') ? problem : null);

  $effect(() => {
    if (!draft) return;
    const now = JSON.stringify(toInput(draft));
    if (now === sent || problem) return;
    sent = now;
    saver.change(JSON.parse(now) as PlanInput);
  });

  /** Un esercizio da aggiungere a un giorno, scelto in una finestra. */
  function pickFor(day: DraftDay): void {
    ui.openModal({
      title: `Aggiungi al giorno ${day.name.trim() || 'senza nome'}`,
      view: ExercisePicker,
      props: {
        exclude: day.exercises.map((one) => one.exerciseId),
        onpick: (exercise: Exercise) =>
          day.exercises.push({ key: newKey(), exerciseId: exercise.id, exerciseName: exercise.name, sets: 3, reps: '10', restSeconds: 90, notes: '' }),
      },
    });
  }

  /** Un numero scritto in un campo: vuoto o illeggibile è niente, il resto è il numero intero che c'è. */
  const whole = (text: string): number | null => {
    const value = Number(text.trim());
    return text.trim() === '' || !Number.isFinite(value) ? null : Math.trunc(value);
  };

  /** Prima si chiede, accanto al tasto: una scheda eliminata non torna. */
  function askRemove(anchor: HTMLElement): void {
    ui.askSure(anchor, {
      title: `Eliminare la scheda «${draft?.name.trim() || 'senza nome'}»?`,
      detail: 'Gli allenamenti già fatti restano nello storico.',
      verb: 'Elimina',
      onYes: () => void remove(),
    });
  }

  async function remove(): Promise<void> {
    if (planId === null) return;
    working = true;
    try {
      await plansApi.remove(planId);
      toast.show('Scheda eliminata. Gli allenamenti fatti restano nello storico.');
      nav.go(PLANS_PATH, { replace: true });
    } catch (failure) {
      error = (failure as Error).message;
    } finally {
      working = false;
    }
  }

  /** Il ritorno in cima alla pagina: un oggetto qui e non nel markup, che Stryker non sa leggere. */
  const back = { href: PLANS_PATH, label: 'Schede' };
</script>

<PageShell title={planId === null ? 'Nuova scheda' : (draft?.name || 'Scheda')} {back}>
  {#snippet meta()}<SaveStatus {saver} />{/snippet}
  {#if !draft && !error}
    <PageCard><PanelSkeleton /></PageCard>
  {:else if draft}
    <PageCard>
      <label class="field">
        <span class="eyebrow">Nome</span>
        <TextField bind:value={draft.name} placeholder="Forza, autunno" maxlength={100} />
      </label>
      <label class="field">
        <span class="eyebrow">Note</span>
        <TextField kind="multiline" bind:value={draft.notes} maxlength={1000} placeholder="Quante volte a settimana, cosa curare" />
      </label>
      <Switch
        checked={draft.archived}
        onchange={(value) => draft && (draft.archived = value)}
        label="Archiviata"
        note="Non compare fra quelle da cui iniziare un allenamento."
      />
    </PageCard>

    {#each draft.days as day, dayIndex (day.key)}
      <PageCard>
        <div class="day-head">
          <label class="field day-name">
            <span class="eyebrow">Giorno</span>
            <TextField bind:value={day.name} placeholder="A" maxlength={100} />
          </label>
          <span class="tools">
            <Button look="icon" title="Sposta su" disabled={dayIndex === 0} onclick={() => draft && (draft.days = move(draft.days, dayIndex, -1))}>
              <Icon name="up" />
            </Button>
            <Button look="icon" title="Sposta giù" disabled={dayIndex === draft.days.length - 1} onclick={() => draft && (draft.days = move(draft.days, dayIndex, 1))}>
              <Icon name="down" />
            </Button>
            <Button look="icon" tone="danger" title="Togli il giorno" onclick={() => draft && (draft.days = draft.days.filter((one) => one !== day))}>
              <Icon name="trash" />
            </Button>
          </span>
        </div>

        {#each day.exercises as exercise, index (exercise.key)}
          <div class="exercise">
            <div class="exercise-head">
              <span class="exercise-name">{exercise.exerciseName}</span>
              <span class="tools">
                <Button look="icon" size="sm" title="Sposta su" disabled={index === 0} onclick={() => (day.exercises = move(day.exercises, index, -1))}>
                  <Icon name="up" />
                </Button>
                <Button look="icon" size="sm" title="Sposta giù" disabled={index === day.exercises.length - 1} onclick={() => (day.exercises = move(day.exercises, index, 1))}>
                  <Icon name="down" />
                </Button>
                <Button look="icon" size="sm" tone="danger" title="Togli l’esercizio" onclick={() => (day.exercises = day.exercises.filter((one) => one !== exercise))}>
                  <Icon name="close" />
                </Button>
              </span>
            </div>
            <div class="numbers">
              <label class="field">
                <span class="eyebrow">Serie</span>
                <input
                  type="text"
                  inputmode="numeric"
                  value={String(exercise.sets)}
                  oninput={(event) => (exercise.sets = whole(event.currentTarget.value) ?? 0)}
                />
              </label>
              <label class="field">
                <span class="eyebrow">Ripetizioni</span>
                <TextField bind:value={exercise.reps} placeholder="8-10" maxlength={20} />
              </label>
              <label class="field">
                <span class="eyebrow">Recupero (s)</span>
                <input
                  type="text"
                  inputmode="numeric"
                  value={exercise.restSeconds === null ? '' : String(exercise.restSeconds)}
                  oninput={(event) => (exercise.restSeconds = whole(event.currentTarget.value))}
                />
              </label>
            </div>
            <TextField bind:value={exercise.notes} placeholder="Note, per esempio il tempo o la presa" maxlength={1000} label="Note" />
          </div>
        {/each}

        <span class="add">
          <Button look="ghost" size="sm" onclick={() => pickFor(day)}>
            <Icon name="plus" /> Aggiungi esercizio
          </Button>
        </span>
      </PageCard>
    {/each}

    <div class="bottom">
      <Button look="ghost" onclick={() => draft && addDay(draft)}>
        <Icon name="plus" /> Aggiungi giorno
      </Button>
    </div>

    {#if shownProblem}<Alert message={shownProblem} />{/if}
    {#if saver.status === 'error'}<Alert message={saver.error} />{/if}
    {#if error}<Alert message={error} />{/if}

    {#if planId !== null}
      <div class="actions">
        <Button look="danger" disabled={working} onclick={(event: MouseEvent) => askRemove(event.currentTarget as HTMLElement)}>
          <Icon name="trash" /> Elimina scheda
        </Button>
      </div>
    {/if}
  {:else if error}
    <Alert message={error} />
  {/if}
</PageShell>


<style>
  .day-head {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }

  .day-name { flex: 1; min-width: 0; }

  .tools { display: flex; align-items: center; gap: 2px; flex: none; }

  .exercise {
    display: grid;
    gap: 8px;
    padding: 10px 0 2px;
    border-top: 1px solid var(--hairline-soft);
  }

  .exercise-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .exercise-name { font-weight: 580; min-width: 0; overflow-wrap: anywhere; }

  .numbers {
    display: grid;
    grid-template-columns: 0.7fr 1fr 1fr;
    gap: 8px;
  }

  .numbers input { text-align: center; font-variant-numeric: tabular-nums; }

  .bottom { margin: 0 0 14px; }

  .actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 10px;
    margin-top: 14px;
  }

  .actions :global(.btn.primary) { padding: 12px 20px; }

  .add { justify-self: start; }
</style>
