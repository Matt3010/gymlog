# API gymlog

Tutto sotto `/api`, JSON. nginx serve il frontend e passa `/api` al backend.

- **Errori:** `{ "error": "messaggio in italiano" }` con lo status (400 input, 401 non loggato,
  403 vietato, 404 non trovato, 409 conflitto, 429 troppi tentativi).
- **Auth:** cookie HttpOnly `gymlog_at` (JWT 15 min, Path `/api`) e `gymlog_rt`
  (sessione 30 giorni, Path `/api/auth`: resta la stessa e si allunga di 30 giorni a ogni rinnovo;
  il logout la chiude, una password nuova le chiude tutte). Con un 401, il frontend
  chiama `POST /api/auth/refresh` una volta e riprova; se fallisce, va al login.
- **CSRF:** ogni richiesta non-GET deve avere l'header `x-gymlog: 1`.
- **Date:** stringhe ISO 8601. **Pesi:** kg, numeri con al più 2 decimali.
- Ogni utente vede solo i propri dati: un id di un altro utente risponde 404.

## Tipi

```ts
interface User { id: number; username: string }

// bodyweight: a corpo libero (trazioni): le serie contano le ripetizioni, i chili solo come zavorra
interface Exercise { id: number; name: string; muscleGroup: string | null; notes: string | null; bodyweight: boolean }
interface ExerciseInput { name: string; muscleGroup: string | null; notes: string | null; bodyweight?: boolean }   // non detto è false

interface PlanExercise {
  id: number; exerciseId: number; exerciseName: string; position: number;
  reps: string[];            // una voce per serie (1..20), testo libero: ["12", "10", "8-10", "max"]
  restSeconds: number | null;
  notes: string | null;
}
// Una scheda è un allenamento: i suoi esercizi in ordine.
interface Plan { id: number; name: string; notes: string | null; exercises: PlanExercise[] }
// Una scheda si salva tutta insieme: gli esercizi vengono sostituiti.
interface PlanInput {
  name: string; notes: string | null;
  exercises: { exerciseId: number; reps: string[]; restSeconds: number | null; notes: string | null }[];
}

interface Workout {
  id: number; planId: number | null; planName: string | null;   // il nome della scheda, copiato all'inizio
  startedAt: string; finishedAt: string | null; notes: string | null;
}
interface WorkoutSummary extends Workout { exercises: number; sets: number; volume: number }   // sets: le serie, i pezzi contano con la loro
// Una serie: reps null solo se toFailure (MAX, a cedimento, senza contarle); weightKg null è senza peso;
// note è una parola sulla serie sola ("SX", "con riposo"), fino a 100 caratteri.
interface SetInput { reps: number | null; weightKg: number | null; toFailure?: boolean; note?: string | null }
// continues: un pezzo della serie prima dello stesso esercizio (stripping, il braccio SX dopo): conta con lei come una serie
interface PastSet { reps: number | null; weightKg: number | null; toFailure: boolean; note: string | null; continues: boolean }
interface WorkoutSet extends PastSet { id: number; exerciseId: number; exerciseName: string; createdAt: string }
interface PreviousSets { workoutId: number; startedAt: string; sets: PastSet[]; note: string | null; before: PastSet[] }
interface WorkoutDetail extends Workout {
  plan: PlanExercise[];                        // gli esercizi della scheda ([] se libero, o se la scheda non c'è più)
  sets: WorkoutSet[];                          // in ordine di inserimento
  previous: Record<string, PreviousSets>;      // per exerciseId: l'ultima sessione precedente con quell'esercizio, con la sua nota; in before le serie della volta prima ancora ([] se non c'è)
  exerciseNotes: Record<string, string>;       // per exerciseId: la nota scritta su quell'esercizio in questo allenamento
  previousNote: { workoutId: number; startedAt: string; note: string } | null;
                                               // la nota generale dell'ultimo allenamento della stessa scheda
                                               // (per nome di scheda; un allenamento libero guarda quelli liberi)
  bodyweight: number[];                        // gli id degli esercizi dell'utente a corpo libero
}

// Statistiche di un gruppo di serie (una sessione, o tutte). Ogni numero conta le serie che lo dicono:
// i pesi quelle con il peso, le ripetizioni quelle con le ripetizioni, volume e 1RM quelle con tutti e due.
interface SetStats {
  sets: number; reps: number;
  maxReps: number;           // le ripetizioni della serie migliore: quello che conta a corpo libero
  volume: number;            // somma di reps × kg
  avgWeight: number;         // media dei kg delle serie
  maxWeight: number;
  bestE1rm: number;          // massimale stimato (Epley: kg × (1 + reps/30); con 1 rep, i kg)
}
interface ExerciseSession extends SetStats { workoutId: number; startedAt: string }
interface ExerciseStats {
  exercise: Exercise;
  overall: SetStats & { sessions: number };
  sessions: ExerciseSession[];                 // dalla più recente
}
// Un esercizio a colpo d'occhio, per l'elenco degli esercizi (solo quelli con almeno una serie)
interface ExerciseSummary { exerciseId: number; name: string; sessions: number; avgWeight: number; maxWeight: number; maxReps: number; lastAt: string }
```

