<script lang="ts">
  import { Autosave } from '../../lib/autosave.svelte';
  import { exercisesApi } from '../../lib/endpoints';
  import { tasti } from '../../lib/fondo.svelte';
  import { toast } from '../../lib/toast.svelte';
  import type { Exercise, ExerciseInput } from '../../lib/types';
  import { ui } from '../../lib/ui.svelte';
  import Alert from '../Alert.svelte';
  import SaveStatus from '../SaveStatus.svelte';
  import TextField from '../TextField.svelte';

  /**
   * Un esercizio da correggere, dentro a una finestra (`ui.openModal`): uno
   * nuovo nasce dal nome scritto nella riga in fondo all'elenco, e qui si
   * aggiungono gruppo e note. Ogni campo si salva lasciandolo, se è cambiato:
   * nessun tasto «Salva». In fondo resta solo «Elimina», che chiede prima,
   * accanto al tasto. Il server rifiuta comunque quello che è in una
   * scheda o in un allenamento, e lo dice: la finestra resta aperta con il
   * motivo.
   */
  let {
    exercise,
    onsaved,
    ondeleted,
  }: {
    exercise: Exercise;
    onsaved: (exercise: Exercise) => void;
    ondeleted: (id: number) => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  let name = $state(exercise.name);
  // svelte-ignore state_referenced_locally
  let muscleGroup = $state(exercise.muscleGroup ?? '');
  // svelte-ignore state_referenced_locally
  let notes = $state(exercise.notes ?? '');
  let error = $state('');
  let working = $state(false);

  const orNull = (text: string) => (text.trim() === '' ? null : text.trim());

  const saver = new Autosave<ExerciseInput>(async (input) => onsaved(await exercisesApi.update(exercise.id, input)), 0);

  /** Lasciando un campo cambiato: si manda com'è adesso l'esercizio intero. Senza nome no, e lo si dice. */
  function changed(): void {
    if (name.trim() === '') {
      error = 'L’esercizio ha bisogno di un nome.';
      return;
    }
    error = '';
    saver.change({ name: name.trim(), muscleGroup: orNull(muscleGroup), notes: orNull(notes) });
    void saver.flush();
  }

  async function remove(close: () => void): Promise<void> {
    working = true;
    try {
      await exercisesApi.remove(exercise.id);
      toast.show('Esercizio eliminato.');
      ondeleted(exercise.id);
      close();
    } catch (failure) {
      error = (failure as Error).message;
    } finally {
      working = false;
    }
  }

  // la finestra che si chiude dopo l'eliminazione è questa, anche se nel frattempo ne è comparsa un'altra
  const finestra = ui.modal;

  tasti(() => [
    {
      label: 'Elimina',
      look: 'danger' as const,
      icon: 'trash' as const,
      disabled: working,
      onpick: (anchor: HTMLElement) => {
        ui.askSure(anchor, {
          title: `Eliminare l’esercizio «${exercise.name}»?`,
          detail: 'Si può solo se non è in una scheda o in un allenamento.',
          verb: 'Elimina',
          onYes: () => void remove(() => finestra && ui.closeModal(finestra)),
        });
        return false;
      },
    },
  ]);
</script>

<div class="form">
  <SaveStatus {saver} />
  <label class="field">
    <span class="eyebrow">Nome</span>
    <TextField bind:value={name} placeholder="Panca piana" maxlength={100} required onchange={changed} />
  </label>
  <label class="field">
    <span class="eyebrow">Gruppo muscolare</span>
    <TextField bind:value={muscleGroup} placeholder="Petto" maxlength={100} onchange={changed} />
  </label>
  <label class="field">
    <span class="eyebrow">Note</span>
    <TextField kind="multiline" bind:value={notes} maxlength={1000} placeholder="Presa, sedile, come si esegue" onchange={changed} />
  </label>
</div>

{#if error}<Alert message={error} />{/if}
{#if saver.status === 'error'}<Alert message={saver.error} />{/if}

<style>
  .form { display: grid; gap: 12px; }
</style>
