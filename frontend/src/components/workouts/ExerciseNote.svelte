<script lang="ts">
  import { Autosave } from '../../lib/autosave.svelte';
  import { workoutsApi } from '../../lib/endpoints';
  import Alert from '../Alert.svelte';
  import SaveStatus from '../SaveStatus.svelte';
  import TextField from '../TextField.svelte';

  /**
   * La nota di un esercizio in questo allenamento: com'è andato, cosa
   * cambiare. La prossima volta si legge sotto «L'ultima volta».
   *
   * Si salva lasciando il campo, e solo se è cambiata (`TextField` con
   * `onchange`), con lo stesso stato discreto di ogni altro salvataggio
   * (`SaveStatus`). Rifiutata, il testo resta dov'è con il motivo sotto, e
   * lasciando il campo si riprova.
   */
  let { workoutId, exerciseId, note }: { workoutId: number; exerciseId: number; note: string } = $props();

  // svelte-ignore state_referenced_locally
  let value = $state(note);

  const saver = new Autosave<string | null>((text) => workoutsApi.saveNote(workoutId, exerciseId, text), 0);

  function save(next: string): void {
    saver.change(next.trim() === '' ? null : next.trim());
    void saver.flush();
  }
</script>

<label class="field">
  <span class="eyebrow">Nota <SaveStatus {saver} /></span>
  <TextField kind="multiline" label="Nota" bind:value maxlength={1000} placeholder="Come è andato, cosa cambiare la prossima volta" onchange={save} />
</label>
{#if saver.status === 'error'}<Alert message={saver.error} />{/if}

<style>
  .field { display: grid; gap: 6px; }
</style>
