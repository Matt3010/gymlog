import type { Server } from "node:http";
import {
  authController, exercisesController, healthController, plansController, statsController, workoutsController,
} from "../controllers";
import { createHttpServer } from "../http";
import type { Database } from "../lib";
import { createPlansManager, createStatsManager, createWorkoutsManager } from "../managers";
import {
  createAuthService, createExercisesService, createLoginLimiter, createPlansService, createStatsService, createTokenManager,
  createWorkoutsService, type LoginLimiter,
} from "../services";

export interface ApiOptions {
  readonly db: Database;
  readonly jwtSecret: Uint8Array;
  /** False only for trying the app over plain http on a laptop. */
  readonly secureCookie: boolean;
  /** Anyone can make an account from the login page; true unless set. */
  readonly allowSignup?: boolean;
  readonly limiter?: LoginLimiter;
  readonly now?: () => Date;
  readonly logError?: (line: string, error: unknown) => void;
  readonly log?: (line: string) => void;
}

/** Where every dependency is chosen, once: services, managers, controllers. The server is not yet listening. */
export function createApiServer({
  db, jwtSecret, secureCookie, allowSignup = true, limiter = createLoginLimiter(), now = () => new Date(), logError = console.error, log = console.log,
}: ApiOptions): Server {
  const auth = createAuthService(db, createTokenManager(jwtSecret));

  const routes = [
    ...healthController(db),
    ...authController({ auth, limiter, secureCookie, allowSignup, log }),
    ...exercisesController(createExercisesService(db)),
    ...plansController(createPlansService(db), createPlansManager(db)),
    ...workoutsController(createWorkoutsService(db), createWorkoutsManager(db)),
    ...statsController(createStatsService(db, now), createStatsManager(db)),
  ];
  return createHttpServer({ routes, verifyAccess: (token) => auth.verifyAccess(token), logError });
}
