# gymlog

Le schede della palestra, gli allenamenti e i pesi fatti, serie per serie: con le
medie, i massimi e il massimale stimato di ogni esercizio, sessione per sessione.
Una PWA da usare dal telefono in palestra, installabile sulla schermata Home.

## Anteprima

<p>
  <img src="docs/screens/home.png" width="180" alt="Allenati: la scheda e i suoi allenamenti da cui partire">
  <img src="docs/screens/workout.png" width="180" alt="Un allenamento in corso, con l'ultima volta e il recupero">
  <img src="docs/screens/exercise-stats.png" width="180" alt="Le statistiche di un esercizio, con il grafico">
  <img src="docs/screens/plan.png" width="180" alt="Una scheda: gli allenamenti A e B con serie e recupero">
</p>
<p>
  <img src="docs/screens/history.png" width="180" alt="Lo storico degli allenamenti">
  <img src="docs/screens/home-dark.png" width="180" alt="Allenati, di notte">
  <img src="docs/screens/workout-dark.png" width="180" alt="Un allenamento in corso, di notte">
  <img src="docs/screens/exercise-stats-dark.png" width="180" alt="Le statistiche di un esercizio, di notte">
</p>

Le schermate si rifanno da sole, con qualche settimana di allenamenti finti
(`frontend/e2e/screens.spec.ts`):

```bash
SCREENS=1 E2E_DATABASE_URL=postgres://postgres:test@127.0.0.1:55432 pnpm --filter frontend test:e2e screens
```

```
 telefono (PWA) ── HTTPS ── Cloudflare Tunnel ── nginx (gymlog-web) ─┬─ /      app Svelte
                                                                     └─ /api/  API Node (gymlog-api) ── Postgres
```

Tutto gira con docker compose su un Raspberry Pi, senza porte aperte: nginx ascolta
solo su `127.0.0.1:8091` e il tunnel lo pubblica in HTTPS (necessario per una PWA).

## Cosa fa

- **Esercizi:** i tuoi, con gruppo muscolare e note.
- **Schede:** con il periodo in cui si seguono (dal… al…) e più allenamenti (A, B, C…),
  ognuno con gli esercizi in ordine, serie, ripetizioni ("8", "8-10", "max"), recupero e
  note. Creando una scheda nuova, quella in uso finisce il giorno prima e si archivia.
- **Allenamenti:** parti da un giorno della scheda o da un allenamento libero. Per ogni
  esercizio vedi cosa chiede la scheda e cosa hai fatto l'ultima volta; registri ogni
  serie (ripetizioni × kg), con il recupero che parte da solo. I nomi della scheda e
  del giorno restano nello Storico (una sezione sua, nella barra in basso) anche se poi
  cambi o cancelli la scheda.
- **Statistiche:** nell'elenco degli esercizi, accanto a ognuno, peso medio, massimo,
  sessioni e l'ultima volta; aprendolo, sessione per sessione: serie, ripetizioni,
  volume (ripetizioni × kg), peso medio delle serie, peso massimo e massimale stimato
  (formula di Epley), con il grafico del massimale stimato e del peso più alto.
