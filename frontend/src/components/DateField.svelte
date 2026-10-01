<script lang="ts">
  import { nextDays, saysDay } from '../lib/timing';
  import PickField from './PickField.svelte';

  /**
   * Un giorno, scelto da un elenco corto.
   *
   * Non è un calendario e non vuole esserlo: qui si sceglie quando far
   * partire una scena una volta sola — la sera che parti, il giorno che
   * arriva qualcuno — e sono cose che stanno nelle prossime settimane. Un
   * mese da sfogliare, con le frecce avanti e indietro, per scegliere
   * «domani» è più lavoro di quanto ne risparmi.
   *
   * Le prime righe si leggono come si direbbero: oggi, domani, dopodomani.
   */
  let {
    value,
    onchange,
    label = 'In che giorno',
  }: {
    /** Come lo scrive un calendario: `2026-09-25`. */
    value: string;
    onchange: (next: string) => void;
    label?: string;
  } = $props();

  const GIORNI = nextDays(30).map((day) => ({ id: day, label: saysDay(day) }));
</script>

<PickField {value} options={GIORNI} {label} onpick={onchange} />
