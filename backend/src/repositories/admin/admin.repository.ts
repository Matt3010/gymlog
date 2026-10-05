import { eq, sql } from "drizzle-orm";
import { type Executor, users } from "../../lib";

/** How one user uses the app: what they have, what they did, when they were last there. */
export interface UserUsage {
  readonly id: number;
  readonly username: string;
  readonly isAdmin: boolean;
  readonly createdAt: string;
  readonly lastWorkoutAt: string | null;
  /** The last time a session of theirs was renewed: about the last time they opened the app. */
  readonly lastSeenAt: string | null;
  readonly workouts: number;
  readonly workoutsLast30Days: number;
  readonly sets: number;
  readonly exercises: number;
  readonly plans: number;
}

/** Across users, for whoever runs the app: never anyone's training itself, only counts and dates. */
export interface AdminRepository {
  isAdmin(userId: number): Promise<boolean>;
  /** False when there is no such user. */
  setAdmin(username: string, admin: boolean): Promise<boolean>;
  /** Every user, the latest active first, those never active at the end. */
  usage(): Promise<UserUsage[]>;
}

export function createAdminRepository(db: Executor, refreshDays = 30): AdminRepository {
  return {
    async isAdmin(userId) {
      const [row] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userId));
      return row?.isAdmin ?? false;
    },

    async setAdmin(username, admin) {
      const changed = await db.update(users).set({ isAdmin: admin }).where(eq(users.username, username)).returning({ id: users.id });
      return changed.length > 0;
    },

    async usage() {
      // timestamps as ISO text, like everywhere else in the API
      const iso = (column: string) => sql.raw(`to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`);
      const { rows } = await db.execute<Record<string, unknown>>(sql`
        select u.id, u.username, u.is_admin as "isAdmin",
          ${iso("u.created_at")} as "createdAt",
          ${iso("w.last_workout")} as "lastWorkoutAt",
          ${iso("s.last_seen")} as "lastSeenAt",
          coalesce(w.total, 0)::int as workouts,
          coalesce(w.recent, 0)::int as "workoutsLast30Days",
          (select count(*) from workout_sets ws join workouts x on x.id = ws.workout_id where x.user_id = u.id)::int as sets,
          (select count(*) from exercises e where e.user_id = u.id)::int as exercises,
          (select count(*) from plans p where p.user_id = u.id)::int as plans
        from users u
        left join (
          select user_id, max(started_at) as last_workout, count(*) as total,
            count(*) filter (where started_at > now() - interval '30 days') as recent
          from workouts group by user_id
        ) w on w.user_id = u.id
        left join (
          select user_id, max(expires_at) - make_interval(days => ${refreshDays}) as last_seen from sessions group by user_id
        ) s on s.user_id = u.id
        order by greatest(w.last_workout, s.last_seen) desc nulls last, u.id`);
      return rows as unknown as UserUsage[];
    },
  };
}
