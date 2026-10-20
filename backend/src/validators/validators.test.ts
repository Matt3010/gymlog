import { describe, expect, it } from "vitest";
import {
  InputError, parseExercise, parseExerciseNote, parseLogin, parseRegister, parsePlan, parseSet, parseSetChange, parseWorkoutChange, parseWorkoutStart,
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

  it("takes the username whatever the case", () => {
    expect(parseLogin({ username: "Anna", password: "x" }).username).toBe("anna");
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

describe("a sign-up", () => {
  const RULE = "Utente: da 3 a 30 caratteri, solo lettere, numeri, punto, trattino e trattino basso.";

  it("has a username, lower-cased, and a password of ten characters at least", () => {
    expect(parseRegister({ username: " Mario.Rossi_1-x ", password: "0123456789" })).toEqual({ username: "mario.rossi_1-x", password: "0123456789" });
    expect(parseRegister({ username: "abc", password: "x".repeat(200) }).username).toBe("abc");
    expect(parseRegister({ username: "a".repeat(30), password: "x".repeat(10) }).username).toHaveLength(30);
  });

  it.each([
    [{ username: "ab", password: "0123456789" }, RULE],
    [{ username: "a".repeat(31), password: "0123456789" }, RULE],
    [{ username: "anna rossi", password: "0123456789" }, RULE],
    [{ username: "anna!", password: "0123456789" }, RULE],
    [{ username: "ànna", password: "0123456789" }, RULE],
    [{ username: 5, password: "0123456789" }, RULE],
    [{ password: "0123456789" }, RULE],
    [{ username: "anna", password: "012345678" }, "Password: almeno 10 caratteri."],
    [{ username: "anna", password: "x".repeat(201) }, "Password: al più 200 caratteri."],
    [{ username: "anna", password: 1234567890 }, "Password: almeno 10 caratteri."],
    [{ username: "anna" }, "Password: almeno 10 caratteri."],
  ])("is refused: %j", (body, message) => {
    expect(() => parseRegister(body)).toThrow(new InputError(message));
  });
});

describe("an exercise", () => {
  it("has a name, and maybe a muscle group and notes", () => {
    expect(parseExercise({ name: " Squat ", muscleGroup: " Gambe ", notes: "  " })).toEqual({ name: "Squat", muscleGroup: "Gambe", notes: null, bodyweight: false });
    expect(parseExercise({ name: "Squat", muscleGroup: null, notes: null })).toEqual({ name: "Squat", muscleGroup: null, notes: null, bodyweight: false });
  });

  it("takes missing optional fields as nothing, and done with weights", () => {
    expect(parseExercise({ name: "Squat" })).toEqual({ name: "Squat", muscleGroup: null, notes: null, bodyweight: false });
  });

  it("may be done without weights", () => {
    expect(parseExercise({ name: "Trazioni", bodyweight: true }).bodyweight).toBe(true);
    expect(() => parseExercise({ name: "Trazioni", bodyweight: "sì" })).toThrow("Corpo libero: valore non valido.");
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
  const exercise = { exerciseId: 3, reps: [" 8-10 ", " 8-10 ", " 8-10 ", " 8-10 "], restSeconds: 90, notes: null };
  const plan = { name: "Scheda", notes: null, exercises: [exercise] };
  const with_ = (change: object) => ({ ...plan, exercises: [{ ...exercise, ...change }] });

  it("has a name, notes and its exercises", () => {
    expect(parsePlan(plan)).toEqual({
      name: "Scheda", notes: null,
      exercises: [{ exerciseId: 3, reps: ["8-10", "8-10", "8-10", "8-10"], restSeconds: 90, notes: null }],
    });
  });

  it("takes a missing rest and notes as nothing", () => {
    expect(parsePlan({ name: "Scheda", exercises: [{ exerciseId: 3, reps: ["8", "8", "8", "8"] }] })).toEqual({
      name: "Scheda", notes: null,
      exercises: [{ exerciseId: 3, reps: ["8", "8", "8", "8"], restSeconds: null, notes: null }],
    });
  });

  it("keeps the notes of the plan and of each exercise, and a rest left empty", () => {
    const written = { ...with_({ notes: "lento", restSeconds: null }), notes: "3 volte" };
    expect(parsePlan(written)).toMatchObject({ notes: "3 volte", exercises: [{ notes: "lento", restSeconds: null }] });
  });

  it("takes different reps for each set, trimmed, one to twenty sets", () => {
    expect(parsePlan(with_({ reps: [" 12 ", "10", "8-10", "max"] })).exercises[0]!.reps).toEqual(["12", "10", "8-10", "max"]);
    expect(parsePlan(with_({ reps: Array.from({ length: 20 }, () => "x".repeat(20)) })).exercises[0]!.reps).toHaveLength(20);
  });

  it("takes no exercises, and up to thirty", () => {
    expect(parsePlan({ ...plan, exercises: [] }).exercises).toEqual([]);
    expect(parsePlan({ ...plan, exercises: Array.from({ length: 30 }, () => exercise) }).exercises).toHaveLength(30);
  });

  it.each([
    [{ ...plan, exercises: undefined }, "Esercizi: elenco non valido."],
    [{ ...plan, exercises: "x" }, "Esercizi: elenco non valido."],
    [{ ...plan, exercises: Array.from({ length: 31 }, () => exercise) }, "Esercizi: al più 30 per scheda."],
    [{ ...plan, exercises: [5] }, "Richiesta non valida."],
    [{ ...plan, name: " " }, "Nome: manca o è troppo lungo."],
    [with_({ exerciseId: 0 }), "Esercizio: numero tra 1 e 2147483647 (intero)."],
    [with_({ reps: [] }), "Serie: da 1 a 20."],
    [with_({ reps: Array.from({ length: 21 }, () => "8") }), "Serie: da 1 a 20."],
    [with_({ reps: "10" }), "Serie: da 1 a 20."],
    [with_({ reps: ["10", ""] }), "Ripetizioni: manca o è troppo lungo."],
    [with_({ reps: ["x".repeat(21)] }), "Ripetizioni: manca o è troppo lungo."],
    [with_({ reps: [10] }), "Ripetizioni: manca o è troppo lungo."],
    [with_({ restSeconds: 3601 }), "Recupero: numero tra 0 e 3600 (intero)."],
  ])("is refused: %#", (body, message) => {
    expect(() => parsePlan(body)).toThrow(message);
  });
});

describe("a note on an exercise in a workout", () => {
  it("is trimmed text, and nothing when blank or null", () => {
    expect(parseExerciseNote({ note: " scendere di peso " })).toEqual({ note: "scendere di peso" });
    expect(parseExerciseNote({ note: "   " })).toEqual({ note: null });
    expect(parseExerciseNote({ note: null })).toEqual({ note: null });
    expect(parseExerciseNote({ note: "x".repeat(1000) }).note).toHaveLength(1000);
  });

  it.each([
    [{ note: "x".repeat(1001) }, "Testo della nota: troppo lungo."],
    [{ note: 5 }, "Testo della nota: troppo lungo."],
    [{}, "Testo della nota: obbligatorio."],
  ])("is refused: %j", (body, message) => {
    expect(() => parseExerciseNote(body)).toThrow(new InputError(message));
  });
});

describe("starting a workout", () => {
  it("names a plan, or none", () => {
    expect(parseWorkoutStart({ planId: 4 })).toEqual({ planId: 4 });
    expect(parseWorkoutStart({ planId: null })).toEqual({ planId: null });
    expect(parseWorkoutStart({})).toEqual({ planId: null });
  });

  it("is refused with a plan that is no id", () => {
    expect(() => parseWorkoutStart({ planId: "4" })).toThrow("Scheda: numero tra 1 e 2147483647 (intero).");
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

describe("a text", () => {
  it("refuses an invisible NUL character, that the database would not take", () => {
    expect(() => parseSet({ exerciseId: 2, reps: 8, weightKg: 60, key: "a\u0000b" })).toThrow("Chiave: valore non valido.");
  });
});

describe("a set", () => {
  it("has an exercise, reps and kg", () => {
    expect(parseSet({ exerciseId: 2, reps: 8, weightKg: 62.5 })).toEqual({ exerciseId: 2, reps: 8, weightKg: 62.5, toFailure: false, note: null, continues: false });
    expect(parseSet({ exerciseId: 2, reps: 100, weightKg: 0 })).toMatchObject({ reps: 100, weightKg: 0 });
    expect(parseSet({ exerciseId: 2, reps: 1, weightKg: 1000 })).toMatchObject({ reps: 1, weightKg: 1000 });
  });

  it("may carry a key of the app, to be logged once however many times it is sent", () => {
    expect(parseSet({ exerciseId: 2, reps: 8, weightKg: 60, key: "3f2a-9c" })).toEqual({ exerciseId: 2, reps: 8, weightKg: 60, toFailure: false, note: null, continues: false, key: "3f2a-9c" });
    expect(() => parseSet({ exerciseId: 2, reps: 8, weightKg: 60, key: "x".repeat(65) })).toThrow("Chiave: troppo lungo");
  });

  it("may have no weight: done without one", () => {
    expect(parseSet({ exerciseId: 2, reps: 8 })).toMatchObject({ reps: 8, weightKg: null });
    expect(parseSet({ exerciseId: 2, reps: 8, weightKg: null })).toMatchObject({ reps: 8, weightKg: null });
  });

  it("to failure, may leave out the reps", () => {
    expect(parseSet({ exerciseId: 2, weightKg: 10, toFailure: true })).toMatchObject({ reps: null, weightKg: 10, toFailure: true });
    expect(parseSet({ exerciseId: 2, reps: 12, weightKg: 10, toFailure: true })).toMatchObject({ reps: 12, toFailure: true });
    expect(() => parseSet({ exerciseId: 2, weightKg: 10 })).toThrow("Ripetizioni: numero tra 1 e 100 (intero).");
    expect(() => parseSet({ exerciseId: 2, reps: 0, weightKg: 10, toFailure: true })).toThrow("Ripetizioni: numero tra 1 e 100 (intero).");
  });

  it("carries a short note of its own, trimmed, blank as none", () => {
    expect(parseSet({ exerciseId: 2, reps: 3, weightKg: 10, note: " SX " }).note).toBe("SX");
    expect(parseSet({ exerciseId: 2, reps: 3, weightKg: 10, note: " " }).note).toBeNull();
    expect(() => parseSet({ exerciseId: 2, reps: 3, weightKg: 10, note: "x".repeat(101) })).toThrow("Testo della nota: troppo lungo.");
  });

  it("may continue the set before it, as a part of it", () => {
    expect(parseSet({ exerciseId: 2, reps: 3, weightKg: 10, continues: true }).continues).toBe(true);
    expect(() => parseSet({ exerciseId: 2, reps: 3, weightKg: 10, continues: 1 })).toThrow("Stessa serie: valore non valido.");
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
    [{ exerciseId: 2, reps: 8, weightKg: 10, toFailure: "sì" }, "MAX: valore non valido."],
  ])("is refused: %j", (body, message) => {
    expect(() => parseSet(body)).toThrow(message);
  });

  it("changes what a set says, not its exercise", () => {
    expect(parseSetChange({ exerciseId: 9, reps: 6, weightKg: 70 })).toEqual({ reps: 6, weightKg: 70, toFailure: false, note: null });
    expect(parseSetChange({ reps: null, toFailure: true, note: "SX" })).toEqual({ reps: null, weightKg: null, toFailure: true, note: "SX" });
  });
});
