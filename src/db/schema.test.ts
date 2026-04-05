import { describe, it, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { runMigrations } from "./schema";

describe("runMigrations", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.run("PRAGMA foreign_keys = ON;");
  });

  it("creates the users table", () => {
    runMigrations(db);
    const row = db
      .query("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
      .get() as { name: string } | null;
    expect(row?.name).toBe("users");
  });

  it("creates the quiz_history table", () => {
    runMigrations(db);
    const row = db
      .query("SELECT name FROM sqlite_master WHERE type='table' AND name='quiz_history'")
      .get() as { name: string } | null;
    expect(row?.name).toBe("quiz_history");
  });

  it("is idempotent — running twice does not throw", () => {
    expect(() => {
      runMigrations(db);
      runMigrations(db);
    }).not.toThrow();
  });

  it("inserts and retrieves a user after migration", () => {
    runMigrations(db);
    db.run("INSERT INTO users (phone) VALUES (?)", ["+15555550100"]);
    const user = db
      .query("SELECT phone, status FROM users WHERE phone = ?")
      .get("+15555550100") as { phone: string; status: string } | null;
    expect(user?.phone).toBe("+15555550100");
    expect(user?.status).toBe("onboarding_time");
  });
});
