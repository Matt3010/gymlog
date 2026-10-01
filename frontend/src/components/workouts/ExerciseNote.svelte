<script lang="ts">
  import { workoutsApi } from '../../lib/endpoints';
  import Alert from '../Alert.svelte';
  import TextField from '../TextField.svelte';

  /**
   * La nota di un esercizio in questo allenamento: com'è andato, cosa
   * cambiare. La prossima volta si legge sotto «L'ultima volta».
   *
   * Si salva lasciando il campo, e solo se è cambiata: è il modo dei campi di
   * restaurant-index (`TextField` con `onchange`). Lo dice piano, «Salvata»
   * accanto al nome, senza un messaggio che copra la pagina. Rifiutata, il
   * testo resta dov'è con il motivo sotto, e lasciando il campo si riprova.
   */
  let { workoutId, exerciseId, note }: { workoutId: number; exerciseId: number; note: string } = $props();

  // svelte-ignore state_referenced_locally
  let value = $state(note);
  let saved = $state(false);
  let error = $state('');

  async function save(next: string): Promise<void> {
    saved = false;
    error = '';
    try {
      await workoutsApi.saveNote(workoutId, exerciseId, next.trim() === '' ? null : next.trim());
      saved = true;
    } catch (failure) {
      error = (failure as Error).message;
    }
  }
</script>

<label class="field">
  <span class="eyebrow">Nota {#if saved}<span class="saved" role="status">Salvata</span>{/if}</span>
  <TextField kind="multiline" label="Nota" bind:value maxlength={1000} placeholder="Come è andato, cosa cambiare la prossima volta" onchange={(next) => void save(next)} />
</label>
{#if error}<Alert message={error} />{/if}

<style>
  .field { display: grid; gap: 6px; }

  .saved { margin-left: 6px; font-weight: 500; letter-spacing: 0; text-transform: none; color: var(--ink-3); }
</style>
