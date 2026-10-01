import { normalise } from './format';
import { readJSON, writeJSON } from './storage';

/**
 * Come si guarda un elenco.
 *
 * Oggi vuol dire in che ordine. Ma è la stessa domanda di «solo quelli che
 * non rispondono» o «per luogo»: cambiare come si guarda una cosa senza
 * cambiare la cosa. Se ognuna di queste scelte nascesse dove serve, ogni
 * elenco avrebbe i suoi metodi e le sue chiavi nel browser, e due elenchi
 * della stessa roba si comporterebbero in due modi. Qui ce n'è uno solo:
 * una vista sa quali criteri ha, quale è scelto, se lo ricorda, e li
 * applica tutti in fila con `applica`.
 *
 * I pezzi sono due, e ognuno si accende solo se chi crea la vista gli dà
 * quello che serve: l'ordine (`criteri`) e la ricerca per parola
 * (`testoDi`). Un terzo — un filtro, un raggruppamento — sarà un'opzione in
 * più e un passo in più dentro `applica`, e chi usa una vista non cambierà
 * una riga.
 *
 * A mostrarla ci pensano due pezzi diversi, perché si toccano in modo
 * diverso: in una tabella si tocca l'intestazione della colonna, in un
 * elenco di schede un comando sopra l'elenco (`ViewControls`). Lo stato è
 * lo stesso, e per questo le due cose non possono divergere.
 */

export type Verso = 'asc' | 'desc';

/** Un modo di mettere in fila. */
export interface Criterio<T> {
  id: string;
  /** Come si legge nel comando: «Nome», «Stato». */
  label: string;
  /**
   * Come si confrontano due voci, nel verso naturale.
   *
   * Manca negli elenchi che si mettono in fila sul server — gli avvisi
   * avvenuti arrivano a pagine, e mettere in fila una pagina sola
   * mentirebbe su tutte le altre. Lì la vista dice cosa chiedere, e basta.
   */
  per?: (a: T, b: T) => number;
  /** Il verso della prima volta: una data si legge dalla più recente. */
  verso?: Verso;
  /**
   * Le voci che per questo criterio non hanno niente da dire — una scena mai
   * partita, messa in fila per ultima esecuzione. Stanno in fondo in tutti e
   * due i versi: girare l'ordine le porterebbe in cima, davanti a quelle di
   * cui si voleva sapere.
   */
  inFondo?: (voce: T) => boolean;
}

interface Scelta {
  ordine: string;
  verso: Verso;
}

export interface OpzioniVista<T> {
  /**
   * Il nome sotto cui questo browser se la ricorda. Due elenchi della stessa
   * roba — i dispositivi di un agente, quelli della sua pagina — condividono
   * la chiave e si ordinano insieme.
   *
   * Senza, non si ricorda niente: è un ordine fisso, che nessuno sceglie —
   * i dispositivi fra cui sceglierne uno, le prossime partenze in fila come
   * avverranno — e passa di qui perché resti scritto in un posto solo.
   */
  chiave?: string;
  /** I modi di metterli in fila. Il primo è quello di partenza. */
  criteri: Criterio<T>[];
  iniziale?: string;
  /**
   * Dove si cerca quando si scrive una parola. Senza, la vista non cerca.
   *
   * La parola scritta non si ricorda: tornare su un elenco e trovarlo
   * ristretto a una ricerca di ieri farebbe credere che manchi qualcosa.
   *
   * Più campi, in ordine d'importanza — il nome, poi la categoria, poi la
   * nota — vogliono dire anche un ordine: mentre si cerca viene prima chi
   * risponde col primo campo, e fra quelli chi comincia con la parola. Il
   * criterio scelto decide fra chi risponde allo stesso modo.
   */
  testoDi?: (voce: T) => string | string[];
}

export class Vista<T> {
  readonly criteri: readonly Criterio<T>[];
  readonly #testoDi?: (voce: T) => string | string[];
  #chiave: string | null;
  #scelta = $state<Scelta>({ ordine: '', verso: 'asc' });

  /** Quello che si sta cercando, così com'è scritto. */
  cerca = $state('');

  constructor({ chiave, criteri, iniziale = criteri[0]?.id ?? '', testoDi }: OpzioniVista<T>) {
    this.criteri = criteri;
    this.#testoDi = testoDi;
    this.#chiave = chiave ? `gymlog.vista.${chiave}` : null;

    // una scelta ricordata vale solo se quel criterio c'è ancora: un nome
    // cambiato fra una versione e l'altra non deve lasciare l'elenco senza
    // ordine
    const ricordata = this.#chiave ? readJSON<Scelta | null>(this.#chiave, null) : null;
    const primo = criteri.find((one) => one.id === iniziale);
    this.#scelta =
      ricordata && criteri.some((one) => one.id === ricordata.ordine)
        ? ricordata
        : { ordine: iniziale, verso: primo?.verso ?? 'asc' };
  }

