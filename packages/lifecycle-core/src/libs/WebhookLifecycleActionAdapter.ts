import { InvalidWebhookTimeoutProblem, MAX_WEBHOOK_TIMEOUT_MS } from "./problems/LifecycleProblems";
import type {
  LifecycleAction,
  LifecycleActionAdapter,
  LifecycleActionResult,
  LifecycleContext,
  LifecycleRun,
} from "./types";

type FetchLike = typeof fetch;

const DEFAULT_WEBHOOK_TIMEOUT_MS = 30_000;

export type WebhookLifecycleActionAdapterOptions = {
  /**
   * Integer milliseconds from 1 through 2_147_483_647. Defaults to 30_000.
   * Invalid values throw an InvalidWebhookTimeoutProblem during adapter setup.
   */
  readonly timeoutMs?: number;
};

function getStringRecord(value: unknown): Record<string, string> {
  if (value === undefined || value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

export class WebhookLifecycleActionAdapter implements LifecycleActionAdapter {
  private readonly timeoutMs: number;

  constructor(
    private readonly fetchImpl: FetchLike = fetch,
    options: WebhookLifecycleActionAdapterOptions = {},
  ) {
    const timeoutMs = options.timeoutMs ?? DEFAULT_WEBHOOK_TIMEOUT_MS;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > MAX_WEBHOOK_TIMEOUT_MS) {
      throw new InvalidWebhookTimeoutProblem(timeoutMs);
    }
    this.timeoutMs = timeoutMs;
  }

  async execute(
    action: LifecycleAction,
    context: LifecycleContext,
    run: Pick<
      LifecycleRun,
      "id" | "idempotencyKey" | "ruleId" | "ruleVersion" | "ruleFingerprint" | "tenantId"
    >,
  ): Promise<LifecycleActionResult> {
    const url = typeof action.payload?.url === "string" ? action.payload.url : undefined;

    if (!url) {
      return {
        actionId: action.id,
        type: action.type,
        status: "failure",
        error: {
          code: "lifecycle-core/webhook-url-missing",
          message: "Webhook lifecycle actions require a string payload.url",
        },
      };
    }

    const controller = new AbortController();
    const timeoutMessage = `Webhook request timed out after ${this.timeoutMs}ms`;
    let timedOut = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      const timeout = new Promise<{ readonly kind: "timeout" }>((resolve) => {
        timeoutId = setTimeout(() => {
          timedOut = true;
          resolve({ kind: "timeout" });
          controller.abort();
        }, this.timeoutMs);
      });
      const request = this.fetchImpl(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": action.idempotencyKey ?? run.idempotencyKey,
          ...getStringRecord(action.payload?.headers),
        },
        body: JSON.stringify({
          action,
          lifecycle: {
            tenantId: context.tenantId,
            ruleId: run.ruleId,
            ruleVersion: run.ruleVersion,
            ruleFingerprint: run.ruleFingerprint,
            runId: run.id,
            signalType: context.signal.type,
          },
        }),
        signal: controller.signal,
      }).then((response) => ({ kind: "response" as const, response }));
      const outcome = await Promise.race([request, timeout]);

      if (outcome.kind === "timeout") {
        return {
          actionId: action.id,
          type: action.type,
          status: "failure",
          error: {
            code: "lifecycle-core/webhook-request-error",
            message: timeoutMessage,
          },
        };
      }

      const response = outcome.response;

      if (!response.ok) {
        return {
          actionId: action.id,
          type: action.type,
          status: "failure",
          error: {
            code: "lifecycle-core/webhook-request-failed",
            message: `Webhook returned ${response.status}`,
          },
        };
      }

      return {
        actionId: action.id,
        type: action.type,
        status: "success",
        message: `Webhook returned ${response.status}`,
      };
    } catch (error) {
      return {
        actionId: action.id,
        type: action.type,
        status: "failure",
        error: {
          code: "lifecycle-core/webhook-request-error",
          message: timedOut
            ? timeoutMessage
            : error instanceof Error
              ? error.message
              : String(error),
        },
      };
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }
}
