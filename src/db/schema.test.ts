import * as bunTest from "bun:test";
import * as sqlite from "bun:sqlite";
import * as schema from "./schema";

bunTest.describe("runMigrations", () => {
  let db: sqlite.Database;

  bunTest.beforeEach(() => {
    db = new sqlite.Database(":memory:");
    db.run("PRAGMA foreign_keys = ON;");
  });

  bunTest.it("creates the users table", () => {
    schema.runMigrations(db);
    const row = db
      .query("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
      .get() as { name: string } | null;
    bunTest.expect(row?.name).toBe("users");
  });

  bunTest.it("creates the quiz_history table", () => {
    schema.runMigrations(db);
    const row = db
      .query("SELECT name FROM sqlite_master WHERE type='table' AND name='quiz_history'")
      .get() as { name: string } | null;
    bunTest.expect(row?.name).toBe("quiz_history");
  });

  bunTest.it("is idempotent — running twice does not throw", () => {
    bunTest.expect(() => {
      schema.runMigrations(db);
      schema.runMigrations(db);
    }).not.toThrow();
  });

  bunTest.it("inserts and retrieves a user after migration", () => {
    schema.runMigrations(db);
    db.run("INSERT INTO users (phone) VALUES (?)", ["+15555550100"]);
    const user = db
      .query("SELECT phone, status FROM users WHERE phone = ?")
      .get("+15555550100") as { phone: string; status: string } | null;
    bunTest.expect(user?.phone).toBe("+15555550100");
    bunTest.expect(user?.status).toBe("onboarding_time");
  });
});
