/**
 * Trigger types supported by the triggers-core package.
 */
export type TriggerType = "cron" | "event" | "webhook";

/**
 * Base trigger metadata interface.
 */
export type TriggerMetadata = {
  readonly type: TriggerType;
  readonly methodName: string | symbol;
  readonly target: object;
};

/**
 * Cron trigger metadata.
 */
export type CronTriggerMetadata = TriggerMetadata & {
  readonly type: "cron";
  readonly expression: string;
  readonly options?: CronOptions;
};

/**
 * Event trigger metadata.
 */
export type EventTriggerMetadata = TriggerMetadata & {
  readonly type: "event";
  readonly event: string;
  readonly options?: EventOptions;
};

/**
 * Webhook trigger metadata.
 */
export type WebhookTriggerMetadata = TriggerMetadata & {
  readonly type: "webhook";
  readonly path: string;
  readonly method: string;
  readonly options?: WebhookOptions;
};

/**
 * Union type for all trigger metadata types.
 */
export type AnyTriggerMetadata =
  | CronTriggerMetadata
  | EventTriggerMetadata
  | WebhookTriggerMetadata;

/**
 * Options for cron triggers.
 */
export type CronOptions = {
  /**
   * Human-readable name for this cron trigger.
   */
  readonly name?: string;

  /**
   * Description of what this trigger does.
   */
  readonly description?: string;

  /**
   * Whether the trigger is enabled (default: true).
   */
  readonly enabled?: boolean;

  /**
   * Timezone for the cron expression (default: UTC).
   */
  readonly timezone?: string;
};

/**
 * Options for event triggers.
 */
export type EventOptions = {
  /**
   * Human-readable name for this event handler.
   */
  readonly name?: string;

  /**
   * Description of what this event handler does.
   */
  readonly description?: string;

  /**
   * Whether the handler is enabled (default: true).
   */
  readonly enabled?: boolean;

  /**
   * Maximum number of concurrent executions (default: 1).
   */
  readonly concurrency?: number;

  /**
   * Timeout in milliseconds (default: 30000).
   */
  readonly timeout?: number;
};

/**
 * Options for webhook triggers.
 */
export type WebhookOptions = {
  /**
   * Human-readable name for this webhook handler.
   */
  readonly name?: string;

  /**
   * Description of what this webhook handler does.
   */
  readonly description?: string;

  /**
   * Whether the handler is enabled (default: true).
   */
  readonly enabled?: boolean;

  /**
   * Whether to require authentication (default: false).
   */
  readonly auth?: boolean;

  /**
   * CORS configuration for the webhook endpoint.
   */
  readonly cors?: {
    readonly origin?: string | string[];
    readonly methods?: string[];
    readonly allowedHeaders?: string[];
  };
};
