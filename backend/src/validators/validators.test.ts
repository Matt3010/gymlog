import { describe, expect, it } from "vitest";
import {
  InputError, parseExercise, parseLogin, parsePlan, parseSet, parseSetChange, parseWorkoutChange, parseWorkoutStart,
} from "./index";

describe("a request body", () => {
  it.each([null, undefined, [], "text", 5])("is refused when it is %j", (value) => {
    expect(() => parseExercise(value)).toThrow(new InputError("Richiesta non valida."));
  });
});

describe("a login", () => {
  it("has a username and a password", () => {
    expect(parseLogin({ username: " anna ", password: " secret " })).toEqual({ username: "anna", password: " secret " });
  });

  it.each([
    [{ password: "x" }, "Utente: manca o è troppo lungo."],
    [{ username: "anna" }, "Password: manca."],
    [{ username: "anna", password: "" }, "Password: manca."],
    [{ username: "anna", password: "x".repeat(201) }, "Password: manca."],
  ])("is refused: %j", (body, message) => {
    expect(() => parseLogin(body)).toThrow(message);
  });

  it("takes a password of two hundred characters", () => {
    expect(parseLogin({ username: "anna", password: "x".repeat(200) }).password).toHaveLength(200);
  });

});

describe("an exercise", () => {
  it("has a name, and maybe a muscle group and notes", () => {
    expect(parseExercise({ name: " Squat ", muscleGroup: " Gambe ", notes: "  " })).toEqual({ name: "Squat", muscleGroup: "Gambe", notes: null });
    expect(parseExercise({ name: "Squat", muscleGroup: null, notes: null })).toEqual({ name: "Squat", muscleGroup: null, notes: null });
  });

  it("takes missing optional fields as nothing", () => {
    expect(parseExercise({ name: "Squat" })).toEqual({ name: "Squat", muscleGroup: null, notes: null });
  });

  it.each([
    [{}, "Nome: manca o è troppo lungo."],
    [{ name: "   " }, "Nome: manca o è troppo lungo."],
    [{ name: "x".repeat(101) }, "Nome: manca o è troppo lungo."],
    [{ name: 5 }, "Nome: manca o è troppo lungo."],
    [{ name: "Squat", muscleGroup: "x".repeat(101) }, "Gruppo muscolare: troppo lungo."],
    [{ name: "Squat", notes: "x".repeat(1001) }, "Note: troppo lungo."],
    [{ name: "Squat", notes: 5 }, "Note: troppo lungo."],
  ])("is refused: %j", (body, message) => {
    expect(() => parseExercise(body)).toThrow(message);
  });

  it("takes a hundred characters of name, a thousand of notes", () => {
    expect(parseExercise({ name: "x".repeat(100), notes: "y".repeat(1000) })).toMatchObject({ name: "x".repeat(100), notes: "y".repeat(1000) });
    // Counted without the spaces around.
    expect(parseExercise({ name: "Squat", notes: ` ${"y".repeat(1000)} ` }).notes).toBe("y".repeat(1000));
  });
});

describe("a plan", () => {
  const day = { name: "A", exercises: [{ exerciseId: 3, sets: 4, reps: " 8-10 ", restSeconds: 90, notes: null }] };
  const plan = { name: "Scheda", notes: null, archived: false, days: [day] };

  it("has a name, notes, whether archived, and days of exercises", () => {
    expect(parsePlan(plan)).toEqual({
      name: "Scheda", notes: null, archived: false,
      days: [{ name: "A", exercises: [{ exerciseId: 3, sets: 4, reps: "8-10", restSeconds: 90, notes: null }] }],
    });
  });

  it("takes a missing rest and notes as nothing, and a missing archived as active", () => {
    expect(parsePlan({ name: "Scheda", days: [{ name: "A", exercises: [{ exerciseId: 3, sets: 4, reps: "8" }] }] })).toEqual({
      name: "Scheda", notes: null, archived: false,
      days: [{ name: "A", exercises: [{ exerciseId: 3, sets: 4, reps: "8", restSeconds: null, notes: null }] }],
    });
  });

  it("keeps the notes of the plan and of each exercise, and a rest left empty", () => {
    const written = { ...plan, notes: "3 volte", days: [{ name: "A", exercises: [{ ...day.exercises[0], notes: "lento", restSeconds: null }] }] };
    expect(parsePlan(written)).toMatchObject({ notes: "3 volte", days: [{ exercises: [{ notes: "lento", restSeconds: null }] }] });
  });

  it("takes up to fourteen days of thirty exercises", () => {
    const full = { name: "A", exercises: Array.from({ length: 30 }, () => day.exercises[0]) };
    expect(parsePlan({ ...plan, days: Array.from({ length: 14 }, () => full) }).days).toHaveLength(14);
  });

  it.each([
    [{ ...plan, days: undefined }, "Giorni: elenco non valido."],
    [{ ...plan, days: Array.from({ length: 15 }, () => day) }, "Giorni: al più 14."],
    [{ ...plan, days: [{ name: "A", exercises: "x" }] }, "Esercizi: elenco non valido."],
    [{ ...plan, days: [{ name: "A", exercises: Array.from({ length: 31 }, () => day.exercises[0]) }] }, "Esercizi: al più 30 per giorno."],
    [{ ...plan, days: [5] }, "Richiesta non valida."],
    [{ ...plan, days: [{ exercises: [] }] }, "Nome: manca o è troppo lungo."],
    [{ ...plan, archived: "no" }, "Archiviata: valore non valido."],
    [{ ...plan, days: [{ name: "A", exercises: [{ ...day.exercises[0], exerciseId: 0 }] }] }, "Esercizio: numero tra 1 e 2147483647 (intero)."],
    [{ ...plan, days: [{ name: "A", exercises: [{ ...day.exercises[0], sets: 21 }] }] }, "Serie: numero tra 1 e 20 (intero)."],
    [{ ...plan, days: [{ name: "A", exercises: [{ ...day.exercises[0], sets: 2.5 }] }] }, "Serie: numero tra 1 e 20 (intero)."],
    [{ ...plan, days: [{ name: "A", exercises: [{ ...day.exercises[0], reps: "" }] }] }, "Ripetizioni: manca o è troppo lungo."],
    [{ ...plan, days: [{ name: "A", exercises: [{ ...day.exercises[0], reps: "x".repeat(21) }] }] }, "Ripetizioni: manca o è troppo lungo."],
    [{ ...plan, days: [{ name: "A", exercises: [{ ...day.exercises[0], restSeconds: 3601 }] }] }, "Recupero: numero tra 0 e 3600 (intero)."],
  ])("is refused: %#", (body, message) => {
    expect(() => parsePlan(body)).toThrow(message);
  });
});

