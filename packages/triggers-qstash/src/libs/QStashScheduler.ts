import type { ExecutionManager } from "@croco/execution-core";
import { ProblemFactory } from "@croco/problems-core";
import type { CronTriggerMetadata } from "@croco/triggers-core";
import { triggerRegistry } from "@croco/triggers-core";
import type { Client, Schedule } from "@upstash/qstash";

const SCHEDULE_NAMESPACE_DELIMITER = ":";
const SCHEDULE_OWNER_VERSION = "croco:triggers-qstash:v1";
const SCHEDULE_MIGRATION_REQUIRED_CODE = "triggers-qstash/schedule-migration-required";
const ORPHAN_CLEANUP_NOT_APPLIED_CODE = "triggers-qstash/orphan-cleanup-not-applied";

/**
 * Configuration options for QStashScheduler.
 */
export type QStashSchedulerOptions = {
  /**
   * QStash HTTP client instance.
   */
  readonly client: Client;

  /**
   * Base URL for the webhook endpoint that receives QStash triggers.
   * This URL will be called when a scheduled job is triggered.
   *
   * Example: 'https://api.example.com/webhooks/qstash'
   */
  readonly webhookUrl: string;

  /**
   * Optional prefix for schedule names in QStash.
   * Defaults to 'croco-trigger'.
   *
   * Used to uniquely identify schedules created by this scheduler.
   */
  readonly schedulePrefix?: string;

  /**
   * Optional execution manager for dispatching executions.
   * If provided, the scheduler can create executions when syncing schedules.
   */
  readonly executionManager?: ExecutionManager;

  /**
   * Default sync mode. Defaults to 'apply' for backwards compatibility.
   */
  readonly mode?: ScheduleSyncMode;
};

/**
 * `apply` creates and updates schedules but preserves orphans.
 * `apply-with-orphan-cleanup` also deletes canonical, ownership-marked orphans.
 */
export type ScheduleSyncMode = "dry-run" | "apply" | "apply-with-orphan-cleanup";

export type ScheduleSyncOptions = {
  /**
   * Whether sync should only return the diff or also apply it to QStash.
   */
  readonly mode?: ScheduleSyncMode;
};

/**
 * Result of a schedule sync operation.
 */
export type ScheduleSyncResult = {
  readonly mode: ScheduleSyncMode;

  readonly applied: boolean;

  /**
   * Number of schedules created.
   */
  created: number;

  /**
   * Number of schedules updated.
   */
  updated: number;

  /**
   * Number of schedules deleted (removed from code but still in QStash).
   */
  deleted: number;

  /**
   * Number of schedules skipped (already in sync).
   */
  skipped: number;

  failed: number;

  /**
   * Details of all schedules processed.
   */
  details: ScheduleSyncDetail[];
};

/**
 * Detail of a single schedule sync operation.
 */
export type ScheduleSyncDetail = {
  /**
   * Schedule name/ID.
   */
  readonly name: string;

  readonly action: "created" | "updated" | "deleted" | "skipped" | "failed";

  readonly applied: boolean;

  /**
   * Cron expression.
   */
  readonly expression: string;

  readonly currentExpression?: string;

  /**
   * Target class name.
   */
  readonly target: string;

  /**
   * Target method name.
   */
  readonly method: string;

  /**
   * Error message if operation failed.
   */
  readonly error?: string;

  readonly code?: string;

  readonly retryable?: boolean;

  readonly upstreamStatus?: number;
};

/**
 * QStashScheduler manages cron-based triggers using QStash's scheduling API.
 *
 * This scheduler reads @Cron metadata from triggerRegistry and syncs
 * the schedules with QStash. It handles:
 * - Creating new schedules for @Cron decorated methods
 * - Updating existing schedules when cron expressions change
 * - Deleting schedules that are no longer in code
 * - Generating unique schedule IDs based on target class and method name
 */
export class QStashScheduler {
  private readonly client: Client;
  private readonly webhookUrl: string;
  private readonly schedulePrefix: string;
  private readonly scheduleNamespace: string;
  private readonly ownershipMarker: string;
  private readonly executionManager?: ExecutionManager;
  private readonly mode: ScheduleSyncMode;

  constructor(options: QStashSchedulerOptions) {
    assertScheduleSyncMode(options.mode);
    this.client = options.client;
    this.webhookUrl = options.webhookUrl;
    this.schedulePrefix = options.schedulePrefix ?? "croco-trigger";
    this.scheduleNamespace = `${this.schedulePrefix}${SCHEDULE_NAMESPACE_DELIMITER}`;
    this.ownershipMarker = `${SCHEDULE_OWNER_VERSION}:${encodeURIComponent(this.schedulePrefix)}`;
    this.executionManager = options.executionManager;
    this.mode = options.mode ?? "apply";
  }

