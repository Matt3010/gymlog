/*
 * I conti di un grafico a linee, senza disegnarlo: dove cadono i punti in una
 * scatola di misure date. Il disegno lo fa `LineChart.svelte`, in SVG, senza
 * librerie: due linee su poche decine di sessioni non le valgono.
 */

export interface Point {
  x: number;
  y: number;
  value: number;
}

export interface Line {
  label: string;
  points: Point[];
  path: string;
}

export interface Box {
  width: number;
  height: number;
  /** Il margine dentro la scatola, perché i punti sul bordo non si taglino. */
  pad: number;
}

/**
 * Le linee su una scala sola, la più vecchia a sinistra. Il basso e l'alto
 * si allargano di un decimo, perché il punto più alto non tocchi il bordo; una
 * linea piatta prende un chilo sopra e uno sotto, se no non ha altezza.
 */
export function chartOf(series: { label: string; values: number[] }[], box: Box): { lines: Line[]; low: number; high: number } {
  const all = series.flatMap((one) => one.values);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const room = (max - min) / 10;
  const [low, high] = all.length === 0 ? [0, 0] : max === min ? [min - 1, max + 1] : [min - room, max + room];

  const innerWidth = box.width - 2 * box.pad;
  const innerHeight = box.height - 2 * box.pad;
  const lines = series.map(({ label, values }) => {
    const step = values.length > 1 ? innerWidth / (values.length - 1) : 0;
    const points = values.map((value, index) => ({
      x: values.length > 1 ? box.pad + index * step : box.width / 2,
      y: box.pad + (innerHeight * (high - value)) / (high - low),
      value,
    }));
    const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ');
    return { label, points, path };
  });
  return { lines, low, high };
}
