<script lang="ts">
  import { exercisesApi } from '../../lib/endpoints';
  import { chiusura } from '../../lib/fondo.svelte';
  import type { Exercise } from '../../lib/types';
  import AddRow from '../AddRow.svelte';
  import Alert from '../Alert.svelte';
  import SearchPicker from '../SearchPicker.svelte';

  /**
   * Scegli un esercizio, dentro a una finestra (`ui.openModal`): per un giorno
   * della scheda, o per l'allenamento in corso.
   *
   * Quelli che hai si cercano scrivendo (`SearchPicker`); quello che non c'è
   * si crea da qui, scrivendone il nome nella riga in cima (`AddRow`), e
   * finisce subito dove lo volevi: in mezzo a una scheda andare a crearlo
   * altrove vorrebbe dire perdere il filo. Scelto, la finestra si chiude.
   */
  let {
    exclude = [],
    onpick,
  }: {
    /** Quelli già presenti, che non si propongono di nuovo. */
    exclude?: number[];
    onpick: (exercise: Exercise) => void;
  } = $props();

  const chiudi = chiusura();

  let all = $state<Exercise[] | null>(null);
  let nuovo = $state('');
  let error = $state('');

  $effect(() => {
    exercisesApi.list().then((list) => (all = list), (failure: Error) => (error = failure.message));
  });

  const voci = $derived(
    (all ?? [])
      .filter((exercise) => !exclude.includes(exercise.id))
      .map((exercise) => ({ id: String(exercise.id), name: exercise.name, note: exercise.muscleGroup ?? undefined })),
  );

  function pick(exercise: Exercise): void {
    onpick(exercise);
    chiudi();
  }

  async function create(name: string): Promise<void> {
    error = '';
    try {
      pick(await exercisesApi.create({ name, muscleGroup: null, notes: null }));
      nuovo = '';
    } catch (failure) {
      error = (failure as Error).message;
    }
  }
</script>

<AddRow flat label="Crea e aggiungi" placeholder="Nuovo esercizio" title="Crea e aggiungi" bind:value={nuovo} onadd={create} />
{#if error}<Alert message={error} />{/if}
{#if all !== null}
  <SearchPicker
    {voci}
    chiave="esercizi.scelta"
    placeholder="Cerca fra i tuoi esercizi"
    vuoto="Nessun esercizio da proporre. Scrivi il nome di uno nuovo qui sopra."
    onpick={(id) => {
      const scelto = all?.find((exercise) => String(exercise.id) === id);
      if (scelto) pick(scelto);
    }}
  />
{/if}