  /**
   * Sync all cron triggers with QStash.
   *
   * This method compares the schedules defined in code (@Cron decorators)
   * with the schedules currently in QStash, and creates/updates/deletes as needed.
   *
   * @returns Sync result with counts and details
   */
  async sync(options: ScheduleSyncOptions = {}): Promise<ScheduleSyncResult> {
    assertScheduleSyncMode(options.mode);
    const mode = options.mode ?? this.mode;
    const cronTriggers = this.getAllCronTriggers();
    const scheduleMap = this.buildScheduleMap(cronTriggers);

    // Get existing schedules from QStash
    const discovery = await this.listQStashSchedules();

    const result: ScheduleSyncResult = {
      mode,
      applied: mode !== "dry-run",
      created: 0,
      updated: 0,
      deleted: 0,
      skipped: 0,
      failed: 0,
      details: [],
    };

    for (const detail of discovery.malformed) {
      result.details.push(detail);
      result.skipped++;
    }

    // Create or update schedules
    for (const [scheduleId, metadata] of scheduleMap.entries()) {
      const existing = discovery.canonical.get(scheduleId);
      const detail = await this.syncSchedule(scheduleId, metadata, existing, mode);
      const reportedDetail =
        existing &&
        !discovery.ownedIds.has(scheduleId) &&
        (detail.action === "skipped" || (mode === "dry-run" && detail.action === "updated"))
          ? {
              ...detail,
              code: SCHEDULE_MIGRATION_REQUIRED_CODE,
              error:
                "Schedule ownership marker is missing or does not match this scheduler; migrate it before cleanup.",
            }
          : detail;
      result.details.push(reportedDetail);

      switch (reportedDetail.action) {
        case "created":
          result.created++;
          break;
        case "updated":
          result.updated++;
          break;
        case "skipped":
          result.skipped++;
          break;
        case "failed":
          result.failed++;
          break;
      }
    }

    // Delete schedules that are no longer in code
    for (const [scheduleId, existing] of discovery.canonical.entries()) {
      if (!scheduleMap.has(scheduleId)) {
        if (!discovery.ownedIds.has(scheduleId)) {
          result.details.push(
            createPreservedScheduleDetail(
              scheduleId,
              existing,
              "Schedule ownership marker is missing or does not match this scheduler; migrate it before cleanup.",
            ),
          );
          result.skipped++;
          continue;
        }

        const detail = await this.syncOrphanSchedule(scheduleId, existing, mode);
        result.details.push(detail);

        if (detail.action === "deleted") {
          result.deleted++;
          continue;
        }

        if (detail.action === "skipped") {
          result.skipped++;
        } else {
          result.failed++;
        }
      }
    }

    return result;
  }

  /**
   * Get all cron triggers from the trigger registry.
   */
  private getAllCronTriggers(): CronTriggerMetadata[] {
    const allTriggers = triggerRegistry.getAllTriggers();
    const cronTriggers: CronTriggerMetadata[] = [];

    for (const [, triggers] of allTriggers.entries()) {
      for (const [, metadata] of triggers.entries()) {
        if (metadata.type === "cron") {
          cronTriggers.push(metadata as CronTriggerMetadata);
        }
      }
    }

    return cronTriggers;
  }

  /**
   * Build a map of schedule IDs to cron metadata.
   *
   * Schedule ID format: {prefix}:{className}:{methodName}
   */
  private buildScheduleMap(triggers: CronTriggerMetadata[]): Map<string, CronTriggerMetadata> {
    const map = new Map<string, CronTriggerMetadata>();

    for (const trigger of triggers) {
      const scheduleId = this.generateScheduleId(trigger);

      if (map.has(scheduleId)) {
        throw ProblemFactory.internalServerError(
          "triggers-qstash/duplicate-schedule-id",
          `Duplicate QStash schedule ID detected: ${scheduleId}`,
        );
      }

      map.set(scheduleId, trigger);
    }

    return map;
  }

  /**
   * Generate a unique schedule ID for a cron trigger.
   */
  private generateScheduleId(trigger: CronTriggerMetadata): string {
    const methodName = String(trigger.methodName);
    const triggerName = this.getTriggerIdentifier(trigger);
    const className = trigger.target.constructor.name;
    return `${this.scheduleNamespace}${className}:${triggerName}:${methodName}`;
  }

