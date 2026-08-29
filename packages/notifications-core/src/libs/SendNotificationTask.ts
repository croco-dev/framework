import { Component } from "@croco/framework-context";
import { Task } from "@croco/tasks-core";
import { recordError, recordEvent } from "@croco/telemetry-api";
import type { Problem } from "@croco/problems-core";
// Runtime value required for constructor metadata.
// oxlint-disable-next-line typescript/consistent-type-imports
import { NotificationProviderRegistry } from "./NotificationProviderRegistry";
import {
  NotificationProviderNotFoundProblem,
  NotificationSendMaxAttemptsInvalidProblem,
} from "./problems/NotificationProblems";
import type { NotificationJobPayload, NotificationPayload, NotificationProvider } from "./types";

function parseMaxAttempts(envValue: string | undefined, defaultValue: number): number {
  if (envValue === undefined) return defaultValue;

  const parsed = Number(envValue);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
    throw new NotificationSendMaxAttemptsInvalidProblem(envValue);
  }

  return parsed;
}

const SEND_NOTIFICATION_MAX_ATTEMPTS = parseMaxAttempts(
  process.env.NOTIFICATIONS_SEND_MAX_ATTEMPTS,
  3,
);

@Component()
export class SendNotificationTask {
  constructor(private registry: NotificationProviderRegistry) {}

  registerProvider(provider: NotificationProvider) {
    this.registry.registerProvider(provider);
  }

  @Task({
    name: "send-notification",
    maxAttempts: SEND_NOTIFICATION_MAX_ATTEMPTS,
  })
  async handle(payload: NotificationJobPayload): Promise<void> {
    const { providerName, idempotencyKey } = payload;
    const notificationPayload = toProviderPayload(payload);

    const provider = this.registry.getProvider(providerName);
    if (!provider) {
      const problem = new NotificationProviderNotFoundProblem(providerName);

      recordNotificationDispatchFailure(payload, problem);
      throw problem;
    }

    const result =
      idempotencyKey === undefined
        ? await provider.send(notificationPayload)
        : await provider.send(notificationPayload, { idempotencyKey });

    if (!result.success) {
      recordNotificationDispatchFailure(payload, result.problem);
      throw result.problem;
    }

    recordNotificationDispatchSuccess(payload);
  }
}

function toProviderPayload(payload: NotificationJobPayload): NotificationPayload {
  return {
    to: payload.to,
    ...(payload.subject === undefined ? {} : { subject: payload.subject }),
    content: payload.content,
    ...(payload.headers === undefined ? {} : { headers: payload.headers }),
    ...(payload.metadata === undefined ? {} : { metadata: payload.metadata }),
    ...(payload.templateId === undefined ? {} : { templateId: payload.templateId }),
    ...(payload.templateVersion === undefined ? {} : { templateVersion: payload.templateVersion }),
    ...(payload.locale === undefined ? {} : { locale: payload.locale }),
    ...(payload.variables === undefined ? {} : { variables: payload.variables }),
  };
}

function recordNotificationDispatchSuccess(payload: NotificationJobPayload): void {
  recordEvent("notifications.dispatch.succeeded", toNotificationDispatchTelemetry(payload));
}

function recordNotificationDispatchFailure(payload: NotificationJobPayload, error: Problem): void {
  recordEvent("notifications.dispatch.failed", {
    ...toNotificationDispatchTelemetry(payload),
    "problem.code": error.code,
    "problem.category": error.category,
  });
  recordError(error);
}

function toNotificationDispatchTelemetry(
  payload: NotificationJobPayload,
): Record<string, string | number | boolean> {
  const attributes: Record<string, string | number | boolean> = {
    "notification.provider": payload.providerName,
    "notification.idempotency_key.present": payload.idempotencyKey !== undefined,
    "notification.outbox.present": payload.outbox !== undefined,
  };
  const channel = payload.dispatchContext?.channel;

  if (channel !== undefined) {
    attributes["notification.channel"] = channel;
  }

  if (payload.templateId !== undefined) {
    attributes["notification.template.id"] = payload.templateId;
  }

  if (payload.templateVersion !== undefined) {
    attributes["notification.template.version"] = payload.templateVersion;
  }

  if (payload.locale !== undefined) {
    attributes["notification.template.locale"] = payload.locale;
  }

  const preferenceDecision = payload.dispatchContext?.preferenceDecision;

  if (preferenceDecision !== undefined) {
    attributes["notification.preference.allowed"] = preferenceDecision.allowed;
    attributes["notification.preference.reason"] = preferenceDecision.reason;
    attributes["notification.preference.evaluation_key"] = preferenceDecision.evaluationKey;

    if (preferenceDecision.ruleId !== undefined) {
      attributes["notification.preference.rule_id"] = preferenceDecision.ruleId;
    }
  }

  return attributes;
}
