/**
 * Il numero dopo un tocco su «più» o «meno».
 *
 * Il valore è testo, perché un peso si scrive anche con la virgola: si legge
 * con la virgola o col punto, e si riscrive con la virgola. Vuoto o illeggibile
 * vale il minimo, e sotto il minimo non si scende. Arrotondato ai centesimi,
 * perché 0,1 + 0,2 per un computer non fa 0,3.
 */
export function stepValue(
  text: string,
  direction: 1 | -1,
  { step, min = 0, decimals = false }: { step: number; min?: number; decimals?: boolean },
): string {
  const read = Number(text.trim().replace(',', '.'));
  const from = text.trim() === '' || !Number.isFinite(read) ? min : read;
  const next = Math.max(min, Math.round((from + direction * step) * 100) / 100);
  return decimals ? String(next).replace('.', ',') : String(Math.round(next));
}
