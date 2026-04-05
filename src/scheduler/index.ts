import * as sqlite from "bun:sqlite";
import * as twilio from "twilio";
import * as users from "@/db/users";
import * as sendBatchModule from "./send-batch";
import * as configModule from "@/config";
import * as dateUtils from "@/db/date-utils";

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
  db: sqlite.Database;
  twilioClient: ReturnType<typeof twilio.default>;
}): void => {
  const { db, twilioClient } = args;

  const tick = async (): Promise<void> => {
    const today = dateUtils.getTodayLocalDateString(configModule.config.appTimezone);
    const now = dateUtils.getCurrentHHMM(configModule.config.appTimezone);

    const dueUsers = users.getUsersDueAt({ db, sendTime: now, excludeLastSentDate: today });

    if (dueUsers.length > 0) {
      console.log(`[scheduler] Tick ${now}: ${dueUsers.length} user(s) due`);
    }

    for (const user of dueUsers) {
      await sendBatchModule.sendBatch({
        db,
        user,
        today,
        twilioClient,
        twilioPhoneNumber: configModule.config.twilio.phoneNumber,
      });
    }
  };

  // Immediate tick on startup — catches missed sends after a restart
  void tick();

  setInterval(() => void tick(), TICK_MS);

  console.log("[scheduler] Started (60s interval)");
};
