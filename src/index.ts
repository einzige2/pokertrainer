import * as twilio from "twilio";
import * as dbClient from "@/db/client";
import * as schema from "@/db/schema";
import * as scheduler from "@/scheduler/index";
import * as webhook from "@/sms/webhook";
import * as configModule from "@/config";

// Run schema migrations (idempotent — safe on every startup)
schema.runMigrations(dbClient.db);

// Initialize Twilio REST client
const twilioClient = twilio.default(
  configModule.config.twilio.accountSid,
  configModule.config.twilio.authToken
);

// Start the outbound quiz scheduler
scheduler.startScheduler({ db: dbClient.db, twilioClient });

// Start the inbound SMS webhook server
webhook.startWebhookServer(dbClient.db);
