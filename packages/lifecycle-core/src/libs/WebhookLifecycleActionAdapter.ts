import type {
  LifecycleAction,
  LifecycleActionAdapter,
  LifecycleActionResult,
  LifecycleContext,
  LifecycleRun,
} from "./types";

type FetchLike = typeof fetch;

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
  constructor(private readonly fetchImpl: FetchLike = fetch) {}

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

    try {
      const response = await this.fetchImpl(url, {
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
      });

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
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
}
