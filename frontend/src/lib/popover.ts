const GAP = 10;

export interface Position {
  left: number;
  top: number;
  /**
   * Quanto può essere alto lì dove sta.
   *
   * Un foglietto più alto dello spazio che ha non si sposta: si accorcia e
   * scorre. Prima, quando non ci stava né sopra né sotto, finiva in cima
   * allo schermo — lontano dal tasto che l'aveva aperto, e su un telefono
   * sopra la testata della pagina.
   */
  max: number;
}

/**
 * Popovers open beside their sheet when there is room, so the form underneath
 * stays readable, and fall back to above/below the button when there is not.
 */
export function placeBeside(anchor: HTMLElement, width: number, height: number): Position {
  const rect = anchor.getBoundingClientRect();
  const sheet = anchor.closest('aside')?.getBoundingClientRect();

  const beside = sheet && sheet.left - width - GAP > 8 ? sheet.left - width - GAP : null;
  if (beside === null) return placeAnchored(anchor, width, height, rect.left);

  const alto = window.innerHeight - 16;
  const top = Math.min(Math.max(8, rect.top - 8), Math.max(8, window.innerHeight - Math.min(height, alto) - 8));
  return { left: beside, top, max: alto };
}

/**
 * A small popover belongs to the button that opened it: centred under it, or
 * above when there is no room below. Anything else reads as "wrong place".
 */
export function placeAnchored(anchor: HTMLElement, width: number, height: number, from?: number): Position {
  const rect = anchor.getBoundingClientRect();
  const left = Math.min(
    Math.max(8, from ?? rect.left + rect.width / 2 - width / 2),
    Math.max(8, window.innerWidth - width - 8),
  );

  const sotto = window.innerHeight - rect.bottom - GAP - 8;
  const sopra = rect.top - GAP - 8;

  if (height <= sotto) return { left, top: rect.bottom + GAP, max: sotto };
  if (height <= sopra) return { left, top: rect.top - height - GAP, max: sopra };

  // Non ci sta da nessuna delle due parti: si prende il lato più largo e il
  // foglietto si accorcia lì. Mandarlo dall'altra parte dello schermo
  // vorrebbe dire staccarlo da quello di cui sta parlando.
  return sotto >= sopra
    ? { left, top: rect.bottom + GAP, max: Math.max(120, sotto) }
    : { left, top: 8, max: Math.max(120, sopra) };
}
