<script lang="ts">
  import { exercisesApi } from '../../lib/endpoints';
  import { tasti } from '../../lib/fondo.svelte';
  import { toast } from '../../lib/toast.svelte';
  import type { Exercise } from '../../lib/types';
  import { ui } from '../../lib/ui.svelte';
  import Alert from '../Alert.svelte';
  import TextField from '../TextField.svelte';

  /**
   * Un esercizio da correggere, dentro a una finestra (`ui.openModal`): uno
   * nuovo nasce dal nome scritto nella riga in fondo all'elenco, e qui si
   * aggiungono gruppo e note. I tasti in fondo li detta da qui (`tasti`);
   * eliminarlo chiede prima, accanto al tasto. Il server rifiuta comunque quello che è in una
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

  /** Torna `false` per lasciare aperta la finestra, col motivo scritto dentro. */
  async function save(): Promise<false | void> {
    if (name.trim() === '') {
      error = 'L’esercizio ha bisogno di un nome.';
      return false;
    }
    error = '';
    working = true;
    try {
      const input = { name: name.trim(), muscleGroup: orNull(muscleGroup), notes: orNull(notes) };
      const saved = await exercisesApi.update(exercise.id, input);
      toast.show('Esercizio salvato.');
      onsaved(saved);
    } catch (failure) {
      error = (failure as Error).message;
      return false;
    } finally {
      working = false;
    }
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
    { label: 'Salva', look: 'primary' as const, disabled: working, onpick: save },
  ]);
</script>

<form
  class="form"
  onsubmit={(event) => {
    event.preventDefault();
    void save().then((resta) => resta !== false && finestra && ui.closeModal(finestra));
  }}
>
  <label class="field">
    <span class="eyebrow">Nome</span>
    <TextField bind:value={name} placeholder="Panca piana" maxlength={100} required />
  </label>
  <label class="field">
    <span class="eyebrow">Gruppo muscolare</span>
    <TextField bind:value={muscleGroup} placeholder="Petto" maxlength={100} />
  </label>
  <label class="field">
    <span class="eyebrow">Note</span>
    <TextField kind="multiline" bind:value={notes} maxlength={1000} placeholder="Presa, sedile, come si esegue" />
  </label>
  <!-- l'invio da tastiera salva, come il tasto in fondo -->
  <button type="submit" hidden aria-hidden="true" tabindex="-1"></button>
</form>

{#if error}<Alert message={error} />{/if}

<style>
  .form { display: grid; gap: 12px; }
</style>
