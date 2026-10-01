<script lang="ts">
  import { ui } from '../lib/ui.svelte';
  import PickList from './PickList.svelte';
  import Popover from './Popover.svelte';

  /**
   * Scegliere una voce da un elenco corto, accanto al tasto che l'ha chiesto.
   *
   * È il fratello della domanda di conferma: stessa pasta, stesso posto, ma
   * invece di sì o no ci sono dei nomi. Serve dove la scelta è fra cose che
   * l'utente ha creato — su quale luogo mettere un agente — e dove un
   * selettore a tendina sarebbe un pezzo di modulo in mezzo a una scheda.
   */
  const request = $derived(ui.pick!);
  const options = $derived(typeof request.options === 'function' ? request.options() : request.options);

  function choose(id: string): void {
    const pick = request.onPick;
    ui.pick = null;
    pick(id);
  }
</script>

<Popover
  anchor={request.anchor}
  width={240}
  height={300}
  place="beside"
  id="pick-popover"
  onclose={() => (ui.pick = null)}
>
  <PickList {options} current={request.current} title={request.title} onpick={choose} />
</Popover>

