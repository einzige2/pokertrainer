import { Database } from "bun:sqlite";

/**
 * Runs all CREATE TABLE IF NOT EXISTS migrations.
 * Safe to call on every startup — idempotent by design.
 */
export const runMigrations = (db: Database): void => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      phone           TEXT    NOT NULL UNIQUE,
      status          TEXT    NOT NULL DEFAULT 'onboarding_time',
      send_time       TEXT,
      daily_count     INTEGER NOT NULL DEFAULT 5,
      last_sent_date  TEXT,
      created_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_users_send_time
      ON users (send_time)
      WHERE status = 'active'
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS quiz_history (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER NOT NULL REFERENCES users(id),
      position        TEXT    NOT NULL,
      scenario        TEXT    NOT NULL,
      opener_position TEXT,
      hand            TEXT    NOT NULL,
      correct_action  TEXT    NOT NULL,
      user_answer     TEXT,
      is_correct      INTEGER,
      sent_at         TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      answered_at     TEXT
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_quiz_history_user_unanswered
      ON quiz_history (user_id, sent_at)
      WHERE user_answer IS NULL
  `);
};
