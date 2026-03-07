import type { ExecutionManager } from '@croco/execution-core';
import type { Constructor } from '@croco/framework-context';
import { Container } from '@croco/framework-context';
import { Problem, ProblemCategory, ProblemCategoryMapper } from '@croco/problems-core';
import { triggerRegistry } from '@croco/triggers-core';
import type { Receiver } from '@upstash/qstash';

type ServiceResolver = (targetClass: Constructor) => unknown;

class DefaultServiceResolverError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DefaultServiceResolverError';
  }
}

const GENERIC_EXECUTION_ERROR_CODE = 'triggers-qstash/execution-failed';
const SERVICE_RESOLUTION_ERROR_CODE = 'triggers-qstash/service-resolution-failed';

/**
 * Configuration options for QStashTriggerHandler.
 */
export type QStashTriggerHandlerOptions = {
  /**
   * QStash receiver instance for verifying webhook signatures.
   */
  readonly receiver: Receiver;

  /**
   * Execution manager for dispatching executions.
   */
  readonly executionManager: ExecutionManager;

  /**
   * Optional service resolver for getting target instances.
   * If not provided, uses the framework Container with constructor fallback.
   */
  readonly serviceResolver?: ServiceResolver;
};

/**
 * Webhook request payload from QStash.
 */
export type QStashWebhookPayload = {
  /**
   * Schedule ID that triggered this webhook.
   */
  readonly scheduleId: string;

  /**
   * Target class name to execute.
   */
  readonly className?: string;

  readonly triggerName?: string;

  /**
   * Target method name to execute.
   */
  readonly methodName: string;

  /**
   * Cron expression for this schedule.
   */
  readonly cronExpression: string;

  /**
   * Timestamp when the webhook was triggered.
   */
  readonly timestamp: string;

  /**
   * Additional options from the @Cron decorator.
   */
  readonly options?: {
    readonly name?: string;
    readonly description?: string;
    readonly enabled?: boolean;
    readonly timezone?: string;
  };
};

/**
 * Result of handling a QStash webhook.
 */
export type HandleResult = {
  /**
   * Whether the webhook was handled successfully.
   */
  readonly success: boolean;

  /**
   * Execution ID if an execution was created.
   */
  readonly executionId?: string;

  /**
   * Error message if handling failed.
   */
  readonly error?: string;

  /**
   * HTTP status code to return.
   */
  readonly statusCode: number;

  /**
   * Response body.
   */
  readonly body: unknown;
};

type ErrorResponse = {
  readonly error: 'Execution failed';
  readonly code: string;
  readonly category: ProblemCategory;
};

/**
 * QStashTriggerHandler handles incoming webhooks from QStash.
 *
 * This handler:
 * - Verifies the QStash signature to ensure the request is authentic
 * - Parses the payload to identify the target class and method
 * - Resolves the target instance from the DI container
 * - Creates an execution via ExecutionManager
 * - Dispatches the execution to the target method
 *
 * Usage with Hono (for Lambda):
 * ```typescript
 * import { Hono } from 'hono';
 * import { receiver } from './qstash-config';
 * import { executionManager } from './execution-config';
 * import { QStashTriggerHandler } from '@croco/triggers-qstash';
 *
 * const app = new Hono();
 * const handler = new QStashTriggerHandler({ receiver, executionManager });
 *
 * app.post('/webhooks/qstash', async (c) => {
 *   const body = await c.req.text();
 *   const signature = c.req.header('Upstash-Signature');
 *
 *   const result = await handler.handle(body, signature);
 *   return c.json(result.body, result.statusCode);
 * });
 * ```
 */
export class QStashTriggerHandler {
  private readonly receiver: Receiver;
  private readonly executionManager: ExecutionManager;
  private readonly serviceResolver: ServiceResolver;
  private readonly usesDefaultServiceResolver: boolean;

