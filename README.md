# gymlog

Le schede della palestra, gli allenamenti e i pesi fatti, serie per serie: con le
medie, i massimi e il massimale stimato di ogni esercizio, sessione per sessione.
Una PWA da usare dal telefono in palestra, installabile sulla schermata Home.

```
 telefono (PWA) ── HTTPS ── Cloudflare Tunnel ── nginx (gymlog-web) ─┬─ /      app Svelte
                                                                     └─ /api/  API Node (gymlog-api) ── Postgres
```

Tutto gira con docker compose su un Raspberry Pi, senza porte aperte: nginx ascolta
solo su `127.0.0.1:8091` e il tunnel lo pubblica in HTTPS (necessario per una PWA).

## Cosa fa

- **Esercizi:** i tuoi, con gruppo muscolare e note.
- **Schede:** con più giorni (A, B, C…), ogni giorno con gli esercizi in ordine, serie,
  ripetizioni ("8", "8-10", "max"), recupero e note.
- **Allenamenti:** parti da un giorno della scheda o da un allenamento libero. Per ogni
  esercizio vedi cosa chiede la scheda e cosa hai fatto l'ultima volta; registri ogni
  serie (ripetizioni × kg). I nomi della scheda e del giorno restano nello storico
  anche se poi cambi o cancelli la scheda.
- **Statistiche:** per ogni esercizio e per ogni sessione: serie, ripetizioni, volume
  (ripetizioni × kg), peso medio delle serie, peso massimo e massimale stimato
  (formula di Epley). In più, una panoramica: allenamenti totali e degli ultimi 30
  giorni, volume degli ultimi 30 giorni, media e massimo di ogni esercizio.
- **Più utenti:** ognuno vede solo i suoi dati. Gli utenti si creano da riga di
  comando: non c'è registrazione.

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

`pnpm --filter @gymlog/backend mutate <file>` lancia Stryker su un file: ogni mutante
sopravvissuto è un test che manca o del codice da togliere.

Lo schema si cambia in `backend/src/lib/database/schema/`, poi
`pnpm --filter @gymlog/backend db:generate` scrive la migrazione SQL. L'API applica le
migrazioni mancanti a ogni avvio.

## Metterlo sul Raspberry Pi

1. `pnpm deploy:pi` (host `rpi` da `~/.ssh/config`). La prima volta crea `~/gymlog/.env`
   da `.env.example` e si ferma: imposta `POSTGRES_PASSWORD` e `JWT_SECRET`
   (`openssl rand -hex 24` e `openssl rand -hex 32`), poi rilancia `pnpm deploy:pi`.
2. Crea il tuo utente:
   `ssh rpi` → `cd gymlog && docker compose exec -it api node_modules/.bin/tsx src/cli/users.ts create <nome>`
3. Nel Cloudflare Tunnel aggiungi un hostname pubblico (es. `gym.tuodominio.it`) verso
   `http://localhost:8091`.
4. Dal telefono apri l'indirizzo e scegli "Aggiungi a schermata Home".

Ogni deploy spedisce solo il codice committato (`git archive`), fa prima un dump del
database in `~/gymlog-backups` (ne tiene 10) e tagga le immagini in uso come `:prev`
per tornare indietro. L'app Svelte si compila sul Pi, dentro Docker, in pochi secondi.
