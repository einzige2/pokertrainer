import * as sqlite from "bun:sqlite";
import * as users from "@/db/users";
import * as quizHistory from "@/db/quiz-history";
import * as onboarding from "./onboarding";
import * as evaluate from "@/quiz/evaluate";
import * as message from "@/quiz/message";
import * as dateUtils from "@/db/date-utils";
import type * as rangeTypes from "@/data/ranges/types";

/** Commands handled before user lookup. Case-insensitive. */
const OPT_OUT_KEYWORDS = new Set([
  "STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT",
]);
const OPT_IN_KEYWORD = "START";

/**
 * Master inbound SMS router. Dispatches based on the user's current state.
 * Returns the reply text (to be wrapped in TwiML by the caller).
 */
export const handleInbound = (args: {
  db: sqlite.Database;
  from: string;
  text: string;
}): string => {
  const { db, from, text } = args;
  const normalized = text.trim().toUpperCase();

  // Opt-out: pause any user (or ignore if unknown)
  if (OPT_OUT_KEYWORDS.has(normalized)) {
    const user = users.findUserByPhone({ db, phone: from });
    if (user != null) {
      users.updateUserStatus({ db, userId: user.id, status: "paused" });
    }
    // Twilio sends its own opt-out confirmation; we return empty TwiML
    return "";
  }

  const user = users.findUserByPhone({ db, phone: from });

  // Opt-in / START
  if (normalized === OPT_IN_KEYWORD) {
    if (user == null) {
      const newUser = users.createUser({ db, phone: from });
      return onboarding.handleOnboarding({ user: newUser, text, db });
    }

    if (user.status === "active") {
      return (
        `You're already enrolled. Send time: ${user.send_time ?? "not set"}, ` +
        `${user.daily_count} questions/day.\n` +
        "Text STOP to pause."
      );
    }

    // Mid-onboarding, paused, or any other state: restart onboarding
    users.updateUserStatus({ db, userId: user.id, status: "onboarding_time" });
    const refreshed = users.findUserByPhone({ db, phone: from })!;
    return onboarding.handleOnboarding({ user: refreshed, text, db });
  }

  // Unknown number sending something other than START
  if (user == null) {
    return "Text START to sign up for daily pre-flop quizzes.";
  }

  // Onboarding states
  if (user.status === "onboarding_time" || user.status === "onboarding_count") {
    return onboarding.handleOnboarding({ user, text, db });
  }

  // Paused
  if (user.status === "paused") {
    return "You're unsubscribed. Text START to re-enroll.";
  }

  // Active: try to match reply to oldest unanswered question
  const todayMidnight = dateUtils.getTodayUtcMidnight();
  const pending = quizHistory.getOldestUnanswered({ db, userId: user.id, todayMidnight });

  if (pending == null) {
    const sendTime = user.send_time ?? "your scheduled time";
    return `No quiz pending. Your next batch arrives at ${sendTime}.`;
  }

  const parsed = evaluate.parseReply({ reply: text, scenario: pending.scenario });
  if (!parsed.ok) {
    return `Didn't understand. ${parsed.hint}`;
  }

  const correct = evaluate.isCorrectAnswer({
    parsedAction: parsed.action,
    correctAction: pending.correct_action,
  });

  quizHistory.recordAnswer({ db, rowId: pending.id, userAnswer: parsed.action, isCorrect: correct });

  return message.formatFeedback({
    isCorrect: correct,
    hand: pending.hand,
    correctAction: pending.correct_action,
    position: pending.position as rangeTypes.Position,
    scenario: pending.scenario as rangeTypes.Scenario,
  });
};