  /**
   * List all schedules from QStash that belong to this scheduler.
   *
   * Note: QStash API may not support filtering by prefix.
   * This implementation fetches all schedules and filters client-side.
   * For production with many schedules, consider maintaining a local cache.
   */
  private async listQStashSchedules(): Promise<ScheduleDiscovery> {
    const canonical = new Map<string, ExistingSchedule>();
    const ownedIds = new Set<string>();
    const malformed: ScheduleSyncDetail[] = [];

    const response = await this.client.schedules.list();

    for (const schedule of response) {
      const scheduleId = schedule.scheduleId;
      if (!scheduleId?.startsWith(this.scheduleNamespace)) {
        continue;
      }

      const existing = { cron: schedule.cron ?? "" };
      if (!isCanonicalScheduleId(scheduleId, this.scheduleNamespace)) {
        malformed.push(
          createPreservedScheduleDetail(
            scheduleId,
            existing,
            "Malformed or legacy schedule ID preserved; migrate it to the canonical namespace format.",
          ),
        );
        continue;
      }

      canonical.set(scheduleId, existing);
      if (scheduleHasOwnershipMarker(schedule, this.ownershipMarker)) {
        ownedIds.add(scheduleId);
      }
    }

    return { canonical, ownedIds, malformed };
  }

  /**
   * Sync a single schedule with QStash.
   */
  private async syncSchedule(
    scheduleId: string,
    metadata: CronTriggerMetadata,
    existing?: { cron: string },
    mode: ScheduleSyncMode = "apply",
  ): Promise<ScheduleSyncDetail> {
    const methodName = String(metadata.methodName);
    const triggerName = this.getTriggerIdentifier(metadata);
    const baseDetail: ScheduleSyncDetail = {
      name: scheduleId,
      action: "skipped",
      applied: false,
      expression: metadata.expression,
      currentExpression: existing?.cron,
      target: triggerName,
      method: methodName,
    };

    // Build payload for webhook
    const payload = this.buildPayload(metadata);

    try {
      if (!existing) {
        if (mode === "dry-run") {
          return { ...baseDetail, action: "created" };
        }

        await this.client.schedules.create({
          scheduleId,
          cron: metadata.expression,
          destination: this.webhookUrl,
          method: "POST" as const,
          label: this.ownershipMarker,
          headers: {
            "Content-Type": "application/json",
            "X-Schedule-Id": scheduleId,
          },
          body: JSON.stringify(payload),
        });

        return { ...baseDetail, action: "created", applied: true };
      }

      if (existing.cron !== metadata.expression) {
        if (mode === "dry-run") {
          return { ...baseDetail, action: "updated" };
        }

        await this.client.schedules.create({
          scheduleId,
          cron: metadata.expression,
          destination: this.webhookUrl,
          method: "POST" as const,
          label: this.ownershipMarker,
          headers: {
            "Content-Type": "application/json",
            "X-Schedule-Id": scheduleId,
          },
          body: JSON.stringify(payload),
        });

        return { ...baseDetail, action: "updated", applied: true };
      }

      return baseDetail;
    } catch (error) {
      return { ...baseDetail, action: "failed", ...createScheduleFailureDetail(error) };
    }
  }

  /**
   * Delete a schedule from QStash.
   */
  private async syncOrphanSchedule(
    scheduleId: string,
    existing: ExistingSchedule,
    mode: ScheduleSyncMode = "apply",
  ): Promise<ScheduleSyncDetail> {
    const baseDetail: ScheduleSyncDetail = {
      name: scheduleId,
      action: mode === "apply" ? "skipped" : "deleted",
      applied: false,
      expression: "",
      currentExpression: existing.cron,
      target: "unknown",
      method: "unknown",
    };

    if (mode === "apply") {
      return {
        ...baseDetail,
        code: ORPHAN_CLEANUP_NOT_APPLIED_CODE,
        error: "Orphan schedule preserved; use apply-with-orphan-cleanup to delete owned orphans.",
      };
    }

    try {
      if (mode === "dry-run") return baseDetail;
      if (mode !== "apply-with-orphan-cleanup") return baseDetail;

      await this.client.schedules.delete(scheduleId);
      return { ...baseDetail, applied: true };
    } catch (error) {
      return { ...baseDetail, action: "failed", ...createScheduleFailureDetail(error) };
    }
  }

  /**
   * Build the payload for the webhook request.
   *
   * The payload contains information needed by QStashTriggerHandler
   * to dispatch the execution to the correct target method.
   */
  private buildPayload(metadata: CronTriggerMetadata): Record<string, unknown> {
    const methodName = String(metadata.methodName);
    const triggerName = this.getTriggerIdentifier(metadata);

    return {
      scheduleId: this.generateScheduleId(metadata),
      className: metadata.target.constructor.name,
      methodName,
      triggerName,
      cronExpression: metadata.expression,
      timestamp: new Date().toISOString(),
      options: metadata.options ?? {},
    };
  }

