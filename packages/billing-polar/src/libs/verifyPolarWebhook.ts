import { Webhook, WebhookVerificationError } from "standardwebhooks";

/**
 * Verifies the Standard Webhooks signature without coupling accepted event types to the SDK's
 * generated event union. PolarWebhookHandler validates the verified payload with Croco schemas.
 */
export function verifyPolarWebhook(
  body: Buffer | string,
  headers: Record<string, string>,
  secret: string,
): unknown {
  const legacySecret = Buffer.from(secret, "utf8").toString("base64");
  try {
    return new Webhook(legacySecret).verify(body, headers);
  } catch (error) {
    if (
      !(error instanceof WebhookVerificationError) ||
      !secret.startsWith("whsec_") ||
      secret === "whsec_"
    ) {
      throw error;
    }
    // Polar's legacy HMAC also uses whsec_ secrets, so the prefix alone cannot select the key.
    return new Webhook(secret).verify(body, headers);
  }
}
