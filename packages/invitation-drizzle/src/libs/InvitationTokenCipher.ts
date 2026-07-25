import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { Token } from "@croco/framework-context";
import { Problem, ProblemCategory } from "@croco/problems-core";

export interface InvitationTokenCipher {
  encrypt(token: string, context: InvitationTokenCipherContext): string;
  decrypt(ciphertext: string, context: InvitationTokenCipherContext): string;
}

export const INVITATION_TOKEN_CIPHER = new Token<InvitationTokenCipher>("INVITATION_TOKEN_CIPHER");

export type AesGcmInvitationTokenCipherOptions = {
  activeKeyId: string;
  keys: Readonly<Record<string, Uint8Array>>;
};

export type InvitationTokenCipherContext = {
  tenantId: string;
  invitationId: string;
  idempotencyKey: string;
};

export class InvitationTokenCipherProblem extends Problem {
  constructor(operation: "configure" | "encrypt" | "decrypt", keyId: string) {
    super(
      "invitation-drizzle/token-cipher-failed",
      ProblemCategory.InternalServerError,
      "Invitation token protection could not be completed",
      {
        extensions: {
          operation,
          keyId,
          retryable: false,
        },
      },
    );
  }
}

/**
 * Rotation-capable AES-256-GCM protection for replayable invitation tokens.
 *
 * Ciphertexts carry the key ID used to encrypt them. Keep old keys configured
 * until all creation intents encrypted with them have expired or been removed.
 */
export class AesGcmInvitationTokenCipher implements InvitationTokenCipher {
  constructor(private readonly options: AesGcmInvitationTokenCipherOptions) {
    this.requireKey(options.activeKeyId);
  }

  encrypt(token: string, context: InvitationTokenCipherContext): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.requireKey(this.options.activeKeyId), iv);
    cipher.setAAD(this.contextAad(context));
    const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      "v1",
      Buffer.from(this.options.activeKeyId, "utf8").toString("base64url"),
      iv.toString("base64url"),
      encrypted.toString("base64url"),
      tag.toString("base64url"),
    ].join(".");
  }

  decrypt(ciphertext: string, context: InvitationTokenCipherContext): string {
    try {
      const parts = ciphertext.split(".");
      if (parts.length !== 5) {
        throw new InvitationTokenCipherProblem("decrypt", "unknown");
      }

      const [version, encodedKeyId, encodedIv, encodedValue, encodedTag] = parts;
      if (
        version !== "v1" ||
        !encodedKeyId ||
        !encodedIv ||
        !encodedValue ||
        !encodedTag ||
        !/^[A-Za-z0-9_-]+$/.test(encodedKeyId)
      ) {
        throw new InvitationTokenCipherProblem("decrypt", "unknown");
      }

      const keyId = Buffer.from(encodedKeyId, "base64url").toString("utf8");
      if (!keyId || Buffer.from(keyId, "utf8").toString("base64url") !== encodedKeyId) {
        throw new InvitationTokenCipherProblem("decrypt", "unknown");
      }

      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.requireKey(keyId),
        Buffer.from(encodedIv, "base64url"),
      );
      decipher.setAAD(this.contextAad(context));
      decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
      return Buffer.concat([
        decipher.update(Buffer.from(encodedValue, "base64url")),
        decipher.final(),
      ]).toString("utf8");
    } catch (error) {
      if (error instanceof InvitationTokenCipherProblem) {
        throw error;
      }
      throw new InvitationTokenCipherProblem("decrypt", "unknown");
    }
  }

  private requireKey(keyId: string): Uint8Array {
    const key = this.options.keys[keyId];
    if (!key || key.byteLength !== 32) {
      throw new InvitationTokenCipherProblem("configure", keyId);
    }
    return key;
  }

  private contextAad(context: InvitationTokenCipherContext): Buffer {
    return Buffer.from(
      JSON.stringify([context.tenantId, context.invitationId, context.idempotencyKey]),
      "utf8",
    );
  }
}
