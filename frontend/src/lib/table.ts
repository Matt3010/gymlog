/** Le colonne di una tabella: qui e non in `Table.svelte`, perché un componente non può esportare un tipo. */
export interface Column {
  label: string;
  /** Una misura (`84px`), o `fit` per stringersi al contenuto; senza, si divide lo spazio con le altre. */
  width?: string | 'fit';
  /** I numeri e le date stanno a destra: si leggono in colonna. */
  align?: 'start' | 'end';
  /** Il criterio della vista con cui questa colonna ordina le righe; senza, l'intestazione non si preme. */
  ordina?: string;
}

/** Una voce da scegliere: un identificativo, come si legge, e un'aggiunta. */
export interface Choice {
  id: string;
  label: string;
  /** Qualcosa da dire su quella voce: «già nella scheda». */
  note?: string;
}
