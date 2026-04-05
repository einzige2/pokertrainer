import * as bunTest from "bun:test";
import * as sqlite from "bun:sqlite";
import * as schema from "@/db/schema";
import * as dispatch from "./dispatch";
import * as users from "@/db/users";
import * as quizHistory from "@/db/quiz-history";

const makeDb = (): sqlite.Database => {
  const db = new sqlite.Database(":memory:");
  db.run("PRAGMA foreign_keys = ON;");
  schema.runMigrations(db);
  return db;
};

bunTest.describe("handleInbound — sign-up flow", () => {
  let db: sqlite.Database;

  bunTest.beforeEach(() => {
    db = makeDb();
  });

  bunTest.it("creates user and starts onboarding on START", () => {
    const reply = dispatch.handleInbound({ db, from: "+15550000001", text: "START" });
    bunTest.expect(reply).toContain("What time");
    const user = users.findUserByPhone({ db, phone: "+15550000001" });
    bunTest.expect(user?.status).toBe("onboarding_time");
  });

  bunTest.it("advances to onboarding_count on valid time", () => {
    dispatch.handleInbound({ db, from: "+15550000002", text: "START" });
    const reply = dispatch.handleInbound({ db, from: "+15550000002", text: "09:00" });
    bunTest.expect(reply).toContain("questions per day");
    const user = users.findUserByPhone({ db, phone: "+15550000002" });
    bunTest.expect(user?.status).toBe("onboarding_count");
    bunTest.expect(user?.send_time).toBe("09:00");
  });

  bunTest.it("re-prompts on invalid time", () => {
    dispatch.handleInbound({ db, from: "+15550000003", text: "START" });
    const reply = dispatch.handleInbound({ db, from: "+15550000003", text: "9am" });
    bunTest.expect(reply).toContain("HH:MM");
    const user = users.findUserByPhone({ db, phone: "+15550000003" });
    bunTest.expect(user?.status).toBe("onboarding_time");
  });

  bunTest.it("enrolls user on valid count", () => {
    dispatch.handleInbound({ db, from: "+15550000004", text: "START" });
    dispatch.handleInbound({ db, from: "+15550000004", text: "09:00" });
    const reply = dispatch.handleInbound({ db, from: "+15550000004", text: "5" });
    bunTest.expect(reply).toContain("enrolled");
    const user = users.findUserByPhone({ db, phone: "+15550000004" });
    bunTest.expect(user?.status).toBe("active");
    bunTest.expect(user?.daily_count).toBe(5);
  });

  bunTest.it("re-prompts on count out of range", () => {
    dispatch.handleInbound({ db, from: "+15550000005", text: "START" });
    dispatch.handleInbound({ db, from: "+15550000005", text: "09:00" });
    const reply = dispatch.handleInbound({ db, from: "+15550000005", text: "25" });
    bunTest.expect(reply).toContain("1 to 20");
    const user = users.findUserByPhone({ db, phone: "+15550000005" });
    bunTest.expect(user?.status).toBe("onboarding_count");
  });

  bunTest.it("pauses active user on STOP", () => {
    dispatch.handleInbound({ db, from: "+15550000006", text: "START" });
    dispatch.handleInbound({ db, from: "+15550000006", text: "09:00" });
    dispatch.handleInbound({ db, from: "+15550000006", text: "5" });
    dispatch.handleInbound({ db, from: "+15550000006", text: "STOP" });
    const user = users.findUserByPhone({ db, phone: "+15550000006" });
    bunTest.expect(user?.status).toBe("paused");
  });

  bunTest.it("tells unknown number to START", () => {
    const reply = dispatch.handleInbound({ db, from: "+15550000099", text: "hello" });
    bunTest.expect(reply).toContain("START");
  });

  bunTest.it("tells paused user to START", () => {
    dispatch.handleInbound({ db, from: "+15550000007", text: "START" });
    dispatch.handleInbound({ db, from: "+15550000007", text: "09:00" });
    dispatch.handleInbound({ db, from: "+15550000007", text: "5" });
    dispatch.handleInbound({ db, from: "+15550000007", text: "STOP" });
    const reply = dispatch.handleInbound({ db, from: "+15550000007", text: "hello" });
    bunTest.expect(reply).toContain("START");
  });
});

bunTest.describe("handleInbound — answer flow", () => {
  let db: sqlite.Database;
  const phone = "+15550001000";

  bunTest.beforeEach(() => {
    db = makeDb();
    dispatch.handleInbound({ db, from: phone, text: "START" });
    dispatch.handleInbound({ db, from: phone, text: "09:00" });
    dispatch.handleInbound({ db, from: phone, text: "5" });
  });

  bunTest.it("replies 'no quiz pending' when there are no questions", () => {
    const reply = dispatch.handleInbound({ db, from: phone, text: "O" });
    bunTest.expect(reply).toContain("No quiz pending");
  });

  bunTest.it("scores a correct answer", () => {
    const user = users.findUserByPhone({ db, phone })!;
    quizHistory.insertQuizRow({
      db, userId: user.id, position: "BTN", scenario: "rfi",
      openerPosition: null, hand: "AKs", correctAction: "open",
    });
    const reply = dispatch.handleInbound({ db, from: phone, text: "O" });
    bunTest.expect(reply).toContain("Correct");
  });

  bunTest.it("scores an incorrect answer", () => {
    const user = users.findUserByPhone({ db, phone })!;
    quizHistory.insertQuizRow({
      db, userId: user.id, position: "BTN", scenario: "rfi",
      openerPosition: null, hand: "72o", correctAction: "fold",
    });
    const reply = dispatch.handleInbound({ db, from: phone, text: "O" });
    bunTest.expect(reply).toContain("Incorrect");
  });

  bunTest.it("rejects an invalid reply code", () => {
    const user = users.findUserByPhone({ db, phone })!;
    quizHistory.insertQuizRow({
      db, userId: user.id, position: "BTN", scenario: "rfi",
      openerPosition: null, hand: "AKs", correctAction: "open",
    });
    const reply = dispatch.handleInbound({ db, from: phone, text: "X" });
    bunTest.expect(reply).toContain("Didn't understand");
  });

  bunTest.it("answers questions FIFO", () => {
    const user = users.findUserByPhone({ db, phone })!;
    quizHistory.insertQuizRow({ db, userId: user.id, position: "BTN", scenario: "rfi", openerPosition: null, hand: "AKs", correctAction: "open" });
    quizHistory.insertQuizRow({ db, userId: user.id, position: "UTG", scenario: "rfi", openerPosition: null, hand: "72o", correctAction: "fold" });

    const reply1 = dispatch.handleInbound({ db, from: phone, text: "O" });
    bunTest.expect(reply1).toContain("Correct");

    const reply2 = dispatch.handleInbound({ db, from: phone, text: "F" });
    bunTest.expect(reply2).toContain("Correct");
  });
});
