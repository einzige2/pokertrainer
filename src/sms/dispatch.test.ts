import { describe, it, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { runMigrations } from "../db/schema";
import { handleInbound } from "./dispatch";
import { findUserByPhone } from "../db/users";
import { insertQuizRow } from "../db/quiz-history";

const makeDb = (): Database => {
  const db = new Database(":memory:");
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations(db);
  return db;
};

describe("handleInbound — sign-up flow", () => {
  let db: Database;

  beforeEach(() => {
    db = makeDb();
  });

  it("creates user and starts onboarding on START", () => {
    const reply = handleInbound({ db, from: "+15550000001", text: "START" });
    expect(reply).toContain("What time");
    const user = findUserByPhone({ db, phone: "+15550000001" });
    expect(user?.status).toBe("onboarding_time");
  });

  it("advances to onboarding_count on valid time", () => {
    handleInbound({ db, from: "+15550000002", text: "START" });
    const reply = handleInbound({ db, from: "+15550000002", text: "09:00" });
    expect(reply).toContain("questions per day");
    const user = findUserByPhone({ db, phone: "+15550000002" });
    expect(user?.status).toBe("onboarding_count");
    expect(user?.send_time).toBe("09:00");
  });

  it("re-prompts on invalid time", () => {
    handleInbound({ db, from: "+15550000003", text: "START" });
    const reply = handleInbound({ db, from: "+15550000003", text: "9am" });
    expect(reply).toContain("HH:MM");
    const user = findUserByPhone({ db, phone: "+15550000003" });
    expect(user?.status).toBe("onboarding_time");
  });

  it("enrolls user on valid count", () => {
    handleInbound({ db, from: "+15550000004", text: "START" });
    handleInbound({ db, from: "+15550000004", text: "09:00" });
    const reply = handleInbound({ db, from: "+15550000004", text: "5" });
    expect(reply).toContain("enrolled");
    const user = findUserByPhone({ db, phone: "+15550000004" });
    expect(user?.status).toBe("active");
    expect(user?.daily_count).toBe(5);
  });

  it("re-prompts on count out of range", () => {
    handleInbound({ db, from: "+15550000005", text: "START" });
    handleInbound({ db, from: "+15550000005", text: "09:00" });
    const reply = handleInbound({ db, from: "+15550000005", text: "25" });
    expect(reply).toContain("1 to 20");
    const user = findUserByPhone({ db, phone: "+15550000005" });
    expect(user?.status).toBe("onboarding_count");
  });

  it("pauses active user on STOP", () => {
    handleInbound({ db, from: "+15550000006", text: "START" });
    handleInbound({ db, from: "+15550000006", text: "09:00" });
    handleInbound({ db, from: "+15550000006", text: "5" });
    handleInbound({ db, from: "+15550000006", text: "STOP" });
    const user = findUserByPhone({ db, phone: "+15550000006" });
    expect(user?.status).toBe("paused");
  });

  it("tells unknown number to START", () => {
    const reply = handleInbound({ db, from: "+15550000099", text: "hello" });
    expect(reply).toContain("START");
  });

  it("tells paused user to START", () => {
    handleInbound({ db, from: "+15550000007", text: "START" });
    handleInbound({ db, from: "+15550000007", text: "09:00" });
    handleInbound({ db, from: "+15550000007", text: "5" });
    handleInbound({ db, from: "+15550000007", text: "STOP" });
    const reply = handleInbound({ db, from: "+15550000007", text: "hello" });
    expect(reply).toContain("START");
  });
});

describe("handleInbound — answer flow", () => {
  let db: Database;
  const phone = "+15550001000";

  beforeEach(() => {
    db = makeDb();
    // Enroll user
    handleInbound({ db, from: phone, text: "START" });
    handleInbound({ db, from: phone, text: "09:00" });
    handleInbound({ db, from: phone, text: "5" });
  });

  it("replies 'no quiz pending' when there are no questions", () => {
    const reply = handleInbound({ db, from: phone, text: "O" });
    expect(reply).toContain("No quiz pending");
  });

  it("scores a correct answer", () => {
    const user = findUserByPhone({ db, phone })!;
    insertQuizRow({
      db,
      userId: user.id,
      position: "BTN",
      scenario: "rfi",
      openerPosition: null,
      hand: "AKs",
      correctAction: "open",
    });
    const reply = handleInbound({ db, from: phone, text: "O" });
    expect(reply).toContain("Correct");
  });

  it("scores an incorrect answer", () => {
    const user = findUserByPhone({ db, phone })!;
    insertQuizRow({
      db,
      userId: user.id,
      position: "BTN",
      scenario: "rfi",
      openerPosition: null,
      hand: "72o",
      correctAction: "fold",
    });
    const reply = handleInbound({ db, from: phone, text: "O" });
    expect(reply).toContain("Incorrect");
  });

  it("rejects an invalid reply code", () => {
    const user = findUserByPhone({ db, phone })!;
    insertQuizRow({
      db,
      userId: user.id,
      position: "BTN",
      scenario: "rfi",
      openerPosition: null,
      hand: "AKs",
      correctAction: "open",
    });
    const reply = handleInbound({ db, from: phone, text: "X" });
    expect(reply).toContain("Didn't understand");
  });

  it("answers questions FIFO", () => {
    const user = findUserByPhone({ db, phone })!;
    insertQuizRow({ db, userId: user.id, position: "BTN", scenario: "rfi", openerPosition: null, hand: "AKs", correctAction: "open" });
    insertQuizRow({ db, userId: user.id, position: "UTG", scenario: "rfi", openerPosition: null, hand: "72o", correctAction: "fold" });

    // First reply should match AKs (oldest)
    const reply1 = handleInbound({ db, from: phone, text: "O" });
    expect(reply1).toContain("Correct");

    // Second reply should match 72o
    const reply2 = handleInbound({ db, from: phone, text: "F" });
    expect(reply2).toContain("Correct");
  });
});
