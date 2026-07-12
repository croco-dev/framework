import type { BillingStore, Subscription } from "@croco/billing-core";
import { WebhookAlreadyProcessedProblem } from "@croco/billing-core";
import type { EventPublisher } from "@croco/events-core";
import { Trace } from "@croco/telemetry-api";
import { validateEvent } from "@polar-sh/sdk/webhooks";
import { ZodError } from "zod";
import type { PolarConfig, WebhookHandlerResult } from "../types";
import { PolarEventMapper } from "./PolarEventMapper";
import { BillingStatusMappingProblem } from "./problems/BillingStatusMappingProblem";
import { validatePolarConfig } from "./problems/PolarBillingProblems";
import { WebhookProcessingProblem } from "./problems/WebhookProcessingProblem";
import { WebhookValidationProblem } from "./problems/WebhookValidationProblem";
import type { PolarEvent, PolarSubscriptionData } from "./schemas/polarWebhookSchema";
import {
  PolarEventSchema,
  PolarOrderDataSchema,
  PolarSubscriptionDataSchema,
} from "./schemas/polarWebhookSchema";

export type WebhookDependencies = {
  store: BillingStore;
  eventPublisher: EventPublisher;
};

type PolarSubscriptionEventType =
  | "subscription.created"
  | "subscription.updated"
  | "subscription.active"
  | "subscription.canceled"
  | "subscription.revoked"
  | "subscription.past_due";

type PolarOrderEventType = "order.paid" | "order.created" | "order.updated";

type ParsedSubscriptionPayload = {
  id: string;
  tenantId: string;
  productId: string;
  rawStatus: PolarSubscriptionData["status"];
  status: Subscription["status"];
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
};

type ParsedOrderPayload = {
  id: string;
  tenantId: string;
  amount: number;
  currency: string;
  paidAt: Date;
};

type ParsedWebhookEvent =
  | {
      kind: "subscription";
      eventType: PolarSubscriptionEventType;
      payload: ParsedSubscriptionPayload;
    }
  | {
      kind: "order";
      eventType: PolarOrderEventType;
      payload: ParsedOrderPayload;
    }
  | {
      kind: "ignored";
    };

export class PolarWebhookHandler {
  private readonly store: BillingStore;
  private readonly eventPublisher: EventPublisher;
  private readonly eventMapper: PolarEventMapper;
  private readonly webhookSecret: string;
  private static readonly inFlightEvents = new Map<string, Promise<WebhookHandlerResult>>();

  constructor(config: PolarConfig, deps: WebhookDependencies) {
    this.webhookSecret = validatePolarConfig(config).webhookSecret;
    this.store = deps.store;
    this.eventPublisher = deps.eventPublisher;
    this.eventMapper = new PolarEventMapper();
  }

  @Trace({ name: "polar.webhook.handle" })
  async handle(
    body: Buffer | string,
    headers: Record<string, string>,
  ): Promise<WebhookHandlerResult> {
    let event: unknown;
    try {
      event = validateEvent(body, headers, this.webhookSecret);
    } catch (error) {
      const reason = sanitizeWebhookValidationReason(
        error instanceof Error ? error.message : "Unknown error",
        [this.webhookSecret],
      );
      throw new WebhookValidationProblem(reason);
    }

    let parsedEvent: PolarEvent;
    try {
      parsedEvent = PolarEventSchema.parse(event);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new WebhookValidationProblem(`Invalid webhook payload: ${formatZodError(error)}`);
      }
      throw new WebhookValidationProblem("Invalid webhook payload");
    }

    const eventId = parsedEvent.id ?? headers["webhook-id"];
    const eventType = parsedEvent.type;

    if (!eventId || !eventType) {
      throw new WebhookValidationProblem("Missing event ID or type");
    }

    const parsedWebhookEvent = this.parseSignedEventPayload(eventType, parsedEvent.data);

    const inFlightEvent = PolarWebhookHandler.inFlightEvents.get(eventId);
    if (inFlightEvent) {
      return inFlightEvent;
    }

    const processingEvent = this.processEventAtomically(eventId, eventType, parsedWebhookEvent);
    PolarWebhookHandler.inFlightEvents.set(eventId, processingEvent);

