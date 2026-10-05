<script lang="ts">
  import { toast } from '../lib/toast.svelte';
  import Icon from './Icon.svelte';

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
      {#if toast.action}
        <button
          type="button"
          class="toast-action"
          onclick={() => {
            const action = toast.action;
            toast.hide();
            action?.run();
          }}
        >
          <Icon name="undo" />
          {toast.action.label}
        </button>
      {/if}
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
  /* una riga sola è una pillola, e un messaggio lungo va a capo dentro allo
     schermo restando un rettangolo: con un raggio da pillola, su tre righe,
     diventava un cerchio */
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

/* room for the button, but only when there is one: otherwise the text sits off-centre */
#toast:has(.toast-action) { padding-right: 12px; }

.toast-action {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 0;
  border-radius: 99px;
  background: rgb(255 255 255 / 0.14);
  color: inherit;
  font: inherit;
  font-size: 12.5px;
  font-weight: 540;
  transition: background 0.15s;
}

@media (hover: hover) {
  .toast-action:hover { background: rgb(255 255 255 / 0.24); }
}

.toast-action :global(.ico) { width: 14px; height: 14px; }

@media (prefers-color-scheme: dark) {
  #toast { background: rgb(242 244 247 / 0.94); color: #0e1116; }

  .toast-action { background: rgb(14 17 22 / 0.1); }

  .toast-action:hover { background: rgb(14 17 22 / 0.18); }
}

/* con un foglio aperto in fondo ci sono i suoi tasti, e un messaggio lì sopra
   copre proprio quello che si stava per premere: va in cima */
:global(body.sheet-open) #toast { top: calc(12px + env(safe-area-inset-top)); bottom: auto; }
</style>
