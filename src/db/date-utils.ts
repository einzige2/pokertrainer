/**
 * Date/time utilities for SQLite-compatible timestamp strings.
 *
 * SQLite's CURRENT_TIMESTAMP returns UTC in "YYYY-MM-DD HH:MM:SS" format (space separator).
 * All midnight boundary strings must use the same format for correct string comparisons.
 */

/**
 * Returns today's date as "YYYY-MM-DD" in UTC.
 */
export const getTodayUtcDateString = (): string => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Returns midnight of today as "YYYY-MM-DD 00:00:00" in UTC.
 * Uses a space separator to match SQLite's CURRENT_TIMESTAMP format.
 */
export const getTodayUtcMidnight = (): string => {
  return `${getTodayUtcDateString()} 00:00:00`;
};

/**
 * Returns the current time as "HH:MM" in the given IANA timezone.
 */
export const getCurrentHHMM = (timezone: string): string => {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
};

/**
 * Returns today's date as "YYYY-MM-DD" in the given IANA timezone.
 * Used by the scheduler to determine the calendar day for last_sent_date.
 */
export const getTodayLocalDateString = (timezone: string): string => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
};
