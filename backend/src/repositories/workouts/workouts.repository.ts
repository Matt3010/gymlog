import { and, asc, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { type Executor, exercises, users, workoutExerciseNotes, workoutSets, workouts } from "../../lib";

export interface Workout {
  readonly id: number;
  readonly planDayId: number | null;
  readonly planName: string | null;
  readonly dayName: string | null;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly notes: string | null;
}

export interface WorkoutSummary extends Workout {
  /** How many different exercises have sets. */
  readonly exercises: number;
  readonly sets: number;
  readonly volume: number;
}

export interface SetInput {
  readonly exerciseId: number;
  readonly reps: number;
  readonly weightKg: number;
}

export interface WorkoutSet extends SetInput {
  readonly id: number;
  readonly exerciseName: string;
  readonly createdAt: string;
}

/** The note of an earlier workout, with when it was. */
export interface PreviousNote {
  readonly workoutId: number;
  readonly startedAt: string;
  readonly note: string;
}

export interface PreviousSets {
  readonly workoutId: number;
  readonly startedAt: string;
  readonly sets: { readonly reps: number; readonly weightKg: number }[];
  /** What was written about the exercise that time. */
  readonly note: string | null;
  /** The sets of the time before that, to say whether the last time went better. */
  readonly before: { readonly reps: number; readonly weightKg: number }[];
}

/** The plan day a workout follows, names copied so the history keeps them. */
export interface WorkoutStart {
  readonly planDayId: number;
  readonly planName: string;
  readonly dayName: string;
}

export interface WorkoutChange {
  readonly notes?: string | null;
  /** True sets the end now (unless already set); false takes it back. */
  readonly finished?: boolean;
}

/**
 * Workouts and their sets. Calls taking a user are scoped to them; `sets` and
 * `addSet` take a workout the caller has already found as the user's, and an
 * exercise checked as theirs.
 */
export interface WorkoutsRepository {
  /** The most recent first. */
  list(userId: number, limit: number, offset: number): Promise<WorkoutSummary[]>;
  find(userId: number, id: number): Promise<Workout | undefined>;
  create(userId: number, start: WorkoutStart | null, startedAt?: Date): Promise<Workout>;
  update(userId: number, id: number, change: WorkoutChange): Promise<Workout | undefined>;
  delete(userId: number, id: number): Promise<boolean>;
  /**
   * Holds the user still until the caller's transaction ends: two starts that
   * arrive together go one after the other, and the second sees the first.
   */
  lockUser(userId: number): Promise<void>;
  /** The id of the user's workout in progress, other than `except`, if any. */
  openOther(userId: number, except?: number): Promise<number | undefined>;

  /** In the order they were logged. */
  sets(workoutId: number): Promise<WorkoutSet[]>;
  /** For each exercise done before this workout started, the sets of the last workout with it. */
  previous(userId: number, workoutId: number): Promise<Map<number, PreviousSets>>;
  addSet(workoutId: number, input: SetInput): Promise<WorkoutSet>;
  /** One note per exercise in a workout; null takes it away. */
  setExerciseNote(workoutId: number, exerciseId: number, note: string | null): Promise<void>;
  /** By exercise id. */
  exerciseNotes(workoutId: number): Promise<Map<number, string>>;
  /**
   * The note of the last earlier workout of the same plan day, matched by the
   * names copied at start (a free workout matches free workouts), or null.
   */
  previousNote(userId: number, workoutId: number): Promise<PreviousNote | null>;
  updateSet(userId: number, setId: number, change: { reps: number; weightKg: number }): Promise<WorkoutSet | undefined>;
  deleteSet(userId: number, setId: number): Promise<boolean>;
}

const columns = {
  id: workouts.id,
  planDayId: workouts.planDayId,
  planName: workouts.planName,
  dayName: workouts.dayName,
  startedAt: workouts.startedAt,
  finishedAt: workouts.finishedAt,
  notes: workouts.notes,
};

type Row = Omit<Workout, "startedAt" | "finishedAt"> & { startedAt: Date; finishedAt: Date | null };

function toWorkout(row: Row): Workout {
  return { ...row, startedAt: row.startedAt.toISOString(), finishedAt: row.finishedAt?.toISOString() ?? null };
}

const setColumns = {
  id: workoutSets.id,
  exerciseId: workoutSets.exerciseId,
  exerciseName: exercises.name,
  reps: workoutSets.reps,
  weightKg: workoutSets.weightKg,
  createdAt: workoutSets.createdAt,
};

export function createWorkoutsRepository(db: Executor): WorkoutsRepository {
  const mine = (userId: number, id: number) => and(eq(workouts.userId, userId), eq(workouts.id, id));
  /** A set whose workout is the user's. */
  const mySet = (userId: number, setId: number) =>
    and(eq(workoutSets.id, setId), sql`${workoutSets.workoutId} in (select id from workouts where user_id = ${userId})`);

  async function findSet(id: number): Promise<WorkoutSet> {
    const [row] = await db.select(setColumns).from(workoutSets).innerJoin(exercises, eq(exercises.id, workoutSets.exerciseId)).where(eq(workoutSets.id, id));
    return { ...row!, createdAt: row!.createdAt.toISOString() };
  }

  return {
    async list(userId, limit, offset) {
      const rows = await db
        .select({
          ...columns,
          exercises: sql<number>`count(distinct ${workoutSets.exerciseId})::int`,
          sets: sql<number>`count(${workoutSets.id})::int`,
          volume: sql<number>`coalesce(sum(${workoutSets.reps} * ${workoutSets.weightKg}), 0)::float8`,
        })
        .from(workouts)
        .leftJoin(workoutSets, eq(workoutSets.workoutId, workouts.id))
        .where(eq(workouts.userId, userId))
        .groupBy(workouts.id)
        .orderBy(desc(workouts.startedAt), desc(workouts.id))
        .limit(limit)
        .offset(offset);
      return rows.map(({ exercises: count, sets, volume, ...row }) => ({ ...toWorkout(row), exercises: count, sets, volume }));
    },

    async find(userId, id) {
      const [row] = await db.select(columns).from(workouts).where(mine(userId, id));
      return row === undefined ? undefined : toWorkout(row);
    },

    async create(userId, start, startedAt) {
      const [row] = await db
        .insert(workouts)
        // No start given: the column's default, now.
        .values({ userId, ...start, ...(startedAt && { startedAt }) })
        .returning(columns);
      return toWorkout(row!);
    },

    async update(userId, id, change) {
      const set = {
        ...(change.notes === undefined ? {} : { notes: change.notes }),
        ...(change.finished === undefined ? {} : { finishedAt: change.finished ? sql`coalesce(${workouts.finishedAt}, now())` : null }),
      };
      if (Object.keys(set).length === 0) return this.find(userId, id);
      const [row] = await db.update(workouts).set(set).where(mine(userId, id)).returning(columns);
      return row === undefined ? undefined : toWorkout(row);
    },

    async lockUser(userId) {
      await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
    },

    async openOther(userId, except) {
      const [row] = await db.select({ id: workouts.id }).from(workouts)
        .where(and(eq(workouts.userId, userId), isNull(workouts.finishedAt), except === undefined ? undefined : ne(workouts.id, except)))
        .limit(1);
      return row?.id;
    },

    async delete(userId, id) {
      const deleted = await db.delete(workouts).where(mine(userId, id)).returning({ id: workouts.id });
      return deleted.length > 0;
    },

    async sets(workoutId) {
      const rows = await db
        .select(setColumns)
        .from(workoutSets)
        .innerJoin(exercises, eq(exercises.id, workoutSets.exerciseId))
        .where(eq(workoutSets.workoutId, workoutId))
        .orderBy(asc(workoutSets.id));
      return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
    },

    async previous(userId, workoutId) {
      // Raw rows: Drizzle leaves timestamps as Postgres writes them ("2026-09-03 17:00:00+00").
      const { rows } = await db.execute<{ exercise_id: number; workout_id: number; started_at: string; rank: number; reps: number; weight_kg: number; note: string | null }>(sql`
        with done as (
          select s.exercise_id, w.id as workout_id, w.started_at,
                 row_number() over (partition by s.exercise_id order by w.id desc) as rank
          from workout_sets s
          join workouts w on w.id = s.workout_id
          -- "Before" is the order they were started in, not the clock: without a clock of its own
          -- the Pi can boot behind, and a later workout would carry an earlier time.
          where w.user_id = ${userId}
            and w.id < (select id from workouts where id = ${workoutId} and user_id = ${userId})
          group by s.exercise_id, w.id, w.started_at
        )
        select d.exercise_id, d.workout_id, d.started_at, d.rank::int as rank, s.reps, s.weight_kg, n.note
        from done d
        join workout_sets s on s.workout_id = d.workout_id and s.exercise_id = d.exercise_id
        left join workout_exercise_notes n on n.workout_id = d.workout_id and n.exercise_id = d.exercise_id
        where d.rank <= 2
        order by d.rank, s.id`);
      // The last time first (rank 1), then the time before it (rank 2) goes under it.
      const previous = new Map<number, PreviousSets>();
      for (const row of rows) {
        const set = { reps: row.reps, weightKg: row.weight_kg };
        const entry = previous.get(row.exercise_id);
        if (row.rank === 2) entry?.before.push(set);
        else if (entry) entry.sets.push(set);
        else previous.set(row.exercise_id, { workoutId: row.workout_id, startedAt: new Date(row.started_at).toISOString(), sets: [set], note: row.note, before: [] });
      }
      return previous;
    },

    async setExerciseNote(workoutId, exerciseId, note) {
      if (note === null) {
        await db.delete(workoutExerciseNotes)
          .where(and(eq(workoutExerciseNotes.workoutId, workoutId), eq(workoutExerciseNotes.exerciseId, exerciseId)));
        return;
      }
      await db.insert(workoutExerciseNotes).values({ workoutId, exerciseId, note })
        .onConflictDoUpdate({ target: [workoutExerciseNotes.workoutId, workoutExerciseNotes.exerciseId], set: { note } });
    },

    async exerciseNotes(workoutId) {
      const rows = await db.select({ exerciseId: workoutExerciseNotes.exerciseId, note: workoutExerciseNotes.note })
        .from(workoutExerciseNotes).where(eq(workoutExerciseNotes.workoutId, workoutId));
      return new Map(rows.map((row) => [row.exerciseId, row.note]));
    },

    async previousNote(userId, workoutId) {
      const { rows } = await db.execute<{ id: number; started_at: string; notes: string }>(sql`
        select w.id, w.started_at, w.notes
        from workouts w
        join workouts c on c.id = ${workoutId} and c.user_id = ${userId}
        where w.user_id = ${userId}
          and w.id < c.id
          and w.notes is not null
          and w.plan_name is not distinct from c.plan_name
          and w.day_name is not distinct from c.day_name
        order by w.id desc
        limit 1`);
      const row = rows[0];
      return row === undefined ? null : { workoutId: row.id, startedAt: new Date(row.started_at).toISOString(), note: row.notes };
    },

    async addSet(workoutId, input) {
      const [row] = await db.insert(workoutSets).values({ workoutId, ...input }).returning({ id: workoutSets.id });
      return findSet(row!.id);
    },

    async updateSet(userId, setId, change) {
      const [row] = await db.update(workoutSets).set(change).where(mySet(userId, setId)).returning({ id: workoutSets.id });
      return row === undefined ? undefined : findSet(row.id);
    },

    async deleteSet(userId, setId) {
      const deleted = await db.delete(workoutSets).where(mySet(userId, setId)).returning({ id: workoutSets.id });
      return deleted.length > 0;
    },
  };
}