  private getTriggerIdentifier(metadata: CronTriggerMetadata): string {
    return metadata.options?.name ?? String(metadata.methodName);
  }

  /**
   * Get a single cron trigger by class and method name.
   *
   * Useful for testing and debugging.
   */
  getCronTrigger(target: object, methodName: string): CronTriggerMetadata | undefined {
    const triggers = triggerRegistry.getTriggersByType(target, "cron");
    const metadata = triggers.get(methodName);

    if (metadata && metadata.type === "cron") {
      return metadata as CronTriggerMetadata;
    }

    return undefined;
  }
}

type ExistingSchedule = {
  readonly cron: string;
};

type ScheduleDiscovery = {
  readonly canonical: Map<string, ExistingSchedule>;
  readonly ownedIds: Set<string>;
  readonly malformed: ScheduleSyncDetail[];
};

function assertScheduleSyncMode(mode: ScheduleSyncMode | undefined): void {
  if (
    mode === undefined ||
    mode === "dry-run" ||
    mode === "apply" ||
    mode === "apply-with-orphan-cleanup"
  ) {
    return;
  }

  throw ProblemFactory.badRequest(
    "triggers-qstash/invalid-sync-mode",
    `Unsupported QStash schedule sync mode: ${String(mode)}`,
  );
}

function isCanonicalScheduleId(scheduleId: string, namespace: string): boolean {
  const components = scheduleId.slice(namespace.length).split(SCHEDULE_NAMESPACE_DELIMITER);
  return components.length >= 3 && components.every((component) => component.length > 0);
}

function scheduleHasOwnershipMarker(schedule: Schedule, expectedMarker: string): boolean {
  const scheduleWithLabels = schedule as Schedule & {
    readonly label?: string;
    readonly labels?: string[];
  };
  return (
    scheduleWithLabels.label === expectedMarker ||
    scheduleWithLabels.labels?.includes(expectedMarker) === true
  );
}

function createPreservedScheduleDetail(
  scheduleId: string,
  existing: ExistingSchedule,
  error: string,
): ScheduleSyncDetail {
  return {
    name: scheduleId,
    action: "skipped",
    applied: false,
    expression: "",
    currentExpression: existing.cron,
    target: "unknown",
    method: "unknown",
    code: SCHEDULE_MIGRATION_REQUIRED_CODE,
    error,
  };
}

const SCHEDULE_UPSTREAM_FAILED_CODE = "triggers-qstash/schedule-upstream-failed";

function createScheduleFailureDetail(
  error: unknown,
): Pick<ScheduleSyncDetail, "code" | "error" | "retryable" | "upstreamStatus"> {
  const upstreamStatus = getUpstreamStatus(error);
  const retryable = isRetryableQStashScheduleError(error);

  return {
    code: SCHEDULE_UPSTREAM_FAILED_CODE,
    error: redactSensitiveValue(getErrorMessage(error)),
    retryable,
    ...(upstreamStatus !== undefined ? { upstreamStatus } : {}),
  };
}

function isRetryableQStashScheduleError(error: unknown): boolean {
  const status = getUpstreamStatus(error);
  if (status !== undefined) {
    return status === 408 || status === 429 || status >= 500;
  }

  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("rate limit") ||
    message.includes("temporarily unavailable")
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error) {
    return error;
  }

  return "unknown upstream error";
}

function getUpstreamStatus(error: unknown): number | undefined {
  const record = asRecord(error);
  const directStatus = normalizeStatus(record?.status ?? record?.statusCode);
  if (directStatus !== undefined) {
    return directStatus;
  }

  const response = asRecord(record?.response);
  return normalizeStatus(response?.status ?? response?.statusCode);
}

function normalizeStatus(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const status = Number(value);
    return Number.isInteger(status) ? status : undefined;
  }

  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

const SENSITIVE_KEY_PATTERN =
  "credential|password|secret|token|api[-_]?key|private[-_]?key|access[-_]?key|connection[-_]?string|qstash[-_]?url|dsn";

function redactSensitiveValue(value: string): string {
  return value
    .replace(/\b(authorization)(\s*[:=]\s*)[^,\n;]+/gi, "$1$2[Redacted]")
    .replace(/\b(cookie)(\s*[:=]\s*)[^,\n]+/gi, "$1$2[Redacted]")
    .replace(
      new RegExp(
        `(["']?)(${SENSITIVE_KEY_PATTERN})\\1(\\s*[:=]\\s*)(["']?)([^"',\\s;&}]+)\\4`,
        "gi",
      ),
      "$1$2$1$3$4[Redacted]$4",
    )
    .replace(new RegExp(`([?&](${SENSITIVE_KEY_PATTERN})=)[^&#\\s]+`, "gi"), "$1[Redacted]");
}
