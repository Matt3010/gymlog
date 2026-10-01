<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Autosave } from '../../lib/autosave.svelte';
  import { workoutsApi } from '../../lib/endpoints';
  import { tasti } from '../../lib/fondo.svelte';
  import { formatKg } from '../../lib/format';
  import type { WorkoutSet } from '../../lib/types';
  import { ui } from '../../lib/ui.svelte';
  import { readSet } from '../../lib/workout';
  import Alert from '../Alert.svelte';
  import SaveStatus from '../SaveStatus.svelte';
  import Stepper from '../Stepper.svelte';

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
  let reps = $state(String(set.reps));
  // svelte-ignore state_referenced_locally
  let kg = $state(String(set.weightKg).replace('.', ','));
  let error = $state('');
  let working = $state(false);

  const saver = new Autosave<{ reps: number; weightKg: number }>(async (typed) => onsaved(await workoutsApi.updateSet(set.id, typed)));
  onDestroy(() => void saver.flush());

  /** Com'era scritta, per non rimandarla uguale. */
  // svelte-ignore state_referenced_locally
  let sent = `${set.reps}|${set.weightKg}`;

  $effect(() => {
    const typed = readSet(reps, kg);
    if ('error' in typed) {
      error = typed.error;
      return;
    }
    error = '';
    const now = `${typed.reps}|${typed.weightKg}`;
    if (now === sent) return;
    sent = now;
    saver.change(typed);
  });

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

<p class="was">Scritta come {set.reps} × {formatKg(set.weightKg)}. <SaveStatus {saver} /></p>
<div class="pair">
  <Stepper label="Ripetizioni" step={1} min={1} bind:value={reps} />
  <Stepper label="Peso" unit="kg" step={2.5} decimals bind:value={kg} />
</div>
{#if error}<Alert message={error} />{/if}
{#if saver.status === 'error'}<Alert message={saver.error} />{/if}

<style>
  .was { margin: 0; font-size: 12.5px; color: var(--ink-3); }

  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
</style>