  constructor(options: QStashTriggerHandlerOptions) {
    this.receiver = options.receiver;
    this.executionManager = options.executionManager;
    this.usesDefaultServiceResolver = !options.serviceResolver;
    this.serviceResolver =
      options.serviceResolver ??
      ((targetClass: Constructor) => {
        try {
          return Container.get(targetClass);
        } catch (error) {
          throw new DefaultServiceResolverError(error instanceof Error ? error.message : String(error));
        }
      });
  }

  /**
   * Handle an incoming QStash webhook request.
   *
   * @param body Raw request body as string
   * @param signature QStash signature from 'Upstash-Signature' header
   * @returns Handle result with status and response data
   */
  async handle(body: string, signature?: string): Promise<HandleResult> {
    // Verify signature
    const isValid = await this.verifySignature(body, signature);
    if (!isValid) {
      return {
        success: false,
        statusCode: 401,
        body: { error: 'Invalid signature' },
      };
    }

    // Parse payload
    let payload: QStashWebhookPayload;
    try {
      payload = JSON.parse(body) as QStashWebhookPayload;
    } catch {
      return {
        success: false,
        statusCode: 400,
        body: { error: 'Invalid JSON payload' },
      };
    }

    // Validate payload
    const validationError = this.validatePayload(payload);
    if (validationError) {
      return {
        success: false,
        statusCode: 400,
        body: { error: validationError },
      };
    }

    // Resolve target instance and execute
    try {
      const result = await this.dispatchExecution(payload);
      return result;
    } catch (error) {
      return {
        success: false,
        ...this.toErrorResult(error),
      };
    }
  }

  private toErrorResult(error: unknown): Pick<HandleResult, 'statusCode' | 'body'> {
    if (error instanceof Problem) {
      return {
        statusCode: error.status,
        body: {
          error: 'Execution failed',
          code: error.code,
          category: error.category,
        } satisfies ErrorResponse,
      };
    }

    if (this.usesDefaultServiceResolver && error instanceof DefaultServiceResolverError) {
      return {
        statusCode: 500,
        body: {
          error: 'Execution failed',
          code: SERVICE_RESOLUTION_ERROR_CODE,
          category: ProblemCategory.InternalServerError,
        } satisfies ErrorResponse,
      };
    }

    return {
      statusCode: ProblemCategoryMapper.toHttpStatus(ProblemCategory.InternalServerError),
      body: {
        error: 'Execution failed',
        code: GENERIC_EXECUTION_ERROR_CODE,
        category: ProblemCategory.InternalServerError,
      } satisfies ErrorResponse,
    };
  }

