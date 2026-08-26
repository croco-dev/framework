/**
 * @packageDocumentation
 * Public API for declaring and inspecting cron, event, and webhook triggers.
 */

/** Cron trigger metadata key and decorator. */
export { CRON_METADATA_KEY, Cron } from "./libs/decorators/Cron";

/** Event trigger metadata key and decorator. */
export { EVENT_METADATA_KEY, OnEvent } from "./libs/decorators/OnEvent";

/** Webhook trigger metadata key and decorator. */
export { OnWebhook, WEBHOOK_METADATA_KEY } from "./libs/decorators/OnWebhook";

/** Trigger registry APIs and shared metadata key. */
export { TRIGGER_METADATA_KEY, TriggerRegistry, triggerRegistry } from "./libs/TriggerRegistry";

/** Serializable typed trigger references. */
export { defineEventTrigger, defineWebhookTrigger } from "./libs/TriggerRef";

/** Trigger metadata and option types. */
export type {
  AnyTriggerMetadata,
  CronOptions,
  CronTriggerMetadata,
  EventOptions,
  EventTriggerMetadata,
  TriggerMetadata,
  TriggerType,
  WebhookOptions,
  WebhookTriggerMetadata,
} from "./libs/types";

export type { EventTriggerRef, WebhookHttpMethod, WebhookTriggerRef } from "./libs/TriggerRef";
