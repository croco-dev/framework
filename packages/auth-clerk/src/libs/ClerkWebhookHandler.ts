import type { verifyWebhook } from "@clerk/backend/webhooks";
import { deriveWebhookIdempotencyKey, IdempotencyCoordinator } from "@croco/idempotency-core";

import {
  ClerkWebhookDeliveryFailedProblem,
  ClerkWebhookDeliveryInFlightProblem,
  InvalidWebhookPayloadProblem,
  WebhookVerificationProblem,
} from "./problems/ClerkProblems";
import type {
  ClerkMembershipEvent,
  ClerkOrgEvent,
  ClerkUserEvent,
  ClerkWebhookDeliveryOutcome,
  WebhookEventHandler,
  WebhookHandlerOptions,
} from "./types";

type VerifyWebhook = typeof verifyWebhook;
const DEFAULT_IDEMPOTENCY_TTL_MS = 86_400_000;

async function loadVerifyWebhook(): Promise<VerifyWebhook> {
  const module = await import("@clerk/backend/webhooks");
  return module.verifyWebhook;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasStringField(data: Record<string, unknown>, key: string): boolean {
  return typeof data[key] === "string";
}

function isArrayOfObjects(value: unknown): value is Array<Record<string, unknown>> {
  return Array.isArray(value) && value.every((item) => isObjectRecord(item));
}

function isClerkUserEvent(data: unknown): data is ClerkUserEvent {
  return (
    isObjectRecord(data) && hasStringField(data, "id") && isArrayOfObjects(data.email_addresses)
  );
}

function isClerkOrgEvent(data: unknown): data is ClerkOrgEvent {
  return (
    isObjectRecord(data) &&
    hasStringField(data, "id") &&
    hasStringField(data, "name") &&
    hasStringField(data, "slug")
  );
}

function isClerkMembershipEvent(data: unknown): data is ClerkMembershipEvent {
  if (!isObjectRecord(data) || !hasStringField(data, "id") || !hasStringField(data, "role")) {
    return false;
  }

  const organization = data.organization;
  const publicUserData = data.public_user_data;

  if (!isObjectRecord(organization) || !isObjectRecord(publicUserData)) {
    return false;
  }

  return hasStringField(organization, "id") && hasStringField(publicUserData, "user_id");
}

type ParsedWebhookEvent = {
  type: string;
  data: unknown;
};

export class ClerkWebhookHandler {
  private readonly coordinator: IdempotencyCoordinator<ClerkWebhookDeliveryOutcome>;

  constructor(
    private readonly options: WebhookHandlerOptions,
    private readonly handlers: WebhookEventHandler,
  ) {
    this.coordinator = new IdempotencyCoordinator({ store: options.idempotencyStore });
  }

  private parseWebhookEvent(event: unknown): ParsedWebhookEvent {
    if (!isObjectRecord(event) || typeof event.type !== "string") {
      throw new InvalidWebhookPayloadProblem();
    }

    return {
      type: event.type,
      data: event.data,
    };
  }

  private parseUserEvent(data: unknown, eventType: string): ClerkUserEvent {
    if (!isClerkUserEvent(data)) {
      throw new InvalidWebhookPayloadProblem(eventType);
    }
    return data;
  }

  private parseOrgEvent(data: unknown, eventType: string): ClerkOrgEvent {
    if (!isClerkOrgEvent(data)) {
      throw new InvalidWebhookPayloadProblem(eventType);
    }
    return data;
  }

  private parseMembershipEvent(data: unknown, eventType: string): ClerkMembershipEvent {
    if (!isClerkMembershipEvent(data)) {
      throw new InvalidWebhookPayloadProblem(eventType);
    }
    return data;
  }

  async handleWebhook(request: Request): Promise<ClerkWebhookDeliveryOutcome> {
    let event: unknown;
    try {
      const verifyWebhook = await loadVerifyWebhook();
      event = await verifyWebhook(request, { signingSecret: this.options.signingSecret });
    } catch {
      throw new WebhookVerificationProblem();
    }

    const webhookEvent = this.parseWebhookEvent(event);
    const deliveryId = request.headers.get("svix-id")?.trim();
    if (!deliveryId) {
      throw new InvalidWebhookPayloadProblem(webhookEvent.type);
    }

    const idempotencyKey = deriveWebhookIdempotencyKey({
      provider: "clerk",
      eventId: deliveryId,
      namespace: "auth-clerk-webhook",
    });
    const execution = await this.coordinator.execute(
      {
        key: idempotencyKey,
        ttlMs: this.options.idempotencyTtlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS,
        metadata: {
          deliveryId,
          eventType: webhookEvent.type,
          provider: "clerk",
        },
      },
      async () => ({
        deliveryId,
        eventType: webhookEvent.type,
        outcome: await this.dispatchWebhookEvent(webhookEvent),
      }),
    );

    if (execution.outcome === "in-flight") {
      throw new ClerkWebhookDeliveryInFlightProblem(deliveryId, webhookEvent.type);
    }

    if (execution.outcome === "failed") {
      throw new ClerkWebhookDeliveryFailedProblem(deliveryId, webhookEvent.type);
    }

    return execution.response;
  }

  private async dispatchWebhookEvent(
    webhookEvent: ParsedWebhookEvent,
  ): Promise<ClerkWebhookDeliveryOutcome["outcome"]> {
    switch (webhookEvent.type) {
      case "user.created":
        await this.handlers["user.created"]?.(
          this.parseUserEvent(webhookEvent.data, webhookEvent.type),
        );
        break;
      case "user.updated":
        await this.handlers["user.updated"]?.(
          this.parseUserEvent(webhookEvent.data, webhookEvent.type),
        );
        break;
      case "user.deleted":
        await this.handlers["user.deleted"]?.(
          this.parseUserEvent(webhookEvent.data, webhookEvent.type),
        );
        break;
      case "organization.created":
        await this.handlers["organization.created"]?.(
          this.parseOrgEvent(webhookEvent.data, webhookEvent.type),
        );
        break;
      case "organization.updated":
        await this.handlers["organization.updated"]?.(
          this.parseOrgEvent(webhookEvent.data, webhookEvent.type),
        );
        break;
      case "organization.deleted":
        await this.handlers["organization.deleted"]?.(
          this.parseOrgEvent(webhookEvent.data, webhookEvent.type),
        );
        break;
      case "organizationMembership.created":
        await this.handlers["organizationMembership.created"]?.(
          this.parseMembershipEvent(webhookEvent.data, webhookEvent.type),
        );
        break;
      case "organizationMembership.deleted":
        await this.handlers["organizationMembership.deleted"]?.(
          this.parseMembershipEvent(webhookEvent.data, webhookEvent.type),
        );
        break;
      default:
        return "ignored";
    }

    return "handled";
  }
}