  /**
   * Verify the QStash signature.
   */
  private async verifySignature(body: string, signature?: string): Promise<boolean> {
    if (!signature) {
      return false;
    }

    try {
      await this.receiver.verify({
        signature,
        body,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate the webhook payload.
   */
  private validatePayload(payload: QStashWebhookPayload): string | undefined {
    if (!payload.scheduleId) {
      return 'Missing scheduleId';
    }
    if (!payload.methodName) {
      return 'Missing methodName';
    }
    if (!payload.cronExpression) {
      return 'Missing cronExpression';
    }
    return undefined;
  }

  /**
   * Dispatch execution to the target method.
   */
  private async dispatchExecution(payload: QStashWebhookPayload): Promise<HandleResult> {
    const { methodName, scheduleId, options } = payload;

    // Resolve target instance
    const target = this.resolveTarget(payload);
    if (!target) {
      return {
        success: false,
        statusCode: 404,
        body: { error: `Target not found for trigger: ${this.formatTriggerKey(payload)}` },
      };
    }

    // Verify method exists
    const method = (target as Record<string, unknown>)[methodName];
    if (typeof method !== 'function') {
      return {
        success: false,
        statusCode: 400,
        body: { error: `Method not found for trigger: ${this.formatTriggerKey(payload)}` },
      };
    }

    // Create execution
    const execution = await this.executionManager.create({
      type: 'cron',
      payload: {
        scheduleId,
        className: payload.className ?? 'unknown',
        methodName,
        cronExpression: payload.cronExpression,
        timestamp: payload.timestamp,
      },
      metadata: {
        scheduleId,
        triggerType: 'cron',
        options: options ?? {},
      },
    });

    // Start execution
    await this.executionManager.start(execution.id);

    // Execute method
    try {
      const result = await (method as () => unknown).call(target);

      // Complete execution
      await this.executionManager.complete(execution.id, result);

      return {
        success: true,
        executionId: execution.id,
        statusCode: 200,
        body: {
          executionId: execution.id,
          result,
        },
      };
    } catch (error) {
      // Fail execution
      await this.executionManager.fail(execution.id, {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        retryable: this.isRetryableError(error),
      });

      throw error;
    }
  }

  /**
   * Resolve target instance from class name.
   */
  private resolveTarget(payload: QStashWebhookPayload): unknown {
    const targetClass = this.resolveTargetClass(payload);
    if (!targetClass) {
      return undefined;
    }

    return this.serviceResolver(targetClass);
  }

  private resolveTargetClass(payload: QStashWebhookPayload): Constructor | undefined {
    const allTriggers = triggerRegistry.getAllTriggers();
    const methodMatches: Constructor[] = [];

    for (const [target, triggers] of allTriggers.entries()) {
      const targetClass = this.getTargetClass(target);
      if (!targetClass) {
        continue;
      }

      const hasMatchingMethod = [...triggers.keys()].some(
        (registeredMethodName) => String(registeredMethodName) === payload.methodName
      );

      if (!hasMatchingMethod) {
        continue;
      }

      const matchingTrigger = [...triggers.values()].find(
        (trigger) =>
          trigger.type === 'cron' &&
          String(trigger.methodName) === payload.methodName &&
          this.matchesScheduleId(payload.scheduleId, trigger.options?.name, payload.methodName)
      );

      if (matchingTrigger) {
        return targetClass;
      }

      methodMatches.push(targetClass);
    }

    if (methodMatches.length === 1) {
      return methodMatches[0];
    }

    return undefined;
  }

  private matchesScheduleId(scheduleId: string, triggerName: string | undefined, methodName: string): boolean {
    const identifier = triggerName ?? methodName;
    const expectedSuffix = `:${identifier}:${methodName}`;
    return scheduleId.endsWith(expectedSuffix);
  }

  private formatTriggerKey(payload: QStashWebhookPayload): string {
    if (payload.className) {
      return `${payload.className}.${payload.methodName}`;
    }

    return `${payload.scheduleId}:${payload.methodName}`;
  }

  private getTargetClass(target: object): Constructor | undefined {
    if (typeof target === 'function') {
      return target as Constructor;
    }

    if (typeof target.constructor === 'function') {
      return target.constructor as unknown as Constructor;
    }

    return undefined;
  }

  /**
   * Determine if an error is retryable.
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      // Network errors, timeouts are retryable
      if (
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('timeout')
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Create a Lambda handler wrapper for easy integration.
   *
   * Usage:
   * ```typescript
   * export const handler = createLambdaHandler({
   *   receiver: myReceiver,
   *   executionManager: myExecutionManager,
   * });
   * ```
   */
  static createLambdaHandler(
    options: QStashTriggerHandlerOptions
  ): (event: { body?: string; headers?: Record<string, string> }) => Promise<{ statusCode: number; body: string }> {
    const handler = new QStashTriggerHandler(options);

    return async (event) => {
      const body = event.body ?? '';
      const signature = event.headers?.['Upstash-Signature'] ?? event.headers?.['upstash-signature'];

      const result = await handler.handle(body, signature);

      return {
        statusCode: result.statusCode,
        body: JSON.stringify(result.body),
      };
    };
  }
}
