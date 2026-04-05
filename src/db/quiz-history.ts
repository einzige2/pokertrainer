import { Database } from "bun:sqlite";
import type { Scenario } from "../data/ranges/types";

export type QuizHistoryRow = {
  id: number;
  user_id: number;
  position: string;
  scenario: Scenario;
  opener_position: string | null;
  hand: string;
  correct_action: string;
  user_answer: string | null;
  is_correct: number | null;
  sent_at: string;
  answered_at: string | null;
};

/**
 * Inserts a new quiz question row for a user.
 */
export const insertQuizRow = (args: {
  db: Database;
  userId: number;
  position: string;
  scenario: Scenario;
  openerPosition: string | null;
  hand: string;
  correctAction: string;
}): void => {
  const { db, userId, position, scenario, openerPosition, hand, correctAction } = args;
  db.run(
    `INSERT INTO quiz_history
       (user_id, position, scenario, opener_position, hand, correct_action)
     VALUES ($user_id, $position, $scenario, $opener_position, $hand, $correct_action)`,
    {
      $user_id: userId,
      $position: position,
      $scenario: scenario,
      $opener_position: openerPosition,
      $hand: hand,
      $correct_action: correctAction,
    } as never
  );
};

/**
 * Returns the oldest unanswered quiz row for a user sent today (FIFO).
 * "Today" is the ISO date string for midnight in the app's timezone.
 */
export const getOldestUnanswered = (args: {
  db: Database;
  userId: number;
  todayMidnight: string;
}): QuizHistoryRow | undefined => {
  const { db, userId, todayMidnight } = args;
  return (
    db
      .query<QuizHistoryRow, { $user_id: number; $midnight: string }>(
        `SELECT * FROM quiz_history
         WHERE user_id = $user_id
           AND user_answer IS NULL
           AND sent_at >= $midnight
         ORDER BY sent_at ASC
         LIMIT 1`
      )
      .get({ $user_id: userId, $midnight: todayMidnight }) ?? undefined
  );
};

/**
 * Records a user's answer to a quiz question.
 */
export const recordAnswer = (args: {
  db: Database;
  rowId: number;
  userAnswer: string;
  isCorrect: boolean;
}): void => {
  const { db, rowId, userAnswer, isCorrect } = args;
  db.run(
    `UPDATE quiz_history
     SET user_answer = $answer, is_correct = $correct, answered_at = datetime('now')
     WHERE id = $id`,
    { $answer: userAnswer, $correct: isCorrect ? 1 : 0, $id: rowId } as never
  );
};

/**
 * Ages out all unanswered questions sent before today midnight.
 * Called at batch-send time to keep history clean.
 */
export const ageOutOldQuestions = (args: {
  db: Database;
  userId: number;
  todayMidnight: string;
}): void => {
  const { db, userId, todayMidnight } = args;
  db.run(
    `UPDATE quiz_history
     SET user_answer = 'AGED_OUT', is_correct = 0, answered_at = datetime('now')
     WHERE user_id = $user_id
       AND user_answer IS NULL
       AND sent_at < $midnight`,
    { $user_id: userId, $midnight: todayMidnight } as never
  );
};

/**
 * Returns hand+position+scenario combos already sent to a user today.
 * Used to deduplicate questions within a single day's batch.
 */
export const getTodaysSentCombos = (args: {
  db: Database;
  userId: number;
  todayMidnight: string;
}): Array<{ position: string; scenario: Scenario; hand: string }> => {
  const { db, userId, todayMidnight } = args;
  return db
    .query<
      { position: string; scenario: Scenario; hand: string },
      { $user_id: number; $midnight: string }
    >(
      `SELECT position, scenario, hand FROM quiz_history
       WHERE user_id = $user_id AND sent_at >= $midnight`
    )
    .all({ $user_id: userId, $midnight: todayMidnight });
};
