import { Database } from "bun:sqlite";

export type UserStatus =
  | "onboarding_time"
  | "onboarding_count"
  | "active"
  | "paused";

export type User = {
  id: number;
  phone: string;
  status: UserStatus;
  send_time: string | null;
  daily_count: number;
  last_sent_date: string | null;
  created_at: string;
};

/**
 * Finds a user by their E.164 phone number.
 * Returns undefined if not found.
 */
export const findUserByPhone = (args: {
  db: Database;
  phone: string;
}): User | undefined => {
  const { db, phone } = args;
  return db
    .query<User, { $phone: string }>(
      "SELECT * FROM users WHERE phone = $phone"
    )
    .get({ $phone: phone }) ?? undefined;
};

/**
 * Creates a new user record in the onboarding_time state.
 * Returns the newly created user.
 */
export const createUser = (args: {
  db: Database;
  phone: string;
}): User => {
  const { db, phone } = args;
  db.run("INSERT INTO users (phone) VALUES ($phone)", { $phone: phone } as never);
  const user = findUserByPhone({ db, phone });
  if (user == null) throw new Error(`Failed to create user for phone: ${phone}`);
  return user;
};

/**
 * Updates the status of a user by their ID.
 */
export const updateUserStatus = (args: {
  db: Database;
  userId: number;
  status: UserStatus;
}): void => {
  const { db, userId, status } = args;
  db.run(
    "UPDATE users SET status = $status WHERE id = $id",
    { $status: status, $id: userId } as never
  );
};

/**
 * Sets the send_time on a user and advances status to onboarding_count.
 */
export const setUserSendTime = (args: {
  db: Database;
  userId: number;
  sendTime: string;
}): void => {
  const { db, userId, sendTime } = args;
  db.run(
    "UPDATE users SET send_time = $send_time, status = 'onboarding_count' WHERE id = $id",
    { $send_time: sendTime, $id: userId } as never
  );
};

/**
 * Completes enrollment: sets daily_count and transitions status to active.
 */
export const enrollUser = (args: {
  db: Database;
  userId: number;
  dailyCount: number;
}): void => {
  const { db, userId, dailyCount } = args;
  db.run(
    "UPDATE users SET daily_count = $daily_count, status = 'active' WHERE id = $id",
    { $daily_count: dailyCount, $id: userId } as never
  );
};

/**
 * Updates last_sent_date for a user to prevent double-sending on the same calendar day.
 */
export const setLastSentDate = (args: {
  db: Database;
  userId: number;
  date: string;
}): void => {
  const { db, userId, date } = args;
  db.run(
    "UPDATE users SET last_sent_date = $date WHERE id = $id",
    { $date: date, $id: userId } as never
  );
};

/**
 * Returns all active users whose send_time matches now AND who have not
 * already received a batch today (last_sent_date != today).
 */
export const getUsersDueAt = (args: {
  db: Database;
  sendTime: string;
  excludeLastSentDate: string;
}): User[] => {
  const { db, sendTime, excludeLastSentDate } = args;
  return db
    .query<User, { $send_time: string; $date: string }>(
      `SELECT * FROM users
       WHERE status = 'active'
         AND send_time = $send_time
         AND (last_sent_date IS NULL OR last_sent_date != $date)`
    )
    .all({ $send_time: sendTime, $date: excludeLastSentDate });
};
