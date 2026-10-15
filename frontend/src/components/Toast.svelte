<script lang="ts">
  import { toast } from '../lib/toast.svelte';

  // mentre c'è, le pagine gli lasciano il posto in fondo: non copre i loro ultimi tasti
  $effect(() => {
    document.body.classList.toggle('with-message', toast.open);
    return () => document.body.classList.remove('with-message');
  });
</script>

{#if toast.open}
  {#key toast.nonce}
    <div id="toast">
      <span>{toast.message}</span>
    </div>
  {/key}
{/if}

<style>
/* ------------------------------------------------------------------- toast */

#toast {
  position: fixed;
  left: 50%;
  /* the resting state has to centre on its own: toast-in only animates from it */
  transform: translateX(-50%);
  /* sopra la barra delle sezioni, che sta in fondo su ogni schermo */
  bottom: calc(var(--tab-bar) + 14px);
  z-index: var(--z-toast);
  display: flex;
  align-items: center;
  gap: 14px;
  /* una riga è una pillola; un messaggio lungo va a capo restando un rettangolo, non un cerchio */
  width: max-content;
  max-width: min(440px, calc(100vw - 32px));
  box-sizing: border-box;
  padding: 10px 18px;
  border-radius: 19px;
  line-height: 1.4;
  background: rgb(14 17 22 / 0.88);
  -webkit-backdrop-filter: blur(20px);
  backdrop-filter: blur(20px);
  color: #fff;
  font-size: 12.5px;
  box-shadow: var(--shadow-3);
  animation: toast-in 0.3s var(--ease);
}

:global([data-theme='dark']) #toast { background: rgb(242 244 247 / 0.94); color: #0e1116; }

/* con un foglio aperto in fondo va in cima, per non coprirne i tasti */
:global(body.sheet-open) #toast { top: calc(12px + env(safe-area-inset-top)); bottom: auto; }
</style>