describe("starting a workout", () => {
  it("names a plan day, or none", () => {
    expect(parseWorkoutStart({ planDayId: 4 })).toEqual({ planDayId: 4 });
    expect(parseWorkoutStart({ planDayId: null })).toEqual({ planDayId: null });
    expect(parseWorkoutStart({})).toEqual({ planDayId: null });
  });

  it("is refused with a day that is no id", () => {
    expect(() => parseWorkoutStart({ planDayId: "4" })).toThrow("Giorno: numero tra 1 e 2147483647 (intero).");
  });
});

describe("a change to a workout", () => {
  it("has only what is given", () => {
    expect(parseWorkoutChange({})).toEqual({});
    expect(parseWorkoutChange({ notes: " stanco ", finished: true })).toEqual({ notes: "stanco", finished: true });
    expect(parseWorkoutChange({ notes: null, finished: false })).toEqual({ notes: null, finished: false });
  });

  it("is refused with a wrong end", () => {
    expect(() => parseWorkoutChange({ finished: "yes" })).toThrow("Terminato: valore non valido.");
  });
});

describe("a set", () => {
  it("has an exercise, reps and kg", () => {
    expect(parseSet({ exerciseId: 2, reps: 8, weightKg: 62.5 })).toEqual({ exerciseId: 2, reps: 8, weightKg: 62.5 });
    expect(parseSet({ exerciseId: 2, reps: 100, weightKg: 0 })).toMatchObject({ reps: 100, weightKg: 0 });
    expect(parseSet({ exerciseId: 2, reps: 1, weightKg: 1000 })).toMatchObject({ reps: 1, weightKg: 1000 });
  });

  it("keeps two decimals of kg", () => {
    expect(parseSet({ exerciseId: 2, reps: 8, weightKg: 1.25 }).weightKg).toBe(1.25);
    expect(() => parseSet({ exerciseId: 2, reps: 8, weightKg: 1.255 })).toThrow("Peso: al più due decimali.");
  });

  it.each([
    [{ reps: 8, weightKg: 10 }, "Esercizio: numero tra 1 e 2147483647 (intero)."],
    [{ exerciseId: 2, reps: 0, weightKg: 10 }, "Ripetizioni: numero tra 1 e 100 (intero)."],
    [{ exerciseId: 2, reps: 101, weightKg: 10 }, "Ripetizioni: numero tra 1 e 100 (intero)."],
    [{ exerciseId: 2, reps: 8.5, weightKg: 10 }, "Ripetizioni: numero tra 1 e 100 (intero)."],
    [{ exerciseId: 2, reps: 8, weightKg: -1 }, "Peso: numero tra 0 e 1000."],
    [{ exerciseId: 2, reps: 8, weightKg: 1000.5 }, "Peso: numero tra 0 e 1000."],
    [{ exerciseId: 2, reps: 8, weightKg: "10" }, "Peso: numero tra 0 e 1000."],
    [{ exerciseId: 2, reps: 8, weightKg: Number.NaN }, "Peso: numero tra 0 e 1000."],
  ])("is refused: %j", (body, message) => {
    expect(() => parseSet(body)).toThrow(message);
  });

  it("changes reps and kg only", () => {
    expect(parseSetChange({ exerciseId: 9, reps: 6, weightKg: 70 })).toEqual({ reps: 6, weightKg: 70 });
    expect(() => parseSetChange({ reps: 6 })).toThrow("Peso: numero tra 0 e 1000.");
  });
});
