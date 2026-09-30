import { randomUUID } from "node:crypto";
import { applicationDefault, cert, deleteApp, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { NotificationChannel } from "@croco/notifications-core";
import type {
  PushContent,
  NotificationPayload,
  NotificationProvider,
  NotificationProviderCapabilities,
  NotificationResult,
  NotificationSendOptions,
} from "@croco/notifications-core";
import { recordEvent } from "@croco/telemetry-api";
import { validateFcmConfig } from "./FcmConfig";
import type { FcmConfig } from "./FcmConfig";
import { FcmProblem, normalizeFcmProblem } from "./FcmProblem";

export const FCM_PROVIDER_CAPABILITIES: NotificationProviderCapabilities = Object.freeze({
  providerName: "fcm",
  channels: Object.freeze([NotificationChannel.PUSH]),
  supportsIdempotencyKey: false,
  supportsProviderTemplates: false,
  supportsRenderedTemplates: true,
  outboxIntegration: "consumer-managed",
  terminalEndpointFailureCodes: Object.freeze(["notifications-fcm/token-invalid"]),
});

type FcmMessage = {
  readonly token: string;
  readonly notification: {
    readonly title: string;
    readonly body: string;
    readonly imageUrl?: string;
  };
  readonly data?: Record<string, string>;
  readonly apns: { readonly headers: Record<string, string> };
  readonly webpush: {
    readonly headers: Record<string, string>;
    readonly notification?: { readonly tag: string };
  };
  readonly android: {
    readonly collapseKey?: string;
    readonly ttl?: number;
    readonly priority?: "normal" | "high";
  };
};

export interface FcmClient {
  send(token: string, content: PushContent): Promise<string>;
}

export type FcmProviderOptions = {
  readonly resolveToken?: (reference: string) => Promise<string>;
};

export class FcmProvider implements NotificationProvider {
  private readonly client: FcmClient;
  private readonly dispose?: () => Promise<void>;

  constructor(
    config: FcmConfig,
    client?: FcmClient,
    private readonly options: FcmProviderOptions = {},
  ) {
    const valid = validateFcmConfig(config);
    if (client) {
      this.client = client;
    } else {
      try {
        const app = initializeApp(
          {
            projectId: valid.projectId,
            credential:
              valid.credential.type === "application-default"
                ? applicationDefault()
                : cert({
                    projectId: valid.projectId,
                    clientEmail: valid.credential.clientEmail,
                    privateKey: valid.credential.privateKey,
                  }),
          },
          `croco-fcm-${randomUUID()}`,
        );
        const messaging = getMessaging(app);
        this.client = {
          send: (token, push) =>
            messaging.send(toFcmMessage({ to: token, content: push.body, push })),
        };
        this.dispose = () => deleteApp(app);
      } catch {
        throw new FcmProblem("configuration", "configuration");
      }
    }
  }

  getName(): string {
    return "fcm";
  }
  getChannel(): NotificationChannel {
    return NotificationChannel.PUSH;
  }
  getCapabilities(): NotificationProviderCapabilities {
    return FCM_PROVIDER_CAPABILITIES;
  }
  async close(): Promise<void> {
    await this.dispose?.();
  }

  async sendBatch(payloads: readonly NotificationPayload[]): Promise<NotificationResult[]> {
    const pending = [...payloads];
    const results: NotificationResult[] = [];
    let nextIndex = 0;
    const sendNext = async (): Promise<void> => {
      while (nextIndex < pending.length) {
        const index = nextIndex++;
        results[index] = await this.send(pending[index]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(5, pending.length) }, sendNext));
    return results;
  }

  async send(
    payload: NotificationPayload,
    options?: NotificationSendOptions,
  ): Promise<NotificationResult> {
    try {
      const token = this.options.resolveToken
        ? await this.options.resolveToken(payload.to)
        : payload.to;
      const validated = { ...payload, to: token };
      validateFcmPayload(validated);
      const messageId = await this.client.send(token, validated.push);
      if (typeof messageId !== "string" || !messageId.trim()) throw new FcmProblem("upstream");
      recordEvent("notifications.fcm.send.accepted", {
        "notification.provider": "fcm",
        "notification.idempotency_key.present": options?.idempotencyKey !== undefined,
      });
      return { success: true, messageId };
    } catch (error) {
      const problem = error instanceof FcmProblem ? error : normalizeFcmProblem(error);
      recordEvent("notifications.fcm.send.failed", {
        "notification.provider": "fcm",
        "problem.code": problem.code,
        "notification.idempotency_key.present": options?.idempotencyKey !== undefined,
      });
      return { success: false, problem };
    }
  }
}

function validateFcmPayload(
  payload: NotificationPayload,
): asserts payload is NotificationPayload & { push: PushContent } {
  const push = payload.push;
  if (
    typeof payload.to !== "string" ||
    !payload.to.trim() ||
    !push ||
    typeof push.title !== "string" ||
    !push.title.trim() ||
    typeof push.body !== "string" ||
    !push.body.trim() ||
    (push.ttlSeconds !== undefined &&
      (!Number.isInteger(push.ttlSeconds) || push.ttlSeconds < 0 || push.ttlSeconds > 2419200)) ||
    (push.priority !== undefined && push.priority !== "normal" && push.priority !== "high") ||
    (push.collapseKey !== undefined &&
      (typeof push.collapseKey !== "string" || !push.collapseKey.trim())) ||
    (push.deepLink !== undefined && (typeof push.deepLink !== "string" || !push.deepLink.trim())) ||
    (push.imageUrl !== undefined &&
      (typeof push.imageUrl !== "string" || !/^https?:\/\//.test(push.imageUrl))) ||
    (push.data !== undefined &&
      (typeof push.data !== "object" ||
        push.data === null ||
        Array.isArray(push.data) ||
        Object.entries(push.data).some(
          ([key, value]) =>
            !key ||
            typeof value !== "string" ||
            key === "from" ||
            key === "message_type" ||
            key.startsWith("google.") ||
            key.startsWith("gcm."),
        ))) ||
    (push.deepLink !== undefined && push.data?.deepLink !== undefined)
  ) {
    throw new FcmProblem("validation");
  }
}

function toFcmMessage(payload: NotificationPayload & { push: PushContent }): FcmMessage {
  const push = payload.push;
  return {
    token: payload.to,
    notification: {
      title: push.title,
      body: push.body,
      ...(push.imageUrl === undefined ? {} : { imageUrl: push.imageUrl }),
    },
    ...(push.data === undefined && push.deepLink === undefined
      ? {}
      : {
          data: {
            ...push.data,
            ...(push.deepLink === undefined ? {} : { deepLink: push.deepLink }),
          },
        }),
    apns: {
      headers: {
        ...(push.collapseKey === undefined ? {} : { "apns-collapse-id": push.collapseKey }),
        ...(push.ttlSeconds === undefined
          ? {}
          : {
              "apns-expiration": String(
                push.ttlSeconds === 0 ? 0 : Math.floor(Date.now() / 1000) + push.ttlSeconds,
              ),
            }),
        ...(push.priority === undefined
          ? {}
          : { "apns-priority": push.priority === "high" ? "10" : "5" }),
      },
    },
    webpush: {
      headers: {
        ...(push.ttlSeconds === undefined ? {} : { TTL: String(push.ttlSeconds) }),
        ...(push.priority === undefined ? {} : { Urgency: push.priority }),
      },
      ...(push.collapseKey === undefined ? {} : { notification: { tag: push.collapseKey } }),
    },
    android: {
      ...(push.collapseKey === undefined ? {} : { collapseKey: push.collapseKey }),
      ...(push.ttlSeconds === undefined ? {} : { ttl: push.ttlSeconds * 1000 }),
      ...(push.priority === undefined ? {} : { priority: push.priority }),
    },
  };
}
