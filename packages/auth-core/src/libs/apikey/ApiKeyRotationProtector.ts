import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { Token } from "@croco/framework-context";
import { Problem, ProblemCategory } from "@croco/problems-core";

export interface ApiKeyRotationProtector {
  encrypt(rawKey: string, context: ApiKeyRotationProtectionContext): string;
  decrypt(ciphertext: string, context: ApiKeyRotationProtectionContext): string;
}

export const API_KEY_ROTATION_PROTECTOR_TOKEN = new Token<ApiKeyRotationProtector>(
  "API_KEY_ROTATION_PROTECTOR",
);

export type AesGcmApiKeyRotationProtectorOptions = {
  activeKeyId: string;
  keys: Readonly<Record<string, Uint8Array>>;
};

export type ApiKeyRotationProtectionContext = {
  oldKeyId: string;
  newKeyId: string;
  tenantId: string;
  idempotencyKey: string;
};

export class ApiKeyRotationProtectionProblem extends Problem {
  constructor(operation: "configure" | "encrypt" | "decrypt", keyId: string) {
    super(
      "auth-core/api-key-rotation-protection-failed",
      ProblemCategory.InternalServerError,
      "API key rotation recovery material could not be protected",
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
 * Rotation-capable AES-256-GCM protection for replayable API key rotations.
 *
 * Ciphertexts carry the key ID used to encrypt them. Keep old protection keys configured
 * for as long as rotation records encrypted with them must remain replayable.
 */
export class AesGcmApiKeyRotationProtector implements ApiKeyRotationProtector {
  constructor(private readonly options: AesGcmApiKeyRotationProtectorOptions) {
    this.requireKey(options.activeKeyId);
  }

  encrypt(rawKey: string, context: ApiKeyRotationProtectionContext): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.requireKey(this.options.activeKeyId), iv);
    cipher.setAAD(this.contextAad(context));
    const encrypted = Buffer.concat([cipher.update(rawKey, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      "v1",
      Buffer.from(this.options.activeKeyId, "utf8").toString("base64url"),
      iv.toString("base64url"),
      encrypted.toString("base64url"),
      tag.toString("base64url"),
    ].join(".");
  }

  decrypt(ciphertext: string, context: ApiKeyRotationProtectionContext): string {
    try {
      const parts = ciphertext.split(".");
      if (parts.length !== 5) {
        throw new ApiKeyRotationProtectionProblem("decrypt", "unknown");
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
        throw new ApiKeyRotationProtectionProblem("decrypt", "unknown");
      }

      const keyId = Buffer.from(encodedKeyId, "base64url").toString("utf8");
      if (!keyId || Buffer.from(keyId, "utf8").toString("base64url") !== encodedKeyId) {
        throw new ApiKeyRotationProtectionProblem("decrypt", "unknown");
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
      if (error instanceof ApiKeyRotationProtectionProblem) {
        throw error;
      }
      throw new ApiKeyRotationProtectionProblem("decrypt", "unknown");
    }
  }

  private requireKey(keyId: string): Uint8Array {
    const key = this.options.keys[keyId];
    if (!key || key.byteLength !== 32) {
      throw new ApiKeyRotationProtectionProblem("configure", keyId);
    }
    return key;
  }

  private contextAad(context: ApiKeyRotationProtectionContext): Buffer {
    return Buffer.from(
      JSON.stringify([
        context.oldKeyId,
        context.newKeyId,
        context.tenantId,
        context.idempotencyKey,
      ]),
      "utf8",
    );
  }
}
