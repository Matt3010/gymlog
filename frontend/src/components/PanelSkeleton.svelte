<!-- Senza un blocco di codice, anche vuoto, chi legge i tipi non sa dire
     cosa sia questo file e il controllo si ferma su un errore che non
     riguarda nessuno. -->
<script lang="ts"></script>

<!-- Lo scheletro del pannello mentre il primo stato arriva dal server:
     meglio una forma vuota che un conteggio sbagliato. -->
<div class="skeleton-block">
  <span class="skeleton chip-ghost" style="width: 96px"></span>
  <span class="skeleton chip-ghost" style="width: 74px"></span>
  <span class="skeleton chip-ghost" style="width: 88px"></span>
</div>
<div class="skeleton-rows">
  {#each [0, 1, 2] as row (row)}
    <div class="skeleton-row">
      <span class="skeleton dot"></span>
      <span class="skeleton line" style="width: {70 - row * 12}%"></span>
    </div>
  {/each}
</div>

<style>
  .skeleton-block {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .skeleton-rows {
    display: grid;
    gap: 10px;
    padding: 12px 8px 4px;
  }

  .skeleton-row {
    display: flex;
    align-items: center;
    gap: 9px;
  }

  .skeleton {
    display: block;
    background: var(--sunken-hover);
    animation: pulse 1.4s ease-in-out infinite;
  }

  .chip-ghost { height: 30px; border-radius: 99px; }
  .dot { width: 26px; height: 26px; border-radius: 50%; flex: none; }
  .line { height: 10px; border-radius: 99px; }

  @keyframes pulse {
    50% { opacity: 0.45; }
  }
</style>
