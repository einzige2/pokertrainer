import * as twilio from "twilio";

/**
 * Verifies the X-Twilio-Signature header to ensure the request originated from Twilio.
 * Must be called before processing any inbound webhook payload.
 *
 * IMPORTANT: webhookUrl must exactly match the URL configured in the Twilio console,
 * including scheme, host, and path. A mismatch will always return false.
 */
export const validateTwilioSignature = async (args: {
  req: Request;
  authToken: string;
  webhookUrl: string;
}): Promise<boolean> => {
  const { req, authToken, webhookUrl } = args;
  const signature = req.headers.get("x-twilio-signature") ?? "";

  // Clone the request before consuming the body
  const cloned = req.clone();
  const body = await cloned.formData();

  const params: Record<string, string> = {};
  body.forEach((value, key) => {
    if (typeof value === "string") params[key] = value;
  });

  return twilio.validateRequest(authToken, signature, webhookUrl, params);
};
