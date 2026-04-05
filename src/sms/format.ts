import * as twilio from "twilio";

/**
 * Builds a TwiML XML string containing a single SMS reply message.
 * The response must be returned with Content-Type: text/xml.
 *
 * If message is empty (e.g., after a STOP command where Twilio handles
 * the confirmation itself), returns a bare <Response/> with no Message element.
 */
export const buildTwiml = (message: string): string => {
  const response = new twilio.twiml.MessagingResponse();
  if (message.length > 0) {
    response.message(message);
  }
  return response.toString();
};
