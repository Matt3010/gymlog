<script lang="ts">
  import { chartOf } from '../../lib/chart';
  import { formatNumber } from '../../lib/format';

  /**
   * Come va un esercizio nel tempo: il peso massimo e la media di ogni
   * sessione, dalla più vecchia a sinistra alla più recente a destra.
   *
   * SVG scritto a mano: due linee su poche decine di punti non valgono una
   * libreria. I conti stanno in `lib/chart.ts`; qui c'è il disegno, con i
   * colori dei token, così segue il tema come il resto. Per chi non vede, il
   * grafico si dice in una frase.
   */
  let { name, sessions }: { name: string; sessions: { maxWeight: number; avgWeight: number }[] } = $props();

  const BOX = { width: 320, height: 150, pad: 12 };

  const series = $derived([
    { key: 'max', label: 'Massimo', values: sessions.map((session) => session.maxWeight) },
    { key: 'avg', label: 'Media', values: sessions.map((session) => session.avgWeight) },
  ]);
  const all = $derived(series.flatMap((one) => one.values));
  const chart = $derived(chartOf(series.map(({ label, values }) => ({ label, values })), BOX));

  const range = (values: number[]) => `da ${formatNumber(values[0]!)} a ${formatNumber(values.at(-1)!)} kg`;
  const said = $derived(
    `Andamento di ${name} in ${sessions.length} sessioni: massimo ${range(series[0]!.values)}, media ${range(series[1]!.values)}.`,
  );
</script>

<figure class="chart">
  <svg viewBox="0 0 {BOX.width} {BOX.height}" role="img" aria-label={said} preserveAspectRatio="none">
    <line class="rule" x1={BOX.pad} x2={BOX.width - BOX.pad} y1={BOX.pad} y2={BOX.pad} />
    <line class="rule" x1={BOX.pad} x2={BOX.width - BOX.pad} y1={BOX.height - BOX.pad} y2={BOX.height - BOX.pad} />
    {#each chart.lines as line, index (series[index]!.key)}
      <path class="line {series[index]!.key}" data-series={series[index]!.key} d={line.path} />
      {#each line.points as point, at (at)}
        <circle class="dot {series[index]!.key}" data-series={series[index]!.key} data-value={point.value} cx={point.x} cy={point.y} r="3" />
      {/each}
    {/each}
  </svg>
  <figcaption>
    <span class="key"><span class="swatch max"></span>Massimo</span>
    <span class="key"><span class="swatch avg"></span>Media</span>
    <!-- i valori veri, non i bordi allargati del disegno: «84,9–101,4» non diceva niente -->
    <span class="scale">{formatNumber(Math.min(...all))}–{formatNumber(Math.max(...all))} kg</span>
  </figcaption>
</figure>

<style>
  .chart { display: grid; gap: 8px; margin: 0; }

  svg { display: block; width: 100%; height: 150px; overflow: visible; }

  .rule { stroke: var(--hairline-soft); stroke-width: 1; vector-effect: non-scaling-stroke; }

  .line {
    fill: none;
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
  }

  /* il massimo è la notizia, col colore dell'inchiostro; la media gli sta sotto, in blu */
  .line.max { stroke: var(--ink); }
  .line.avg { stroke: var(--me); stroke-dasharray: 5 4; }

  .dot { stroke: var(--glass-strong); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
  .dot.max { fill: var(--ink); }
  .dot.avg { fill: var(--me); }

  figcaption { display: flex; align-items: center; gap: 14px; font-size: 12px; color: var(--ink-2); }

  .key { display: inline-flex; align-items: center; gap: 6px; }

  .swatch { width: 14px; height: 3px; border-radius: 2px; }
  .swatch.max { background: var(--ink); }
  .swatch.avg { background: var(--me); }

  .scale { margin-left: auto; color: var(--ink-3); font-variant-numeric: tabular-nums; }
</style>
