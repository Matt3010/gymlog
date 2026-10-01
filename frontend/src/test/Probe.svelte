<script lang="ts">
  import { modifiche } from '../lib/fondo.svelte';

  /** A component to put in a window in tests: some text, and maybe something not saved. */
  let { text, dirty = false }: { text: string; dirty?: boolean } = $props();
  modifiche(() => dirty);
</script>

<p>{text}</p>
