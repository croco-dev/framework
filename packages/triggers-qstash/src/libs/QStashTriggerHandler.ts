import type {
  Execution,
  ExecutionAttemptManager,
  ExecutionAttemptToken,
  ExecutionManager,
} from "@croco/execution-core";
import { ExecutionProblems } from "@croco/execution-core";
import type { Constructor } from "@croco/framework-context";
import { Container } from "@croco/framework-context";
import {
  Problem,
  ProblemCategory,
  ProblemCategoryMapper,
  ProblemFactory,
} from "@croco/problems-core";
import { triggerRegistry } from "@croco/triggers-core";
import { QstashError } from "@upstash/qstash";
import type { Client, Receiver } from "@upstash/qstash";

type ServiceResolver = (targetClass: Constructor) => unknown;

class DefaultServiceResolverError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DefaultServiceResolverError";
  }
}

const GENERIC_EXECUTION_ERROR_CODE = "triggers-qstash/execution-failed";
const DELIVERY_IDENTITY_VERIFICATION_FAILED_ERROR_CODE =
  "triggers-qstash/delivery-identity-verification-failed";
const EXECUTION_RETRY_PENDING_ERROR_CODE = "triggers-qstash/execution-retry-pending";
const INVALID_PAYLOAD_ERROR_CODE = "triggers-qstash/invalid-payload";
const INVALID_SIGNATURE_ERROR_CODE = "triggers-qstash/invalid-signature";
const INVALID_DELIVERY_IDENTITY_ERROR_CODE = "triggers-qstash/invalid-delivery-identity";
const MISSING_DELIVERY_IDENTITY_ERROR_CODE = "triggers-qstash/missing-delivery-identity";
const METHOD_NOT_FOUND_ERROR_CODE = "triggers-qstash/method-not-found";
const SERVICE_RESOLUTION_ERROR_CODE = "triggers-qstash/service-resolution-failed";
const TARGET_NOT_FOUND_ERROR_CODE = "triggers-qstash/target-not-found";

/**
 * Configuration options for QStashTriggerHandler.
 */
export type QStashTriggerHandlerOptions = {
  /**
   * QStash receiver instance for verifying webhook signatures.
   */
  readonly receiver: Receiver;

  /** Authenticates the delivery identity against provider-owned state. */
  readonly deliveryIdentityVerifier: QStashDeliveryIdentityVerifier;

  /**
   * Execution manager for dispatching executions.
   */
  readonly executionManager: ExecutionManager;

  /** Deadline used to reconcile abandoned running executions. */
  readonly executionTimeout: number;

  /** Maximum attempts for one durable trigger execution. */
  readonly maxAttempts?: number;

  /** Whether a timed-out target may overlap safely with a replacement attempt. */
  readonly timeoutRetryPolicy?: "idempotent" | "indeterminate";

  /** Receives the original provider failure for logging or telemetry. */
  readonly onDeliveryIdentityVerificationFailure?: (
    failure: QStashDeliveryIdentityVerificationFailure,
  ) => void | Promise<void>;

  /**
   * Optional service resolver for getting target instances.
   * If not provided, uses the framework Container with constructor fallback.
   */
  readonly serviceResolver?: ServiceResolver;
};

/** Input used to verify a delivery body and payload against its QStash message ID. */
export type QStashDeliveryIdentityVerification = {
  readonly body: string;
  readonly messageId: string;
  readonly payload: QStashWebhookPayload;
};

/** Verifies a QStash delivery identity and resolves whether the delivery is authentic. */
export type QStashDeliveryIdentityVerifier = (
  verification: QStashDeliveryIdentityVerification,
) => Promise<boolean>;

/** Input reported when delivery identity verification fails for a QStash message ID. */
export type QStashDeliveryIdentityVerificationFailure = {
  readonly error: unknown;
  readonly messageId: string;
};

/**
 * QStash delivery metadata verified against the authenticated message API before use.
 */
