import { Database } from "bun:sqlite";
import { config } from "../config";

/**
 * Singleton SQLite database instance.
 * WAL mode is enabled for better concurrent read performance.
 * Foreign key enforcement is turned on globally.
 */
export const db = new Database(config.dbPath);

db.run("PRAGMA journal_mode = WAL;");
db.run("PRAGMA foreign_keys = ON;");
