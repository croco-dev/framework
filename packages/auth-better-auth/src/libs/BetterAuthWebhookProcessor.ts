import { createHmac, timingSafeEqual } from "node:crypto";
import {
  InvalidWebhookPayloadProblem,
  InvalidWebhookSignatureProblem,
} from "./problems/WebhookProblems";
import type {
  BetterAuthSession,
  BetterAuthSessionProvider,
  BetterAuthWebhookHandler,
  BetterAuthWebhookOptions,
} from "./types";

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Better Auth 웹훅 서명 검증과 이벤트 분기를 담당하는 처리기입니다.
 */
export class BetterAuthWebhookProcessor {
  private static readonly SIGNATURE_HEADER = "x-better-auth-signature";

  constructor(
    private options: BetterAuthWebhookOptions,
    private handlers: BetterAuthWebhookHandler,
    _sessionProvider: BetterAuthSessionProvider,
  ) {}

  private verifySignature(rawBody: string, signature: string): boolean {
    if (!signature) {
      return false;
    }

    const expectedSignature = `sha256=${createHmac("sha256", this.options.signingSecret).update(rawBody).digest("hex")}`;
    const actualSignatureBuffer = Buffer.from(signature);
    const expectedSignatureBuffer = Buffer.from(expectedSignature);

    if (actualSignatureBuffer.length !== expectedSignatureBuffer.length) {
      return false;
    }

    return timingSafeEqual(actualSignatureBuffer, expectedSignatureBuffer);
  }

  async processWebhook(request: { headers: Headers; text: () => Promise<string> }): Promise<void> {
    const signature = request.headers.get(BetterAuthWebhookProcessor.SIGNATURE_HEADER) ?? "";
    const rawBody = await request.text();

    if (!this.verifySignature(rawBody, signature)) {
      throw new InvalidWebhookSignatureProblem();
    }

    let body: unknown;

    try {
      body = JSON.parse(rawBody);
    } catch {
      throw new InvalidWebhookPayloadProblem();
    }

    if (!isObjectRecord(body) || typeof body.type !== "string") {
      throw new InvalidWebhookPayloadProblem();
    }

    const eventType = body.type;
    const data = isObjectRecord(body.data) ? body.data : {};

    switch (eventType) {
      case "user.created":
        await this.handlers["user.created"]?.(data);
        break;
      case "user.updated":
        await this.handlers["user.updated"]?.(data);
        break;
      case "user.deleted":
        await this.handlers["user.deleted"]?.(data);
        break;
      case "session.created":
        await this.handlers["session.created"]?.(data);
        break;
      case "session.revoked":
        await this.handlers["session.revoked"]?.(data);
        break;
      default:
        break;
    }
  }
}

/**
 * Better Auth 웹훅 처리에 사용하는 공개 타입들입니다.
 */
export type {
  BetterAuthSession,
  BetterAuthSessionProvider,
  BetterAuthWebhookHandler,
  BetterAuthWebhookOptions,
};
