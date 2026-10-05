import { ForbiddenError } from "../../errors";
import type { Executor } from "../../lib";
import { createAdminRepository, type UserUsage } from "../../repositories";
import { REFRESH_DAYS } from "../auth";

/** What only an admin sees. Whether one is, the database says at every call: a flag taken away counts at once. */
export interface AdminService {
  isAdmin(userId: number): Promise<boolean>;
  setAdmin(username: string, admin: boolean): Promise<boolean>;
  usage(userId: number): Promise<{ users: UserUsage[] }>;
}

export function createAdminService(db: Executor): AdminService {
  const admin = createAdminRepository(db, REFRESH_DAYS);
  return {
    isAdmin: (userId) => admin.isAdmin(userId),
    setAdmin: (username, flag) => admin.setAdmin(username.trim().toLowerCase(), flag),
    async usage(userId) {
      if (!(await admin.isAdmin(userId))) throw new ForbiddenError("Solo per chi amministra l’app.");
      return { users: await admin.usage() };
    },
  };
}
