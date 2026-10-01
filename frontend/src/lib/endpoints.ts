import { api } from './client';
import type {
  Exercise, ExerciseInput, ExerciseStats, Overview, Plan, PlanInput, WorkoutDetail, WorkoutSet, WorkoutSummary,
} from './types';

/* Ogni chiamata dell'API, con i suoi tipi: le pagine chiamano queste, non indirizzi scritti a mano. */

export const exercisesApi = {
  list: () => api.get<Exercise[]>('/exercises'),
  create: (input: ExerciseInput) => api.post<Exercise>('/exercises', input),
  update: (id: number, input: ExerciseInput) => api.patch<Exercise>(`/exercises/${id}`, input),
  remove: (id: number) => api.delete<{ ok: true }>(`/exercises/${id}`),
};

export const plansApi = {
  list: () => api.get<Plan[]>('/plans'),
  get: (id: number) => api.get<Plan>(`/plans/${id}`),
  create: (input: PlanInput) => api.post<Plan>('/plans', input),
  save: (id: number, input: PlanInput) => api.put<Plan>(`/plans/${id}`, input),
  remove: (id: number) => api.delete<{ ok: true }>(`/plans/${id}`),
};

export const workoutsApi = {
  list: (limit: number, offset = 0) => api.get<WorkoutSummary[]>(`/workouts?limit=${limit}&offset=${offset}`),
  start: (planDayId: number | null) => api.post<WorkoutDetail>('/workouts', { planDayId }),
  get: (id: number) => api.get<WorkoutDetail>(`/workouts/${id}`),
  update: (id: number, change: { notes?: string | null; finished?: boolean }) => api.patch<WorkoutDetail>(`/workouts/${id}`, change),
  remove: (id: number) => api.delete<{ ok: true }>(`/workouts/${id}`),
  addSet: (workoutId: number, set: { exerciseId: number; reps: number; weightKg: number }) =>
    api.post<WorkoutSet>(`/workouts/${workoutId}/sets`, set),
  updateSet: (id: number, set: { reps: number; weightKg: number }) => api.patch<WorkoutSet>(`/sets/${id}`, set),
  removeSet: (id: number) => api.delete<{ ok: true }>(`/sets/${id}`),
};

export const statsApi = {
  overview: () => api.get<Overview>('/stats/overview'),
  exercise: (id: number) => api.get<ExerciseStats>(`/stats/exercises/${id}`),
};
