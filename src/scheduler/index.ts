import { Database } from "bun:sqlite";
import * as twilio from "twilio";
import { getUsersDueAt } from "../db/users";
import { sendBatch } from "./send-batch";
import { config } from "../config";
import { getCurrentHHMM, getTodayLocalDateString } from "../db/date-utils";

const TICK_MS = 60_000;

/**
 * Starts the daily quiz scheduler.
 * Fires every 60 seconds and sends batches to any active users whose send_time
 * matches the current HH:MM and who have not yet received a batch today.
 *
 * An initial tick fires immediately on startup to catch any sends that were
 * missed if the process was down during the scheduled window.
 */
export const startScheduler = (args: {
  db: Database;
  twilioClient: ReturnType<typeof twilio.default>;
}): void => {
  const { db, twilioClient } = args;

  const tick = async (): Promise<void> => {
    const today = getTodayLocalDateString(config.appTimezone);
    const now = getCurrentHHMM(config.appTimezone);

    const dueUsers = getUsersDueAt({ db, sendTime: now, excludeLastSentDate: today });

    if (dueUsers.length > 0) {
      console.log(`[scheduler] Tick ${now}: ${dueUsers.length} user(s) due`);
    }

    for (const user of dueUsers) {
      await sendBatch({
        db,
        user,
        today,
        twilioClient,
        twilioPhoneNumber: config.twilio.phoneNumber,
      });
    }
  };

  // Immediate tick on startup — catches missed sends after a restart
  void tick();

  setInterval(() => void tick(), TICK_MS);

  console.log("[scheduler] Started (60s interval)");
};