    try {
      return await processingEvent;
    } finally {
      PolarWebhookHandler.inFlightEvents.delete(eventId);
    }
  }

  private async processEventAtomically(
    eventId: string,
    eventType: string,
    parsedEvent: ParsedWebhookEvent,
  ): Promise<WebhookHandlerResult> {
    let rollbackErrorMessage: string | null = null;

    const shouldProcess = await this.reserveWebhook(eventId, eventType);
    if (!shouldProcess) {
      return { success: true, eventId };
    }

    try {
      await this.processParsedEvent(parsedEvent);
      await this.store.completeWebhook(eventId);

      return { success: true, eventId };
    } catch (error) {
      rollbackErrorMessage = await this.tryRollbackWebhook(eventId);
      const baseErrorMessage = `Event processing failed: ${this.getErrorMessage(error)}`;

      return {
        success: false,
        eventId,
        error: rollbackErrorMessage
          ? `${baseErrorMessage}; rollback failed: ${rollbackErrorMessage}`
          : baseErrorMessage,
      };
    }
  }

  private async reserveWebhook(eventId: string, eventType: string): Promise<boolean> {
    try {
      await this.store.reserveWebhook(eventId, eventType);
      return true;
    } catch (error) {
      if (error instanceof WebhookAlreadyProcessedProblem) {
        return false;
      }
      if (error instanceof Error) {
        throw new WebhookProcessingProblem("Webhook reservation failed", error);
      }
      const cause = new Error("Billing store rejected webhook reservation with a non-Error value");
      Object.defineProperty(cause, "cause", { value: error });
      throw new WebhookProcessingProblem("Webhook reservation failed", cause);
    }
  }

  private async processParsedEvent(event: ParsedWebhookEvent): Promise<void> {
    if (event.kind === "subscription") {
      await this.handleSubscriptionEvent(event.eventType, event.payload);
      return;
    }

    if (event.kind === "order") {
      await this.handleOrderEvent(event.eventType, event.payload);
    }
  }

  private parseEvent(eventType: string, data: unknown): ParsedWebhookEvent {
    if (eventType.startsWith("subscription.")) {
      return {
        kind: "subscription",
        eventType: eventType as PolarSubscriptionEventType,
        payload: this.parseSubscriptionPayload(data),
      };
    }

    if (eventType.startsWith("order.")) {
      return {
        kind: "order",
        eventType: eventType as PolarOrderEventType,
        payload: this.parseOrderPayload(data),
      };
    }

    return { kind: "ignored" };
  }

  private parseSignedEventPayload(eventType: string, data: unknown): ParsedWebhookEvent {
    try {
      return this.parseEvent(eventType, data);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new WebhookValidationProblem(`Invalid webhook payload: ${formatZodError(error)}`);
      }
      throw error;
    }
  }

  private parseSubscriptionPayload(data: unknown): ParsedSubscriptionPayload {
    const subscriptionData = PolarSubscriptionDataSchema.parse(data);

    const status = this.mapStatus(subscriptionData.status);

    return {
      id: subscriptionData.id,
      tenantId: this.extractTenantId(subscriptionData.customer),
      productId: subscriptionData.product?.id ?? "",
      rawStatus: subscriptionData.status,
      status,
      currentPeriodEnd: this.resolveCurrentPeriodEnd(subscriptionData.currentPeriodEnd),
      cancelAtPeriodEnd: Boolean(subscriptionData.cancelAtPeriodEnd),
    };
  }
  private parseOrderPayload(data: unknown): ParsedOrderPayload {
    const orderData = PolarOrderDataSchema.parse(data);

    if (typeof orderData.amount !== "number" || Number.isNaN(orderData.amount)) {
      throw new WebhookProcessingProblem("Order amount is invalid");
    }

    if (!this.isNonEmptyString(orderData.currency)) {
      throw new WebhookProcessingProblem("Order currency is required");
    }

    return {
      id: orderData.id,
      tenantId: this.extractTenantId(orderData.customer),
      amount: orderData.amount,
      currency: orderData.currency,
      paidAt: this.resolvePaidAt(orderData.createdAt),
    };
  }
  private extractTenantId(customer?: {
    externalId?: string | null;
    metadata?: Record<string, unknown> | null;
  }): string {
    if (!customer) {
      throw new WebhookProcessingProblem("Customer payload is required");
    }

    if (this.isNonEmptyString(customer.externalId)) {
      return customer.externalId;
    }

    const metadataTenantId = customer.metadata?.tenantId;
    if (this.isNonEmptyString(metadataTenantId)) {
      return metadataTenantId;
    }

    throw new WebhookProcessingProblem(
      "Customer externalId (tenantId) not found in webhook payload",
    );
  }
  private resolvePaidAt(createdAt: unknown): Date {
    if (createdAt === null || createdAt === undefined) {
      return new Date();
    }

    if (createdAt instanceof Date || this.isNonEmptyString(createdAt)) {
      const paidAt = new Date(createdAt);
      if (Number.isNaN(paidAt.getTime())) {
        throw new WebhookProcessingProblem("Order createdAt is invalid");
      }
      return paidAt;
    }

    throw new WebhookProcessingProblem("Order createdAt is invalid");
  }
  private resolveCurrentPeriodEnd(currentPeriodEnd: Date | string | null | undefined): Date {
    if (currentPeriodEnd === null || currentPeriodEnd === undefined) {
      throw new WebhookProcessingProblem("currentPeriodEnd is required");
    }

    const parsedCurrentPeriodEnd = new Date(currentPeriodEnd);
    if (Number.isNaN(parsedCurrentPeriodEnd.getTime())) {
      throw new WebhookProcessingProblem("currentPeriodEnd is invalid");
    }

    return parsedCurrentPeriodEnd;
  }
  private async handleSubscriptionEvent(
    eventType: string,
    payload: ParsedSubscriptionPayload,
  ): Promise<void> {
    const previousSubscription = await this.store.findSubscription(payload.tenantId);
    const previousPlanId = previousSubscription?.planId;

    const subscription: Subscription = {
      id: payload.id,
      billingAccountId: payload.tenantId,
      externalSubscriptionId: payload.id,
      planId: payload.productId,
      status: payload.status,
      currentPeriodEnd: payload.currentPeriodEnd,
      cancelAtPeriodEnd: payload.cancelAtPeriodEnd,
      lastSyncedAt: new Date(),
    };
    await this.store.saveSubscription(subscription);

    const domainEvents = this.eventMapper.mapSubscriptionEvent(
      eventType,
      payload.tenantId,
      {
        id: payload.id,
        productId: payload.productId,
        status: payload.rawStatus,
        cancelAtPeriodEnd: payload.cancelAtPeriodEnd,
      },
      previousPlanId,
    );

    for (const event of domainEvents) {
      await this.eventPublisher.publishNow(event);
    }
  }

  private async handleOrderEvent(eventType: string, payload: ParsedOrderPayload): Promise<void> {
    await this.store.saveOrder({
      id: payload.id,
      billingAccountId: payload.tenantId,
      externalOrderId: payload.id,
      amount: payload.amount,
      currency: payload.currency,
      reason: "subscription_cycle",
      paidAt: payload.paidAt,
    });

    const domainEvents = this.eventMapper.mapOrderEvent(eventType, payload.tenantId, {
      id: payload.id,
      amount: payload.amount,
      currency: payload.currency,
    });

    for (const event of domainEvents) {
      await this.eventPublisher.publishNow(event);
    }
  }

  private mapStatus(
    polarStatus: string,
  ): "active" | "past_due" | "canceled" | "revoked" | "trialing" {
    switch (polarStatus) {
      case "active":
        return "active";
      case "past_due":
        return "past_due";
      case "canceled":
        return "canceled";
      case "revoked":
        return "revoked";
      case "trialing":
        return "trialing";
      default:
        throw new BillingStatusMappingProblem(polarStatus);
    }
  }
  private async tryRollbackWebhook(eventId: string): Promise<string | null> {
    try {
      await this.store.failWebhook(eventId);
      return null;
    } catch (error) {
      return this.getErrorMessage(error);
    }
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Unknown error";
  }

  private isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.length > 0;
  }
}

function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "<root>";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

const SENSITIVE_WEBHOOK_KEY_VALUE_PATTERN =
  /(["']?\b(?:webhook[-_]?secret|webhook[-_]?signature|webhookSecret|webhookSignature|signature)\b["']?\s*[:=]\s*)(["']?)([^"';\s{}]+)(["']?)/gi;

function sanitizeWebhookValidationReason(
  reason: string,
  sensitiveValues: readonly string[],
): string {
  let sanitized = reason;

  for (const value of sensitiveValues) {
    if (value.length > 0) {
      sanitized = sanitized.split(value).join("[redacted]");
    }
  }

  return sanitized.replace(
    SENSITIVE_WEBHOOK_KEY_VALUE_PATTERN,
    (_match, prefix: string, openQuote: string, _value: string, closeQuote: string) =>
      `${prefix}${openQuote}[redacted]${closeQuote}`,
  );
}
