import * as sqlite from "bun:sqlite";
import * as twilio from "twilio";
import * as users from "@/db/users";
import * as quizHistory from "@/db/quiz-history";
import * as generate from "@/quiz/generate";
import * as message from "@/quiz/message";
import type * as rangeTypes from "@/data/ranges/types";

/**
 * Sends the daily quiz batch for a single user.
 *
 * Steps:
 * 1. Update last_sent_date immediately (before any sends) to prevent double-send on restart
 * 2. Age out any unanswered questions from prior days
 * 3. Generate daily_count unique questions and insert them into quiz_history
 * 4. Send each question as an outbound SMS via Twilio REST
 *
 * If Twilio returns error 21610 (opted-out number), the user is paused in the DB.
 */
export const sendBatch = async (args: {
  db: sqlite.Database;
  user: users.User;
  today: string;
  twilioClient: ReturnType<typeof twilio.default>;
  twilioPhoneNumber: string;
}): Promise<void> => {
  const { db, user, today, twilioClient, twilioPhoneNumber } = args;

  const todayMidnight = `${today} 00:00:00`;

  // Mark as sent before doing any outbound work — prevents double-send on restart
  users.setLastSentDate({ db, userId: user.id, date: today });

  // Age out stale unanswered questions from previous days
  quizHistory.ageOutOldQuestions({ db, userId: user.id, todayMidnight });

  // Generate and queue questions
  const questions = [];
  for (let i = 0; i < user.daily_count; i++) {
    const spec = generate.generateQuestion({ db, userId: user.id, todayMidnight });
    if (spec == null) {
      console.warn(`[scheduler] No more unique questions for user ${user.id} (sent ${i}/${user.daily_count})`);
      break;
    }
    questions.push(spec);

    quizHistory.insertQuizRow({
      db,
      userId: user.id,
      position: spec.position,
      scenario: spec.scenario,
      openerPosition: spec.openerPosition,
      hand: spec.hand,
      correctAction: spec.correctAction,
    });
  }

  // Send each question as an outbound SMS
  for (const spec of questions) {
    const body = message.formatQuestion({
      position: spec.position as rangeTypes.Position,
      scenario: spec.scenario as rangeTypes.Scenario,
      openerPosition: spec.openerPosition as rangeTypes.Position | null,
      hand: spec.hand,
    });

    try {
      await twilioClient.messages.create({
        to: user.phone,
        from: twilioPhoneNumber,
        body,
      });
    } catch (err) {
      const code = (err as { code?: number }).code;

      // 21610: message sent to an opted-out number
      if (code === 21610) {
        console.warn(`[scheduler] User ${user.id} has opted out (21610) — pausing`);
        users.updateUserStatus({ db, userId: user.id, status: "paused" });
        return;
      }

      console.error(`[scheduler] Failed to send to user ${user.id}:`, err);
    }
  }

  console.log(`[scheduler] Sent ${questions.length} question(s) to user ${user.id}`);
};