export type QStashDeliveryIdentity = {
  /** Value of the `Upstash-Message-Id` delivery header. */
  readonly messageId: string;
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
  readonly error: string;
  readonly code: string;
  readonly category: ProblemCategory;
  readonly observerFailed?: boolean;
  readonly retryable?: boolean;
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
 * import { client, receiver } from './qstash-config';
 * import { executionManager } from './execution-config';
 * import {
 *   createQStashApiDeliveryIdentityVerifier,
 *   QStashTriggerHandler,
 * } from '@croco/triggers-qstash';
 *
 * const app = new Hono();
 * const handler = new QStashTriggerHandler({
 *   receiver,
 *   deliveryIdentityVerifier: createQStashApiDeliveryIdentityVerifier(client),
 *   executionManager,
 *   executionTimeout: 60_000,
 * });
 *
 * app.post('/webhooks/qstash', async (c) => {
 *   const body = await c.req.text();
 *   const signature = c.req.header('Upstash-Signature');
 *
 *   const result = await handler.handle(body, signature, {
 *     messageId: c.req.header('Upstash-Message-Id') ?? '',
 *   });
 *   return c.json(result.body, result.statusCode);
 * });
 * ```
 */
export class QStashTriggerHandler {
  private readonly receiver: Receiver;
  private readonly deliveryIdentityVerifier: QStashDeliveryIdentityVerifier;
  private readonly executionManager: ExecutionManager;
  private readonly executionTimeout: number;
  private readonly maxAttempts: number | undefined;
  private readonly onDeliveryIdentityVerificationFailure:
    | ((failure: QStashDeliveryIdentityVerificationFailure) => void | Promise<void>)
    | undefined;
  private readonly serviceResolver: ServiceResolver;
  private readonly timeoutRetryPolicy: "idempotent" | "indeterminate";
  private readonly usesDefaultServiceResolver: boolean;

  constructor(options: QStashTriggerHandlerOptions) {
    if (!Number.isSafeInteger(options.executionTimeout) || options.executionTimeout <= 0) {
      throw ProblemFactory.badRequest(
        "triggers-qstash/invalid-execution-timeout",
        "QStash executionTimeout must be a positive safe integer",
      );
    }
    this.receiver = options.receiver;
    this.deliveryIdentityVerifier = options.deliveryIdentityVerifier;
    this.executionManager = options.executionManager;
    this.executionTimeout = options.executionTimeout;
    this.maxAttempts = options.maxAttempts;
    this.onDeliveryIdentityVerificationFailure = options.onDeliveryIdentityVerificationFailure;
    this.timeoutRetryPolicy = options.timeoutRetryPolicy ?? "indeterminate";
    this.usesDefaultServiceResolver = !options.serviceResolver;
    this.serviceResolver =
      options.serviceResolver ??
      ((targetClass: Constructor) => {
        try {
          return Container.get(targetClass);
        } catch (error) {
          throw new DefaultServiceResolverError(
            error instanceof Error ? error.message : String(error),
          );
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
  async handle(
    body: string,
    signature: string | undefined,
    delivery: QStashDeliveryIdentity,
  ): Promise<HandleResult> {
    // Verify signature
    const isValid = await this.verifySignature(body, signature);
    if (!isValid) {
      return {
        success: false,
        statusCode: 401,
        body: createErrorResponse(
          "Invalid signature",
          INVALID_SIGNATURE_ERROR_CODE,
          ProblemCategory.Unauthorized,
        ),
      };
    }

    const messageId = delivery?.messageId?.trim();
    if (!messageId) {
      return {
        success: false,
        statusCode: 400,
        body: createErrorResponse(
          "Missing QStash delivery identity",
          MISSING_DELIVERY_IDENTITY_ERROR_CODE,
          ProblemCategory.BadRequest,
        ),
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
        body: createErrorResponse(
          "Invalid JSON payload",
          INVALID_PAYLOAD_ERROR_CODE,
          ProblemCategory.BadRequest,
        ),
      };
    }

    // Validate payload
    const validationError = this.validatePayload(payload);
    if (validationError) {
      return {
        success: false,
        statusCode: 400,
        body: createErrorResponse(
          validationError,
          INVALID_PAYLOAD_ERROR_CODE,
          ProblemCategory.BadRequest,
        ),
      };
    }

    let deliveryIsValid: boolean;
    try {
      deliveryIsValid = await this.deliveryIdentityVerifier({ body, messageId, payload });
    } catch (error) {
      let observerFailed = false;
      try {
        await this.onDeliveryIdentityVerificationFailure?.({ error, messageId });
      } catch (observerError) {
        observerFailed = true;
        console.error("QStash delivery identity verification observer failed", {
          error: observerError,
          messageId,
        });
      }
      return {
        success: false,
        statusCode: 500,
        body: {
          ...createErrorResponse(
            "QStash delivery identity verification failed",
            DELIVERY_IDENTITY_VERIFICATION_FAILED_ERROR_CODE,
            ProblemCategory.InternalServerError,
          ),
          ...(observerFailed ? { observerFailed: true } : {}),
          retryable: true,
        } satisfies ErrorResponse,
      };
    }
    if (!deliveryIsValid) {
      return {
        success: false,
        statusCode: 401,
        body: createErrorResponse(
          "Invalid QStash delivery identity",
          INVALID_DELIVERY_IDENTITY_ERROR_CODE,
          ProblemCategory.Unauthorized,
        ),
      };
    }

    // Resolve target instance and execute
    try {
      const result = await this.dispatchExecution(payload, messageId);
      return result;
    } catch (error) {
      return {
        success: false,
        ...this.toErrorResult(error),
      };
    }
  }

  private toErrorResult(error: unknown): Pick<HandleResult, "statusCode" | "body"> {
    if (error instanceof Problem) {
      return {
        statusCode: error.status,
        body: {
          error: "Execution failed",
          code: error.code,
          category: error.category,
        } satisfies ErrorResponse,
      };
    }

    if (this.usesDefaultServiceResolver && error instanceof DefaultServiceResolverError) {
      return {
        statusCode: 500,
        body: {
          error: "Execution failed",
          code: SERVICE_RESOLUTION_ERROR_CODE,
          category: ProblemCategory.InternalServerError,
        } satisfies ErrorResponse,
      };
    }

    return {
      statusCode: ProblemCategoryMapper.toHttpStatus(ProblemCategory.InternalServerError),
      body: {
        error: "Execution failed",
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
      return "Missing scheduleId";
    }
    if (!payload.methodName) {
      return "Missing methodName";
    }
    if (!payload.cronExpression) {
      return "Missing cronExpression";
    }
    return undefined;
  }

  /**
   * Dispatch execution to the target method.
   */
  private async dispatchExecution(
    payload: QStashWebhookPayload,
    messageId: string,
  ): Promise<HandleResult> {
    const { methodName, scheduleId, options } = payload;

    // Resolve target instance
    const target = this.resolveTarget(payload);
    if (!target) {
      return {
        success: false,
        statusCode: 404,
        body: createErrorResponse(
          `Target not found for trigger: ${this.formatTriggerKey(payload)}`,
          TARGET_NOT_FOUND_ERROR_CODE,
          ProblemCategory.NotFound,
        ),
      };
    }

    // Verify method exists
    const method = (target as Record<string, unknown>)[methodName];
    if (typeof method !== "function") {
      return {
        success: false,
        statusCode: 400,
        body: createErrorResponse(
          `Method not found for trigger: ${this.formatTriggerKey(payload)}`,
          METHOD_NOT_FOUND_ERROR_CODE,
          ProblemCategory.BadRequest,
        ),
      };
    }

    // Create execution
    const execution = await this.executionManager.create({
      type: "cron",
      idempotencyKey: `qstash:${messageId}`,
      maxAttempts: this.maxAttempts,
      timeout: this.executionTimeout,
      payload: {
        scheduleId,
        className: payload.className ?? "unknown",
        methodName,
        cronExpression: payload.cronExpression,
        timestamp: payload.timestamp,
      },
      metadata: {
        messageId,
        scheduleId,
        triggerType: "cron",
        options: options ?? {},
      },
    });

    const authoritativeResult = await this.resultForExistingExecution(execution);
    if (authoritativeResult) {
      return authoritativeResult;
    }

    // Start execution
    let startedExecution: Execution;
    try {
      startedExecution = await this.executionManager.start(execution.id);
    } catch (error) {
      if (!(error instanceof Problem) || error.category !== ProblemCategory.Conflict) {
        throw error;
      }

      const current = await this.executionManager.get(execution.id);
      const concurrentResult = await this.resultForExistingExecution(current);
      if (concurrentResult) {
        return concurrentResult;
      }

      throw error;
    }

    const attemptToken: ExecutionAttemptToken = {
      attempt: startedExecution.attempts,
      executionId: execution.id,
    };
    const attemptManager = this.getAttemptManager();

    let result: unknown;
    try {
      result = await (method as () => unknown).call(target);
    } catch (error) {
      const executionError = {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        retryable: this.isRetryableError(error),
      };
      const failed = attemptManager
        ? await attemptManager.failAttempt(attemptToken, executionError)
        : await this.executionManager.fail(execution.id, executionError);

      if (failed.status === "retrying") {
        return this.createRetryPendingResult(failed);
      }

      throw error;
    }

    if (attemptManager) {
      await attemptManager.completeAttempt(attemptToken, result);
    } else {
      await this.executionManager.complete(execution.id, result);
    }

    return {
      success: true,
      executionId: execution.id,
      statusCode: 200,
      body: {
        executionId: execution.id,
        result,
      },
    };
  }

  private async resultForExistingExecution(
    execution: Execution,
  ): Promise<HandleResult | undefined> {
    if (execution.status === "completed") {
      return {
        success: true,
        executionId: execution.id,
        statusCode: 200,
        body: {
          executionId: execution.id,
          result: execution.result,
        },
      };
    }

    if (execution.status === "running") {
      const recovered = await this.recoverExpiredExecution(execution);
      if (recovered.status !== "running") {
        return this.resultForExistingExecution(recovered);
      }
      return this.createRetryPendingResult(execution);
    }

    if (
      execution.status === "failed" ||
      execution.status === "cancelled" ||
      execution.status === "timed_out"
    ) {
      return {
        success: false,
        executionId: execution.id,
        statusCode: 200,
        body: {
          executionId: execution.id,
          status: execution.status,
        },
      };
    }

    return undefined;
  }

  private async recoverExpiredExecution(execution: Execution): Promise<Execution> {
    if (
      execution.startedAt === undefined ||
      execution.timeout === undefined ||
      execution.startedAt.getTime() + execution.timeout > Date.now()
    ) {
      return execution;
    }

    try {
      await this.executionManager.timeout(execution.id);
    } catch (error) {
      if (!(error instanceof Problem) || error.category !== ProblemCategory.Conflict) {
        throw error;
      }
    }
    const reconciled = await this.executionManager.get(execution.id);
    if (reconciled.status !== "timed_out" || this.timeoutRetryPolicy === "indeterminate") {
      return reconciled;
    }

    const attemptManager = this.getAttemptManager();
    if (!attemptManager) {
      throw ExecutionProblems.attemptFencingUnsupported(
        `QStash execution '${reconciled.id}' requires atomic attempt fencing for idempotent timeout recovery`,
      );
    }

    const token = { attempt: reconciled.attempts, executionId: reconciled.id };
    try {
      await attemptManager.resolveIndeterminateTimeout(token, "QStash target declared idempotent");
      return await this.executionManager.retry(reconciled.id);
    } catch (error) {
      if (!(error instanceof Problem) || error.category !== ProblemCategory.Conflict) {
        throw error;
      }
      return this.executionManager.get(reconciled.id);
    }
  }

  private getAttemptManager(): ExecutionAttemptManager | undefined {
    const candidate = this.executionManager as ExecutionManager & Partial<ExecutionAttemptManager>;
    if (
      typeof candidate.supportsAttemptFencing !== "function" ||
      !candidate.supportsAttemptFencing() ||
      typeof candidate.completeAttempt !== "function" ||
      typeof candidate.failAttempt !== "function" ||
      typeof candidate.resolveIndeterminateTimeout !== "function"
    ) {
      return undefined;
    }
    return candidate as ExecutionManager & ExecutionAttemptManager;
  }

  private createRetryPendingResult(execution: Execution): HandleResult {
    return {
      success: false,
      executionId: execution.id,
      statusCode: 503,
      body: {
        ...createErrorResponse(
          "Execution retry pending",
          EXECUTION_RETRY_PENDING_ERROR_CODE,
          ProblemCategory.InternalServerError,
        ),
        executionId: execution.id,
        retryable: true,
        status: execution.status,
      },
    };
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
        (registeredMethodName) => String(registeredMethodName) === payload.methodName,
      );

      if (!hasMatchingMethod) {
        continue;
      }

      const matchingTrigger = [...triggers.values()].find(
        (trigger) =>
          trigger.type === "cron" &&
          String(trigger.methodName) === payload.methodName &&
          this.matchesScheduleId(
            payload.scheduleId,
            targetClass.name,
            trigger.options?.name,
            payload.methodName,
          ),
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

  private matchesScheduleId(
    scheduleId: string,
    className: string,
    triggerName: string | undefined,
    methodName: string,
  ): boolean {
    const identifier = triggerName ?? methodName;
    const [payloadClassName, payloadIdentifier, payloadMethodName] = scheduleId
      .split(":")
      .slice(-3);

    return (
      payloadClassName === className &&
      payloadIdentifier === identifier &&
      payloadMethodName === methodName
    );
  }

  private formatTriggerKey(payload: QStashWebhookPayload): string {
    if (payload.className) {
      return `${payload.className}.${payload.methodName}`;
    }

    return `${payload.scheduleId}:${payload.methodName}`;
  }

  private getTargetClass(target: object): Constructor | undefined {
    if (typeof target === "function") {
      return target as Constructor;
    }

    if (typeof target.constructor === "function") {
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
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("ETIMEDOUT") ||
        error.message.includes("timeout")
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
   *   deliveryIdentityVerifier: createQStashApiDeliveryIdentityVerifier(myClient),
   *   executionManager: myExecutionManager,
   *   executionTimeout: 60_000,
   * });
   * ```
   */
  static createLambdaHandler(
    options: QStashTriggerHandlerOptions,
  ): (event: {
    body?: string;
    headers?: Record<string, string>;
  }) => Promise<{ statusCode: number; body: string }> {
    const handler = new QStashTriggerHandler(options);

    return async (event) => {
      const body = event.body ?? "";
      const signature = getHeader(event.headers, "Upstash-Signature");

      const messageId = getHeader(event.headers, "Upstash-Message-Id");

      const result = await handler.handle(body, signature, { messageId: messageId ?? "" });

      return {
        statusCode: result.statusCode,
        body: JSON.stringify(result.body),
      };
    };
  }
}

/**
 * Creates a delivery verifier backed by QStash's authenticated message API.
 */
export function createQStashApiDeliveryIdentityVerifier(
  client: Client,
): QStashDeliveryIdentityVerifier {
  return async ({ body, messageId, payload }) => {
    let message: Awaited<ReturnType<Client["messages"]["get"]>>;
    try {
      message = await client.messages.get(messageId);
    } catch (error) {
      if (error instanceof QstashError && error.status === 404) {
        return false;
      }
      throw error;
    }
    return (
      message.messageId === messageId &&
      message.body === body &&
      message.scheduleId === payload.scheduleId
    );
  };
}

function getHeader(headers: Record<string, string> | undefined, name: string): string | undefined {
  const normalizedName = name.toLowerCase();
  return Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === normalizedName)?.[1];
}

function createErrorResponse(
  error: string,
  code: string,
  category: ProblemCategory,
): ErrorResponse {
  return {
    category,
    code,
    error,
  };
}