  get ordine(): string {
    return this.#scelta.ordine;
  }

  get verso(): Verso {
    return this.#scelta.verso;
  }

  get criterio(): Criterio<T> | undefined {
    return this.criteri.find((one) => one.id === this.#scelta.ordine);
  }

  /**
   * Mette in fila per quel criterio.
   *
   * Scegliere di nuovo quello già scelto lo gira: è quello che ci si aspetta
   * toccando due volte l'intestazione di una colonna, e il comando degli
   * elenchi fa lo stesso invece di inventarsi un gesto suo.
   */
  ordina(id: string): void {
    if (id === this.#scelta.ordine) return this.gira();
    const criterio = this.criteri.find((one) => one.id === id);
    if (!criterio) return;
    this.#salva({ ordine: id, verso: criterio.verso ?? 'asc' });
  }

  gira(): void {
    this.#salva({ ...this.#scelta, verso: this.#scelta.verso === 'asc' ? 'desc' : 'asc' });
  }

  /**
   * L'elenco come va guardato. Una copia: l'originale resta com'è, perché è
   * di qualcun altro e altri lo leggono nel suo ordine.
   */
  applica(voci: readonly T[]): T[] {
    let dopo = [...voci];

    // prima si cerca: mettere in fila cose che poi si buttano è lavoro perso
    const parola = normalise(this.cerca.trim());
    const testoDi = this.#testoDi;
    let pertinenza: Map<T, number> | null = null;
    if (parola && testoDi) {
      pertinenza = new Map();
      for (const voce of dopo) {
        const campi = testoDi(voce);
        const quanto = Array.isArray(campi) ? rispondeA(campi, parola) : normalise(campi).includes(parola) ? 0 : -1;
        if (quanto >= 0) pertinenza.set(voce, quanto);
      }
      const trovate = pertinenza;
      dopo = dopo.filter((voce) => trovate.has(voce));
    }

    const per = this.criterio?.per;
    if (per || pertinenza) {
      const segno = this.#scelta.verso === 'asc' ? 1 : -1;
      const inFondo = this.criterio?.inFondo;
      const quanto = pertinenza;
      dopo.sort((a, b) => {
        if (quanto) {
          const prima = quanto.get(a)! - quanto.get(b)!;
          if (prima) return prima;
        }
        if (!per) return 0;
        if (inFondo) {
          const giuA = inFondo(a);
          const giuB = inFondo(b);
          if (giuA !== giuB) return giuA ? 1 : -1;
          if (giuA) return 0;
        }
        return segno * per(a, b);
      });
    }
    return dopo;
  }

  /** Se la vista sa cercare: chi la mostra ci mette il campo solo allora. */
  get cercabile(): boolean {
    return this.#testoDi !== undefined;
  }

  /** Per gli elenchi che si mettono in fila sul server: cosa chiedere. */
  get richiesta(): string {
    return `ordine=${encodeURIComponent(this.#scelta.ordine)}&verso=${this.#scelta.verso}`;
  }

  #salva(scelta: Scelta): void {
    this.#scelta = scelta;
    if (this.#chiave) writeJSON(this.#chiave, scelta);
  }
}

/**
 * Quanto bene una voce risponde alla parola: 0 se il primo campo comincia
 * con lei, 1 se la contiene, 2 e 3 per il secondo campo, e così via. -1 se
 * non risponde da nessuna parte.
 */
function rispondeA(campi: string[], parola: string): number {
  for (const [at, campo] of campi.entries()) {
    const detto = normalise(campo);
    if (detto.startsWith(parola)) return at * 2;
    if (detto.includes(parola)) return at * 2 + 1;
  }
  return -1;
}

/* ----------------------------------------------------------- confronti */

/**
 * Due parole come si leggono: «Tenda 2» prima di «Tenda 10», e le accentate
 * insieme alle altre invece che in fondo. Per chi mette in fila qualcosa
 * che non si chiama `name`.
 */
export const perTesto = (a: string, b: string): number =>
  a.localeCompare(b, 'it', { numeric: true, sensitivity: 'base' });

/** Per nome, come si leggono (`perTesto`). */
export const perNome = <T extends { name: string }>(a: T, b: T): number => perTesto(a.name, b.name);

/**
 * Un confronto che, a parità, passa al nome. Due cose ugualmente accese si
 * leggono in ordine alfabetico, non nell'ordine in cui il server le ha
 * trovate — che cambierebbe da una volta all'altra.
 */
export const poiPerNome =
  <T extends { name: string }>(prima: (a: T, b: T) => number) =>
  (a: T, b: T): number =>
    prima(a, b) || perNome(a, b);