## Endpoint

| Metodo | Percorso | Corpo | Risposta |
|---|---|---|---|
| POST | /api/auth/login | `{ username, password }` | `{ user }` + cookie |
| POST | /api/auth/refresh | – | `{ user }` + cookie, con un token di rinnovo nuovo ogni volta. Quello vecchio vale ancora 60 s; ripresentato dopo, chiude tutto quel login (qualcuno ne ha una copia) |
| POST | /api/auth/logout | – | `{ ok: true }` |
| GET | /api/auth/me | – | `{ user }`, con `isAdmin` e `createdAt` |
| POST | /api/auth/password | `{ current, next }` | `{ ok: true }` + cookie nuovi; chiude le altre sessioni. 400 se `current` è sbagliata, 429 dopo troppi tentativi |
| GET | /api/auth/signup | – | `{ open: boolean }` (se ci si può registrare) |
| POST | /api/auth/register | `{ username, password }` | `{ user }` + cookie, già dentro (403 se chiuse, 429 se troppe) |
| GET | /api/health | – | `{ ok: true }` |
| GET | /api/exercises | – | `Exercise[]` (per nome) |
| POST | /api/exercises | `ExerciseInput` | `Exercise` |
| PATCH | /api/exercises/:id | `ExerciseInput` | `Exercise` |
| DELETE | /api/exercises/:id | – | `{ ok: true }` (409 se usato in schede o allenamenti) |
| GET | /api/plans | – | `Plan[]` (per nome) |
| GET | /api/plans/:id | – | `Plan` |
| POST | /api/plans | `PlanInput` | `Plan` |
| PUT | /api/plans/:id | `PlanInput` | `Plan` (gli allenamenti fatti con questa scheda prendono il nome nuovo) |
| DELETE | /api/plans/:id | – | `{ ok: true }` (gli allenamenti restano, senza scheda) |
| GET | /api/workouts?limit=&offset= | – | `WorkoutSummary[]` (dal più recente) |
| POST | /api/workouts | `{ planId: number \| null }` | `WorkoutDetail`; 409 se ce n'è già uno in corso (uno alla volta) |
| GET | /api/workouts/:id | – | `WorkoutDetail` |
| PATCH | /api/workouts/:id | `{ notes?: string \| null, finished?: boolean }` | `WorkoutDetail`; `finished: false` dà 409 se un altro è in corso |
| DELETE | /api/workouts/:id | – | `{ ok: true }` |
| POST | /api/workouts/:id/sets | `SetInput & { exerciseId, continues?, key? }` (`continues` vuole una serie dello stesso esercizio già segnata, se no 400. `key`, fino a 64 caratteri: la stessa due volte nello stesso allenamento dà la serie già segnata, non una nuova; con altri numeri 409. Al più 200 serie per allenamento) | `WorkoutSet` |
| PUT | /api/workouts/:id/exercises/:exerciseId/note | `{ note: string \| null }` (vuota o null la toglie, fino a 1000 caratteri) | `{ exerciseId, note }` |
| PATCH | /api/sets/:id | `SetInput` (la serie intera: quello che manca torna vuoto) | `WorkoutSet` |
| DELETE | /api/sets/:id | – | `{ ok: true }` |
| GET | /api/stats/exercises | – | `ExerciseSummary[]` (dal più recente) |
| GET | /api/stats/exercises/:id | – | `ExerciseStats` |
| GET | /api/admin/usage | – | `{ users: UserUsage[] }`: per ogni utente conti e date (allenamenti, serie, esercizi, schede, ultimo accesso). 403 a chi non è admin |

Utenti: nome di 3–30 caratteri fra lettere, numeri, `.` `_` `-`, salvato e cercato in minuscolo;
password di almeno 10 caratteri.

Limiti: nomi 1–100 caratteri, note fino a 1000, `reps` di una serie 1–100 (intero),
`weightKg` 0–1000, serie previste 1–20 (ognuna 1–20 caratteri), `restSeconds` 0–3600, al più 30 esercizi
per scheda.
