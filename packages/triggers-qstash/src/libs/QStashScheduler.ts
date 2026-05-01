import type { ExecutionManager } from '@croco/execution-core';
import { ProblemFactory } from '@croco/problems-core';
import type { CronTriggerMetadata } from '@croco/triggers-core';
import { triggerRegistry } from '@croco/triggers-core';
import type { Client } from '@upstash/qstash';

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
};

/**
 * Result of a schedule sync operation.
 */
export type ScheduleSyncResult = {
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

  readonly action: 'created' | 'updated' | 'deleted' | 'skipped' | 'failed';

  /**
   * Cron expression.
   */
  readonly expression: string;

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
  private readonly executionManager?: ExecutionManager;

  constructor(options: QStashSchedulerOptions) {
    this.client = options.client;
    this.webhookUrl = options.webhookUrl;
    this.schedulePrefix = options.schedulePrefix ?? 'croco-trigger';
    this.executionManager = options.executionManager;
  }

  /**
   * Sync all cron triggers with QStash.
   *
   * This method compares the schedules defined in code (@Cron decorators)
   * with the schedules currently in QStash, and creates/updates/deletes as needed.
   *
   * @returns Sync result with counts and details
   */
  async sync(): Promise<ScheduleSyncResult> {
    const cronTriggers = this.getAllCronTriggers();
    const scheduleMap = this.buildScheduleMap(cronTriggers);

    // Get existing schedules from QStash
    const existingSchedules = await this.listQStashSchedules();

    const result: ScheduleSyncResult = {
      created: 0,
      updated: 0,
      deleted: 0,
      skipped: 0,
      failed: 0,
      details: [],
    };

    // Create or update schedules
    for (const [scheduleId, metadata] of scheduleMap.entries()) {
      const existing = existingSchedules.get(scheduleId);
      const detail = await this.syncSchedule(scheduleId, metadata, existing);
      result.details.push(detail);

      switch (detail.action) {
        case 'created':
          result.created++;
          break;
        case 'updated':
          result.updated++;
          break;
        case 'skipped':
          result.skipped++;
          break;
        case 'failed':
          result.failed++;
          break;
      }
    }

    // Delete schedules that are no longer in code
    for (const scheduleId of existingSchedules.keys()) {
      if (!scheduleMap.has(scheduleId)) {
        const detail = await this.deleteSchedule(scheduleId);
        result.details.push(detail);

        if (detail.action === 'deleted') {
          result.deleted++;
          continue;
        }

        result.failed++;
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
        if (metadata.type === 'cron') {
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
          'triggers-qstash/duplicate-schedule-id',
          `Duplicate QStash schedule ID detected: ${scheduleId}`
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
    return `${this.schedulePrefix}:${className}:${triggerName}:${methodName}`;
  }

  /**
   * List all schedules from QStash that belong to this scheduler.
   *
   * Note: QStash API may not support filtering by prefix.
   * This implementation fetches all schedules and filters client-side.
   * For production with many schedules, consider maintaining a local cache.
   */
  private async listQStashSchedules(): Promise<Map<string, { cron: string }>> {
    const schedules = new Map<string, { cron: string }>();

    const response = await this.client.schedules.list();

    for (const schedule of response) {
      const scheduleId = schedule.scheduleId;
      if (scheduleId?.startsWith(this.schedulePrefix)) {
        schedules.set(scheduleId, {
          cron: schedule.cron ?? '',
        });
      }
    }

    return schedules;
  }

  /**
   * Sync a single schedule with QStash.
   */
  private async syncSchedule(
    scheduleId: string,
    metadata: CronTriggerMetadata,
    existing?: { cron: string }
  ): Promise<ScheduleSyncDetail> {
    const methodName = String(metadata.methodName);
    const triggerName = this.getTriggerIdentifier(metadata);
    const baseDetail: ScheduleSyncDetail = {
      name: scheduleId,
      action: 'skipped',
      expression: metadata.expression,
      target: triggerName,
      method: methodName,
    };

    // Build payload for webhook
    const payload = this.buildPayload(metadata);

    try {
      if (!existing) {
        await this.client.schedules.create({
          scheduleId,
          cron: metadata.expression,
          destination: this.webhookUrl,
          method: 'POST' as const,
          headers: {
            'Content-Type': 'application/json',
            'X-Schedule-Id': scheduleId,
          },
          body: JSON.stringify(payload),
        });

        return { ...baseDetail, action: 'created' };
      }

      if (existing.cron !== metadata.expression) {
        await this.client.schedules.create({
          scheduleId,
          cron: metadata.expression,
          destination: this.webhookUrl,
          method: 'POST' as const,
          headers: {
            'Content-Type': 'application/json',
            'X-Schedule-Id': scheduleId,
          },
          body: JSON.stringify(payload),
        });

        return { ...baseDetail, action: 'updated' };
      }

      return baseDetail;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { ...baseDetail, action: 'failed', error: errorMessage };
    }
  }

  /**
   * Delete a schedule from QStash.
   */
  private async deleteSchedule(scheduleId: string): Promise<ScheduleSyncDetail> {
    const baseDetail: ScheduleSyncDetail = {
      name: scheduleId,
      action: 'deleted',
      expression: '',
      target: 'unknown',
      method: 'unknown',
    };

    try {
      await this.client.schedules.delete(scheduleId);
      return baseDetail;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { ...baseDetail, action: 'failed', error: errorMessage };
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
    const triggers = triggerRegistry.getTriggersByType(target, 'cron');
    const metadata = triggers.get(methodName);

    if (metadata && metadata.type === 'cron') {
      return metadata as CronTriggerMetadata;
    }

    return undefined;
  }
}
