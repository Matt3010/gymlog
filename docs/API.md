# API gymlog

Tutto sotto `/api`, JSON. nginx serve il frontend e passa `/api` al backend.

- **Errori:** `{ "error": "messaggio in italiano" }` con lo status (400 input, 401 non loggato,
  403 vietato, 404 non trovato, 409 conflitto, 429 troppi tentativi).
- **Auth:** cookie HttpOnly `gymlog_at` (JWT 15 min, Path `/api`) e `gymlog_rt`
  (refresh 30 giorni, Path `/api/auth`, cambia a ogni uso). Con un 401, il frontend
  chiama `POST /api/auth/refresh` una volta e riprova; se fallisce, va al login.
- **CSRF:** ogni richiesta non-GET deve avere l'header `x-gymlog: 1`.
- **Date:** stringhe ISO 8601. **Pesi:** kg, numeri con al più 2 decimali.
- Ogni utente vede solo i propri dati: un id di un altro utente risponde 404.

## Tipi

```ts
interface User { id: number; username: string }

interface Exercise { id: number; name: string; muscleGroup: string | null; notes: string | null }
interface ExerciseInput { name: string; muscleGroup: string | null; notes: string | null }

interface PlanExercise {
  id: number; exerciseId: number; exerciseName: string; position: number;
  reps: string[];            // una voce per serie (1..20), testo libero: ["12", "10", "8-10", "max"]
  restSeconds: number | null;
  notes: string | null;
}
interface PlanDay { id: number; name: string; position: number; exercises: PlanExercise[] }
interface Plan { id: number; name: string; notes: string | null; archived: boolean; days: PlanDay[] }
// Una scheda si salva tutta insieme: giorni ed esercizi vengono sostituiti.
interface PlanInput {
  name: string; notes: string | null; archived: boolean;
  days: { name: string; exercises: { exerciseId: number; reps: string[]; restSeconds: number | null; notes: string | null }[] }[];
}

interface Workout {
  id: number; planDayId: number | null; planName: string | null; dayName: string | null;
  startedAt: string; finishedAt: string | null; notes: string | null;
}
interface WorkoutSummary extends Workout { exercises: number; sets: number; volume: number }
interface WorkoutSet { id: number; exerciseId: number; exerciseName: string; reps: number; weightKg: number; createdAt: string }
interface PreviousSets { workoutId: number; startedAt: string; sets: { reps: number; weightKg: number }[]; note: string | null; before: { reps: number; weightKg: number }[] }
interface WorkoutDetail extends Workout {
  plan: PlanExercise[];                        // gli esercizi del giorno della scheda ([] se libero)
  sets: WorkoutSet[];                          // in ordine di inserimento
  previous: Record<string, PreviousSets>;      // per exerciseId: l'ultima sessione precedente con quell'esercizio, con la sua nota; in before le serie della volta prima ancora ([] se non c'è)
  exerciseNotes: Record<string, string>;       // per exerciseId: la nota scritta su quell'esercizio in questo allenamento
  previousNote: { workoutId: number; startedAt: string; note: string } | null;
                                               // la nota generale dell'ultimo allenamento dello stesso giorno della scheda
                                               // (per nome di scheda e giorno; un allenamento libero guarda quelli liberi)
}

// Statistiche di un gruppo di serie (una sessione, o tutte)
interface SetStats {
  sets: number; reps: number;
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
interface ExerciseSummary { exerciseId: number; name: string; sessions: number; avgWeight: number; maxWeight: number; lastAt: string }
```

## Endpoint

| Metodo | Percorso | Corpo | Risposta |
|---|---|---|---|
| POST | /api/auth/login | `{ username, password }` | `{ user }` + cookie |
| POST | /api/auth/refresh | – | `{ user }` + cookie |
| POST | /api/auth/logout | – | `{ ok: true }` |
| GET | /api/auth/me | – | `{ user }` |
| GET | /api/auth/signup | – | `{ open: boolean }` (se ci si può registrare) |
| POST | /api/auth/register | `{ username, password }` | `{ user }` + cookie, già dentro (403 se chiuse, 429 se troppe) |
| GET | /api/health | – | `{ ok: true }` |
| GET | /api/exercises | – | `Exercise[]` (per nome) |
| POST | /api/exercises | `ExerciseInput` | `Exercise` |
| PATCH | /api/exercises/:id | `ExerciseInput` | `Exercise` |
| DELETE | /api/exercises/:id | – | `{ ok: true }` (409 se usato in schede o allenamenti) |
| GET | /api/plans | – | `Plan[]` (attive prima, poi per nome) |
| GET | /api/plans/:id | – | `Plan` |
| POST | /api/plans | `PlanInput` | `Plan` |
| PUT | /api/plans/:id | `PlanInput` | `Plan` |
| DELETE | /api/plans/:id | – | `{ ok: true }` (gli allenamenti restano, senza scheda) |
| GET | /api/workouts?limit=&offset= | – | `WorkoutSummary[]` (dal più recente) |
| POST | /api/workouts | `{ planDayId: number \| null }` | `WorkoutDetail`; 409 se ce n'è già uno in corso (uno alla volta) |
| GET | /api/workouts/:id | – | `WorkoutDetail` |
| PATCH | /api/workouts/:id | `{ notes?: string \| null, finished?: boolean }` | `WorkoutDetail`; `finished: false` dà 409 se un altro è in corso |
| DELETE | /api/workouts/:id | – | `{ ok: true }` |
| POST | /api/workouts/:id/sets | `{ exerciseId, reps, weightKg }` | `WorkoutSet` |
| PUT | /api/workouts/:id/exercises/:exerciseId/note | `{ note: string \| null }` (vuota o null la toglie, fino a 1000 caratteri) | `{ exerciseId, note }` |
| PATCH | /api/sets/:id | `{ reps, weightKg }` | `WorkoutSet` |
| DELETE | /api/sets/:id | – | `{ ok: true }` |
| GET | /api/stats/exercises | – | `ExerciseSummary[]` (dal più recente) |
| GET | /api/stats/exercises/:id | – | `ExerciseStats` |

Utenti: nome di 3–30 caratteri fra lettere, numeri, `.` `_` `-`, salvato e cercato in minuscolo;
password di almeno 10 caratteri.

Limiti: nomi 1–100 caratteri, note fino a 1000, `reps` di una serie 1–100 (intero),
`weightKg` 0–1000, serie previste 1–20 (ognuna 1–20 caratteri), `restSeconds` 0–3600, al più 14 giorni per scheda
e 30 esercizi per giorno.
