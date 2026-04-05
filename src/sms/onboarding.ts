import { Database } from "bun:sqlite";
import {
  setUserSendTime,
  enrollUser,
  updateUserStatus,
} from "../db/users";
import type { User } from "../db/users";

/** Validates a time string in HH:MM 24h format. */
const parseTime = (input: string): string | null => {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(input.trim());
  if (match == null) return null;
  // Normalize to zero-padded HH:MM
  const hh = match[1]!.padStart(2, "0");
  const mm = match[2]!.padStart(2, "0");
  return `${hh}:${mm}`;
};

/** Validates a daily question count between 1 and 20 inclusive. */
const parseCount = (input: string): number | null => {
  const n = parseInt(input.trim(), 10);
  if (isNaN(n) || n < 1 || n > 20) return null;
  return n;
};

/**
 * Handles an inbound SMS from a user in an onboarding state.
 * Advances the state machine on valid input; re-prompts on invalid input.
 * Returns the reply message to send back to the user.
 */
export const handleOnboarding = (args: {
  user: User;
  text: string;
  db: Database;
}): string => {
  const { user, text, db } = args;

  if (user.status === "onboarding_time") {
    const time = parseTime(text);
    if (time == null) {
      return (
        "What time should I send your daily quizzes?\n" +
        "Reply with HH:MM (24h), e.g. 09:00 or 20:30"
      );
    }
    setUserSendTime({ db, userId: user.id, sendTime: time });
    return "How many questions per day? Reply with a number from 1 to 20.";
  }

  if (user.status === "onboarding_count") {
    const count = parseCount(text);
    if (count == null) {
      return "How many questions per day? Reply with a number from 1 to 20.";
    }
    enrollUser({ db, userId: user.id, dailyCount: count });
    return (
      `You're enrolled! I'll send ${count} questions at ${user.send_time ?? "your chosen time"} each day.\n` +
      "Text STOP to unenroll, START to re-configure."
    );
  }

  // Should not reach here — caller should only call this for onboarding statuses
  updateUserStatus({ db, userId: user.id, status: "onboarding_time" });
  return (
    "Welcome to PokerTrainer! What time should I send your daily quizzes?\n" +
    "Reply with HH:MM (24h), e.g. 09:00 or 20:30"
  );
};
