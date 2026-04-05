import * as twilio from "twilio";
import { db } from "./db/client";
import { runMigrations } from "./db/schema";
import { startScheduler } from "./scheduler/index";
import { startWebhookServer } from "./sms/webhook";
import { config } from "./config";

// Run schema migrations (idempotent — safe on every startup)
runMigrations(db);

// Initialize Twilio REST client
const twilioClient = twilio.default(
  config.twilio.accountSid,
  config.twilio.authToken
);

// Start the outbound quiz scheduler
startScheduler({ db, twilioClient });

// Start the inbound SMS webhook server
startWebhookServer(db);
