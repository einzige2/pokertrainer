import * as sqlite from "bun:sqlite";
import * as configModule from "@/config";
import * as validate from "./validate";
import * as format from "./format";
import * as dispatch from "./dispatch";

/**
 * Creates and returns the Bun HTTP server for handling inbound Twilio SMS webhooks.
 * All requests to POST /sms are validated via X-Twilio-Signature before processing.
 */
export const startWebhookServer = (db: sqlite.Database): void => {
  Bun.serve({
    port: configModule.config.port,
    routes: {
      "/sms": {
        POST: async (req) => {
          const isValid = await validate.validateTwilioSignature({
            req,
            authToken: configModule.config.twilio.authToken,
            webhookUrl: configModule.config.webhookUrl,
          });

          if (!isValid) {
            console.warn("[webhook] Invalid Twilio signature — rejected request");
            return new Response("Forbidden", { status: 403 });
          }

          // Re-parse body after validation (req body already consumed by validate)
          const body = await req.formData();
          const from = body.get("From");
          const text = body.get("Body");

          if (typeof from !== "string" || typeof text !== "string") {
            return new Response("Bad Request", { status: 400 });
          }

          const replyText = dispatch.handleInbound({ db, from, text });
          const twiml = format.buildTwiml(replyText);

          return new Response(twiml, {
            headers: { "Content-Type": "text/xml" },
          });
        },
      },
    },
    fetch: () => new Response("Not Found", { status: 404 }),
  });

  console.log(`[webhook] Listening on port ${configModule.config.port}`);
};
