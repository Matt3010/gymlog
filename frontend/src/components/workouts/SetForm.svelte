<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Autosave } from '../../lib/autosave.svelte';
  import { workoutsApi } from '../../lib/endpoints';
  import { tasti } from '../../lib/fondo.svelte';
  import { formatSet } from '../../lib/format';
  import type { SetInput, WorkoutSet } from '../../lib/types';
  import { ui } from '../../lib/ui.svelte';
  import { readSet } from '../../lib/workout';
  import Alert from '../Alert.svelte';
  import SaveStatus from '../SaveStatus.svelte';
  import Stepper from '../Stepper.svelte';
  import Switch from '../Switch.svelte';
  import TextField from '../TextField.svelte';

  /**
   * Una serie da correggere, o da togliere, dentro a una finestra
   * (`ui.openModal`): un numero sbagliato col pollice capita. Si salva da sé
   * mentre cambia, dopo una pausa, e chiudendo parte quello che aspettava:
   * nessun tasto «Salva». Togliere chiede prima, accanto al tasto.
   */
  let {
    set,
    number,
    onsaved,
    ondeleted,
  }: {
    set: WorkoutSet;
    /** Quale serie è, per la domanda: la seconda, la terza. */
    number: number;
    onsaved: (set: WorkoutSet) => void;
    ondeleted: (id: number) => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  let reps = $state(set.reps === null ? '' : String(set.reps));
  // svelte-ignore state_referenced_locally
  let kg = $state(set.weightKg === null ? '' : String(set.weightKg).replace('.', ','));
  // svelte-ignore state_referenced_locally
  let toFailure = $state(set.toFailure);
  // svelte-ignore state_referenced_locally
  let note = $state(set.note ?? '');
  let error = $state('');
  let working = $state(false);

  const saver = new Autosave<SetInput>(async (typed) => onsaved(await workoutsApi.updateSet(set.id, typed)));
  onDestroy(() => void saver.flush());

  /** Com'era scritta, per non rimandarla uguale. */
  const said = (one: SetInput) => JSON.stringify([one.reps, one.weightKg, one.toFailure, one.note]);
  // svelte-ignore state_referenced_locally
  let sent = said(set);

  $effect(() => {
    const typed = readSet(reps, kg, toFailure, note);
    // un numero a metà non è un errore: lo si dice lasciando il campo (`checked`)
    if ('error' in typed) return;
    error = '';
    const now = said(typed);
    if (now === sent) return;
    sent = now;
    saver.change(typed);
  });

  function checked(): void {
    const typed = readSet(reps, kg, toFailure, note);
    error = 'error' in typed ? typed.error : '';
  }

  // la finestra da chiudere dopo aver tolto è questa, anche se nel frattempo ne è comparsa un'altra
  const finestra = ui.modal;

  async function remove(): Promise<void> {
    working = true;
    try {
      await workoutsApi.removeSet(set.id);
      ondeleted(set.id);
      if (finestra) ui.closeModal(finestra);
    } catch (failure) {
      error = (failure as Error).message;
    } finally {
      working = false;
    }
  }

  tasti(() => [
    {
      label: 'Togli',
      look: 'danger',
      icon: 'trash',
      disabled: working,
      onpick: (anchor) => {
        ui.askSure(anchor, {
          title: `Togliere la serie ${number} di ${set.exerciseName}?`,
          verb: 'Togli',
          onYes: () => void remove(),
        });
        return false;
      },
    },
  ]);
</script>

<p class="was">Scritta come {formatSet(set)}{set.note ? ` · ${set.note}` : ''}. <SaveStatus {saver} /></p>
<!-- lasciando un campo si dice cosa non va, se qualcosa non va; il peso vuoto è senza peso -->
<div class="steppers" onfocusout={checked}>
  <Stepper label="Ripetizioni" step={1} min={1} bind:value={reps} />
  <Stepper label="Peso" unit="kg" step={2.5} decimals bind:value={kg} />
  <Switch checked={toFailure} onchange={(value) => (toFailure = value)} label="MAX" hint="A cedimento. Se non le hai contate, lascia vuote le ripetizioni." />
  <TextField bind:value={note} label="Nota della serie" placeholder="Nota della serie: SX, con riposo…" maxlength={100} />
</div>
{#if error}<Alert message={error} />{/if}
{#if saver.status === 'error'}<Alert message={saver.error} />{/if}

<style>
  .was { margin: 0; font-size: 12.5px; color: var(--ink-3); }

  .steppers { display: grid; gap: 10px; }
</style>
