<script lang="ts">
  import type { Snippet } from 'svelte';
  import { placeAnchored, placeBeside } from '../lib/popover';
  import { portal } from '../lib/portal';
  import { ui } from '../lib/ui.svelte';

  /**
   * Il foglietto che si apre accanto a qualcosa.
   *
   * Sei posti ne aprivano uno e sei volte era scritto lo stesso pezzo di
   * codice: dove metterlo, come si chiude con Esc, come si chiude cliccando
   * fuori, e l'animazione con cui entra. Sei copie della stessa cosa
   * cominciano a divergere il giorno che qualcuno ne corregge una sola — e
   * nel frattempo tre si chiudevano toccando fuori e tre no.
   *
   * Qui c'è il guscio e basta: la posizione, i due modi di chiudersi e il
   * vetro. Quello che ci va dentro lo sa chi lo apre.
   */
  let {
    anchor,
    width,
    height,
    onclose,
    onesc,
    place = 'anchored',
    id,
    role,
    label,
    children,
  }: {
    /** Il tasto che l'ha aperto: il foglietto gli sta accanto e non lo chiude. */
    anchor: HTMLElement;
    /** Quanto è largo e quanto è alto, per decidere da che parte aprirsi. */
    width: number;
    height: number;
    onclose: () => void;
    /** Chiuderlo con Esc, quando deve fare qualcosa in più che chiudersi. */
    onesc?: () => void;
    /**
     * `anchored` sotto al tasto, `beside` di fianco alla scheda quando c'è
     * spazio — che è quello che serve a un foglietto aperto dentro un pannello,
     * per non coprire il modulo che si sta compilando.
     */
    place?: 'anchored' | 'beside';
    /** Un nome, per chi deve ritrovarlo da fuori. */
    id?: string;
    /** Quando è una domanda e non un elenco, l'assistenza vocale deve saperlo. */
    role?: string;
    label?: string;
    children: Snippet;
  } = $props();

  /**
   * Segue il suo tasto.
   *
   * La pagina sotto può scorrere — dentro un elenco, o tutta intera — e il
   * foglietto restava sospeso a mezz'aria, staccato da quello che l'aveva
   * fatto nascere. E se quel tasto esce di vista il foglietto si chiude,
   * perché una domanda senza il suo oggetto non si capisce.
   */
  let segue = $state(0);
  const at = $derived.by(() => {
    segue;
    return place === 'beside' ? placeBeside(anchor, width, height) : placeAnchored(anchor, width, height);
  });

  $effect(() => {
    const guarda = (): void => {
      const box = anchor.getBoundingClientRect();
      const sparito = !anchor.isConnected || box.bottom < 0 || box.top > window.innerHeight;
      if (sparito) onclose();
      else segue += 1;
    };

    // in cattura, se no gli scorrimenti dentro a un elenco non si sentono
    window.addEventListener('scroll', guarda, true);
    window.addEventListener('resize', guarda);
    return () => {
      window.removeEventListener('scroll', guarda, true);
      window.removeEventListener('resize', guarda);
    };
  });

  /*
   * Si fa conoscere, così Esc chiude lui e non la finestra da cui è nato.
   * Chi lo apre ha uno stato suo — l'elenco dell'attesa, un orario — e
   * all'applicazione, che è quella che sente Esc, non lo diceva nessuno.
   */
  $effect(() => ui.sopra(() => (onesc ?? onclose)()));

  /**
   * Un clic fuori chiude, ma non quello sul tasto che l'ha aperto: quello sta
   * già dicendo «chiudimi» per conto suo, e chiuderlo due volte lo
   * riaprirebbe.
   */
  function elsewhere(event: PointerEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('[data-pop]') || anchor.contains(target)) return;
    onclose();
  }
</script>

<!-- Esc non si ascolta qui. Lo sente l'applicazione, che è l'unica a sapere
     cos'altro c'è aperto e in che ordine sta: sentendolo tutti e due, un Esc
     chiudeva questo foglietto e insieme la finestra sotto. -->
<svelte:window onpointerdown={elsewhere} />

<!-- la posizione passa da delle variabili e non da `left` e `top` scritti
     dritti qui: uno stile scritto sull'elemento vince su qualunque regola, e
     su un telefono questo foglietto non deve stare dove dice il conto -->
<div
  use:portal
  {id}
  {role}
  data-pop
  class="surface pop"
  aria-label={label}
  style:--pop-x="{at.left}px"
  style:--pop-y="{at.top}px"
  style:--pop-w="{width}px"
  style:--pop-h="{at.max}px"
>
  {@render children()}
</div>

<style>
  .pop {
    position: fixed;
    left: var(--pop-x);
    top: var(--pop-y);
    width: var(--pop-w);
    max-height: var(--pop-h);
    z-index: var(--z-popover);
    /* lo spazio intorno a quello che ci sta dentro lo mette il guscio, perché
       un foglietto senza un nome suo non deve restare senza */
    padding: 9px;
    /* più alto di quello che ha non diventa, e scorre */
    overflow-y: auto;
    animation: rise 0.16s var(--ease);
  }

  /*
   * Su un telefono non insegue il suo tasto: si appoggia in fondo.
   *
   * Inseguire ha senso dove il tasto è uno fra tanti e il foglietto è un
   * francobollo di fianco. Qui il tasto è largo ventiquattro pixel, il
   * foglietto ne prende trecento su trecentonovanta — un terzo di schermo —
   * e cade dove capita, spesso sopra la cosa che stavi guardando, con dentro
   * quaranta bersagli troppo piccoli per un dito. In fondo allo schermo,
   * largo quanto lo schermo, è dove il pollice arriva e dove c'è spazio per
   * far crescere quello che c'è dentro.
   */
  @media (max-width: 600px) {
    .pop {
      left: 0;
      top: auto;
      bottom: 0;
      width: auto;
      right: 0;
      max-height: min(70dvh, 560px);
      border-bottom: 0;
      border-radius: var(--r-lg) var(--r-lg) 0 0;
      padding: var(--card-pad);
      padding-bottom: calc(var(--card-pad) + env(safe-area-inset-bottom));
      animation: sheet-in-mobile 0.26s var(--ease);
    }
  }
</style>
