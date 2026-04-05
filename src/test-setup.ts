// Sets required environment variables for the test suite so config.ts does not exit.
process.env["TWILIO_ACCOUNT_SID"] = "ACtest00000000000000000000000000000";
process.env["TWILIO_AUTH_TOKEN"] = "test_auth_token";
process.env["TWILIO_PHONE_NUMBER"] = "+15559999999";
process.env["WEBHOOK_URL"] = "https://test.example.com/sms";
process.env["APP_TIMEZONE"] = "America/New_York";
process.env["DB_PATH"] = ":memory:";
