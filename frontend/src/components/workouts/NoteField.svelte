<script lang="ts">
  import { tick } from 'svelte';
  import { Autosave } from '../../lib/autosave.svelte';
  import { formatDay } from '../../lib/format';
  import { ui } from '../../lib/ui.svelte';
  import Alert from '../Alert.svelte';
  import Button from '../Button.svelte';
  import Icon from '../Icon.svelte';
  import SaveStatus from '../SaveStatus.svelte';
  import TextField from '../TextField.svelte';

  /**
   * Una nota dell'allenamento — di un esercizio, o di tutto l'allenamento —
   * con quella dell'ultima volta sopra, da rileggere.
   *
   * Si salva lasciando il campo, e solo se è cambiata (`TextField` con
   * `onchange`), con lo stato discreto di ogni salvataggio. «Riusa» copia qui
   * la nota dell'ultima volta, col cursore in fondo per correggerla, e la
   * salva come ogni altra modifica; se oggi c'è già scritto qualcosa, prima
   * chiede. Non c'è quando non c'è niente da riusare, o quando è già uguale.
   */
  let {
    label,
    fieldLabel,
    placeholder,
    note,
    previous,
    save,
  }: {
    /** Il nome sopra il campo: «Nota», «Note». */
    label: string;
    /** Il nome del campo per chi non vede, quando serve distinguerlo. */
    fieldLabel?: string;
    placeholder: string;
    note: string;
    /** Quella dell'ultima volta; il giorno, se va detto qui. */
    previous: { note: string; startedAt?: string } | null;
    save: (text: string | null) => Promise<unknown>;
  } = $props();

  // svelte-ignore state_referenced_locally
  let value = $state(note);
  let field = $state<HTMLInputElement | HTMLTextAreaElement>();

  const saver = new Autosave<string | null>((text) => save(text), 0);

  function commit(next: string): void {
    saver.change(next.trim() === '' ? null : next.trim());
    void saver.flush();
  }

  const reusable = $derived(previous !== null && previous.note.trim() !== value.trim());

  async function reuse(): Promise<void> {
    if (!previous) return;
    value = previous.note;
    commit(value);
    await tick();
    // il testo assegnato lascia il cursore in fondo: si continua a scrivere da lì
    field?.focus();
  }

  function askReuse(anchor: HTMLElement): void {
    if (value.trim() === '') return void reuse();
    ui.askSure(anchor, {
      title: 'Sostituire la nota di oggi?',
      detail: 'Al suo posto va quella dell’ultima volta, da correggere.',
      verb: 'Sostituisci',
      onYes: () => void reuse(),
    });
  }
</script>

{#if previous}
  <div class="last">
    {#if previous.startedAt}<span class="eyebrow">L’ultima volta · {formatDay(previous.startedAt)}</span>{/if}
    <p class="last-note">«{previous.note}»</p>
    {#if reusable}
      <Button look="ghost" size="sm" aria-label="Riusa la nota dell’ultima volta" onclick={(event: MouseEvent) => askReuse(event.currentTarget as HTMLElement)}>
        <Icon name="copy" /> Riusa
      </Button>
    {/if}
  </div>
{/if}
<label class="field">
  <span class="eyebrow">{label} <SaveStatus {saver} /></span>
  <TextField kind="multiline" label={fieldLabel} bind:value bind:element={field} maxlength={1000} {placeholder} onchange={commit} />
</label>
{#if saver.status === 'error'}<Alert message={saver.error} />{/if}

<style>
  .field { display: grid; gap: 6px; }

  .last { display: grid; gap: 4px; justify-items: start; }

  .last-note { margin: 0; font-size: 12.5px; font-style: italic; color: var(--ink-2); overflow-wrap: anywhere; }
</style>
