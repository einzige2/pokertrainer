/**
 * Loads and validates all required environment variables at startup.
 * The process exits immediately if any required variable is missing.
 */

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (value == null || value === "") {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
  return value;
};

export const config = {
  twilio: {
    accountSid: requireEnv("TWILIO_ACCOUNT_SID"),
    authToken: requireEnv("TWILIO_AUTH_TOKEN"),
    phoneNumber: requireEnv("TWILIO_PHONE_NUMBER"),
  },
  webhookUrl: requireEnv("WEBHOOK_URL"),
  appTimezone: process.env["APP_TIMEZONE"] ?? "America/New_York",
  port: Number(process.env["PORT"] ?? 3000),
  dbPath: process.env["DB_PATH"] ?? "./quiz.sqlite",
} as const;
