import { Webhook } from "standardwebhooks";

/**
 * Verifies the Standard Webhooks signature without coupling accepted event types to the SDK's
 * generated event union. PolarWebhookHandler validates the verified payload with Croco schemas.
 */
export function verifyPolarWebhook(
  body: Buffer | string,
  headers: Record<string, string>,
  secret: string,
): unknown {
  const base64Secret = Buffer.from(secret, "utf8").toString("base64");
  return new Webhook(base64Secret).verify(body, headers);
}
