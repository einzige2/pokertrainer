import * as bunTest from "bun:test";
import * as sqlite from "bun:sqlite";
import * as schema from "@/db/schema";
import * as users from "@/db/users";
import * as sendBatchModule from "./send-batch";

const makeDb = (): sqlite.Database => {
  const db = new sqlite.Database(":memory:");
  db.run("PRAGMA foreign_keys = ON;");
  schema.runMigrations(db);
  return db;
};

const makeEnrolledUser = (db: sqlite.Database, phone: string): users.User => {
  const user = users.createUser({ db, phone });
  users.setUserSendTime({ db, userId: user.id, sendTime: "09:00" });
  users.enrollUser({ db, userId: user.id, dailyCount: 3 });
  return users.findUserByPhone({ db, phone })!;
};

const today = "2026-04-05";

bunTest.describe("sendBatch", () => {
  let db: sqlite.Database;

  bunTest.beforeEach(() => {
    db = makeDb();
  });

  bunTest.it("sets last_sent_date before sending", async () => {
    const user = makeEnrolledUser(db, "+15550002001");
    const sentMessages: string[] = [];

    const twilioClient = {
      messages: {
        create: bunTest.mock(async (opts: { body: string }) => {
          sentMessages.push(opts.body);
          return { sid: "SM123" };
        }),
      },
    } as never;

    await sendBatchModule.sendBatch({ db, user, today, twilioClient, twilioPhoneNumber: "+15559999999" });

    const updated = users.findUserByPhone({ db, phone: "+15550002001" })!;
    bunTest.expect(updated.last_sent_date).toBe(today);
  });

  bunTest.it("sends daily_count messages", async () => {
    const user = makeEnrolledUser(db, "+15550002002");
    const sentMessages: string[] = [];

    const twilioClient = {
      messages: {
        create: bunTest.mock(async (opts: { body: string }) => {
          sentMessages.push(opts.body);
          return { sid: "SM123" };
        }),
      },
    } as never;

    await sendBatchModule.sendBatch({ db, user, today, twilioClient, twilioPhoneNumber: "+15559999999" });
    bunTest.expect(sentMessages.length).toBe(user.daily_count);
  });

  bunTest.it("sets last_sent_date as double-send guard", async () => {
    const user = makeEnrolledUser(db, "+15550002003");

    const twilioClient = {
      messages: {
        create: bunTest.mock(async () => ({ sid: "SM123" })),
      },
    } as never;

    await sendBatchModule.sendBatch({ db, user, today, twilioClient, twilioPhoneNumber: "+15559999999" });

    const updated = users.findUserByPhone({ db, phone: "+15550002003" })!;
    bunTest.expect(updated.last_sent_date).toBe(today);
  });

  bunTest.it("pauses user when Twilio returns 21610", async () => {
    const user = makeEnrolledUser(db, "+15550002004");

    const twilioClient = {
      messages: {
        create: bunTest.mock(async () => {
          const err = new Error("Unsubscribed") as Error & { code: number };
          err.code = 21610;
          throw err;
        }),
      },
    } as never;

    await sendBatchModule.sendBatch({ db, user, today, twilioClient, twilioPhoneNumber: "+15559999999" });

    const updated = users.findUserByPhone({ db, phone: "+15550002004" })!;
    bunTest.expect(updated.status).toBe("paused");
  });
});
