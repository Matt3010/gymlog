<script lang="ts">
  import { createElement } from 'lucide';
  import { ICONS, type IconName } from '../lib/icons';

  let { name }: { name: IconName } = $props();

  // Lucide hands back an SVG element; we only ever draw our own icon set.
  const markup = $derived.by(() => {
    const svg = createElement(ICONS[name]);
    svg.setAttribute('class', 'ico');
    svg.setAttribute('aria-hidden', 'true');
    return svg.outerHTML;
  });
</script>

{@html markup}