- **Uno alla volta:** con un allenamento in corso non se ne comincia un altro.
- **In corso:** l'allenamento aperto sta in una barra sopra le sezioni, da ogni pagina:
  cosa è, quante serie e da quanto, o il recupero che manca (che continua anche fuori
  dall'allenamento). Toccandola si riprende.
- **Riscaldamento:** nell'esercizio aperto, una linguetta col consiglio (non si segna):
  40% × 8, 60% × 5, 80% × 3 del peso della prima serie, più un singolo al 90% da 100 kg,
  al 2,5 sotto. Viene prima finché dell'esercizio non si è fatta nessuna serie.
- **Meglio o peggio:** una freccia verde, rossa o grigia accanto a ogni serie, rispetto
  alla stessa serie dell'ultima volta, e a ogni sessione nelle statistiche. Chili e
  ripetizioni contano insieme, nel massimale stimato: 9 × 60 batte 10 × 57,5.
- **Più utenti:** ognuno vede solo i suoi dati. Ci si registra dalla pagina di
  accesso (si chiude con `ALLOW_SIGNUP=false`), e gli utenti si creano anche da
  riga di comando.

## Struttura

```
backend/            API Node 22 + TypeScript (tsx), Postgres con Drizzle
  src/
    lib/            ORM e migrazioni: connessione, schema Drizzle, migrations/
    repositories/   solo SQL, uno per contesto, sempre filtrato per utente, mai transazioni
    services/       la logica di un contesto (esercizi, schede, allenamenti, statistiche, accesso),
                    sopra i suoi repository; accanto, le regole senza database (*.rules.ts)
    managers/       quello che unisce più service; ogni metodo è una transazione sola
    errors/         gli errori del dominio (non trovato), che il server traduce in risposte
    validators/     controllo di ciò che arriva dall'app
    controllers/    le rotte HTTP, una cartella per risorsa
    http/           server, router, cookie, errori
    bootstrap/      collega tutto
    config/         impostazioni dall'ambiente
    cli/            creazione utenti e cambio password
frontend/           PWA Svelte 5 + Vite, con il design system di restaurant-index
docker/             Dockerfile dell'API e di nginx (che compila anche l'app Svelte)
scripts/deploy-pi.sh
docs/API.md         il contratto tra frontend e backend
```

Ogni cartella ha il suo `index.ts`, e gli import tra cartelle passano da lì.

## Provarlo in locale

```bash
pnpm install
docker run -d --name gymlog-pg -p 5432:5432 -e POSTGRES_PASSWORD=prova postgres:17-alpine
# in backend/.env:
#   DATABASE_URL=postgres://postgres:prova@localhost:5432/postgres
#   INSECURE_COOKIE=1
pnpm --filter @gymlog/backend user:create mario     # chiede la password (almeno 10 caratteri)
pnpm --filter @gymlog/backend dev                   # API su http://127.0.0.1:3000, migra il database da sola
pnpm --filter frontend start                        # app su http://localhost:4200, /api passato all'API
```

## Test

```bash
pnpm --filter @gymlog/backend test
```

I test del database (`*.db.test.ts`) girano solo con `E2E_DATABASE_URL`: ognuno crea un
database usa-e-getta e lo cancella alla fine.

```bash
docker run -d --name gymlog-pgtest -p 127.0.0.1:55432:5432 -e POSTGRES_PASSWORD=test postgres:17-alpine
E2E_DATABASE_URL=postgres://postgres:test@127.0.0.1:55432 pnpm --filter @gymlog/backend test
```

### Stryker (i test mordono?)

Stryker cambia il codice di proposito e controlla che almeno un test se ne accorga.
L'ambito è salvato nella configurazione, quindi basta lanciarlo:

```bash
E2E_DATABASE_URL=postgres://postgres:test@127.0.0.1:55432 pnpm --filter @gymlog/backend mutate
pnpm --filter frontend mutate
```

- **backend** (`backend/stryker.config.json`): tutto `src/` tranne i test, `lib/`
  (connessione e migrazioni), `main.ts` e `cli/`, che sono avvii provati a mano.
  Si ferma con errore sotto il 100%.
- **frontend**: due giri. `stryker.config.json` su `src/lib`, `stryker.ui.config.json` sulla
  logica dei componenti (non sui testi delle schermate, che controllano i test delle
  schermate e l'e2e).

Ogni mutante sopravvissuto è un test che manca o del codice da togliere. Uno davvero
equivalente si segna con `// Stryker disable next-line <Mutator>: motivo`.

Lo schema si cambia in `backend/src/lib/database/schema/`, poi
`pnpm --filter @gymlog/backend db:generate` scrive la migrazione SQL. L'API applica le
migrazioni mancanti a ogni avvio.

## App Android

`android/` è un'app minima: una WebView a tutto schermo su `https://gymlog.scanferlamatteo.work`
(i link ad altri siti si aprono nel browser, il tasto indietro torna indietro nell'app).
Non contiene l'app web: si aggiorna da sola a ogni rilascio, l'APK va rifatto solo se cambia
la WebView stessa.

```bash
cd android
./gradlew assembleRelease     # app/build/outputs/apk/release/app-release.apk
```

Serve l'SDK Android (`local.properties`, `sdk.dir=...`) e la chiave di firma `gymlog-release.jks`
con `keystore.properties`: stanno solo sul PC che l'ha creata, fuori da git. Va tenuta: un
aggiornamento firmato con un'altra chiave non si installa sopra quello vecchio.

## Metterlo sul Raspberry Pi

1. `pnpm deploy:pi` (host `rpi` da `~/.ssh/config`). La prima volta crea `~/gymlog/.env`
   da `.env.example` e si ferma: imposta `POSTGRES_PASSWORD` e `JWT_SECRET`
   (`openssl rand -hex 24` e `openssl rand -hex 32`), poi rilancia `pnpm deploy:pi`.
2. Registrati dalla pagina di accesso, oppure crea l'utente da riga di comando:
   `ssh rpi` → `cd gymlog && docker compose exec -it api node_modules/.bin/tsx src/cli/users.ts create <nome>`
3. Nel Cloudflare Tunnel aggiungi un hostname pubblico (es. `gym.tuodominio.it`) verso
   `http://localhost:8091`.
4. Dal telefono apri l'indirizzo e scegli "Aggiungi a schermata Home".

Ogni deploy spedisce solo il codice committato (`git archive`), fa prima un dump del
database in `~/gymlog-backups` (ne tiene 10) e tagga le immagini in uso come `:prev`
per tornare indietro. L'app Svelte si compila sul Pi, dentro Docker, in pochi secondi.
