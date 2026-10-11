import { createHash, randomBytes } from "node:crypto";

/** Generates a raw share token; returned once and never persisted. */
export function generateReferralToken(): string {
  return randomBytes(32).toString("hex");
}

/** Hashes a presented token for storage lookup; raw tokens never persist or log. */
export function hashReferralToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
