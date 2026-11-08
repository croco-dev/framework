import { Context, MetadataStorage } from "@croco/framework-context";
import type { GeneratedDiGraph } from "@croco/framework-context";
import type { ApplicationRuntime } from "@croco/framework-module";
import type { ExecutionManager } from "@croco/execution-core";
import { ProblemFactory } from "@croco/problems-core";
import { TASK_METADATA_KEY, TaskRegistry, TaskRunner } from "@croco/tasks-core";
import type { TaskMetadata } from "@croco/tasks-core";
import { compileCloudflareCrons, normalizeCloudflareCron } from "./cron";
import type { CloudflareCronManifest } from "./cron";
import type { CloudflareFetchEnv } from "./fetch";

/** Native controller supplied by Workers, never by an HTTP request. */
export type CloudflareScheduledController = {
  readonly cron: string;
  readonly scheduledTime: number;
};

export type CloudflareScheduledContext = {
  readonly waitUntil: (promise: Promise<unknown>) => void;
};

/** Serializable input supplied to a Cron method; TaskExecutionContext is its second argument. */
export type CloudflareCronInvocation = {
  readonly cron: string;
  readonly scheduledTime: number;
};

export type CloudflareScheduledHandler = {
  (
    controller: CloudflareScheduledController,
    env: CloudflareFetchEnv,
    context: CloudflareScheduledContext,
  ): Promise<void>;
  /** Retry through the same application-bound Cron registry and common task policy. */
  readonly retry: (executionId: string) => Promise<unknown>;
  /** Inspect external effects before recording operator recovery and retrying a timeout. */
  readonly recoverTimeout: (executionId: string, reason: string) => Promise<unknown>;
};

export type CloudflareScheduledHandlerOptions = {
  readonly runtime: ApplicationRuntime;
  readonly graph: GeneratedDiGraph;
  readonly manifest: CloudflareCronManifest;
  readonly env: CloudflareFetchEnv;
  /** Stable application namespace, shared by all replicas using this execution store. */
  readonly applicationId: string;
  /** Required when Cron methods exist. Applications select and own the durable store. */
  readonly executionManager?: ExecutionManager;
};

function executionUnavailable() {
  return ProblemFactory.internalServerError(
    "CLOUDFLARE_CRON_EXECUTION_UNAVAILABLE",
    "Select an application-owned ExecutionManager before enabling Cron methods.",
  );
}

/** Bind registered Cron methods to the owning application and the common task execution policy. */
export function createCloudflareScheduledHandler(
  options: CloudflareScheduledHandlerOptions,
): CloudflareScheduledHandler {
  const manifest = compileCloudflareCrons(options.graph);
  if (JSON.stringify(manifest) !== JSON.stringify(options.manifest)) {
    throw ProblemFactory.internalServerError(
      "CLOUDFLARE_CRON_MANIFEST_DRIFT",
      "Regenerate the Worker Cron manifest and Wrangler configuration before starting this build.",
    );
  }
  if (!options.applicationId.trim()) {
    throw ProblemFactory.badRequest(
      "CLOUDFLARE_CRON_APPLICATION_INVALID",
      "A stable applicationId is required.",
    );
  }
  if (manifest.bindings.length > 0 && options.executionManager === undefined) {
    throw executionUnavailable();
  }

  const registry = new TaskRegistry();
  for (const binding of manifest.bindings) {
    const provider = options.graph.providers.find(
      ({ tokenId }) => tokenId === binding.providerTokenId,
    );
    if (!provider || typeof provider.token !== "function") {
      throw ProblemFactory.internalServerError(
        "CLOUDFLARE_CRON_TARGET_INVALID",
        "Cron provider is unavailable.",
      );
    }
    const metadata = MetadataStorage.get<TaskMetadata>(
      TASK_METADATA_KEY,
      provider.token,
      binding.methodName,
    );
    const taskOptions = { ...metadata?.options, timeout: metadata?.options?.timeout ?? 30_000 };
    if (
      !Number.isSafeInteger(taskOptions.timeout) ||
      taskOptions.timeout <= 0 ||
      taskOptions.timeout > 900_000
    ) {
      throw ProblemFactory.badRequest(
        "CLOUDFLARE_CRON_TIMEOUT_INVALID",
        "Cron tasks require a positive timeout of at most 900000 milliseconds; dispatch longer work separately.",
      );
    }
    registry.register(binding.id, provider.token, binding.methodName, {
      name: binding.id,
      target: provider.token,
      methodName: binding.methodName,
      options: taskOptions,
    });
  }
  const runner = options.executionManager
    ? new TaskRunner(options.executionManager, registry, undefined, {
        serviceResolver: (target) => options.runtime.get(target),
      })
    : undefined;

  const invoke = options.runtime.bindHostCallback(
    async (event: CloudflareScheduledController, env: CloudflareFetchEnv) => {
      if (env !== options.env) {
        throw ProblemFactory.internalServerError(
          "CLOUDFLARE_CRON_ENV_MISMATCH",
          "Worker environment ownership changed.",
        );
      }
      if (!Number.isSafeInteger(event.scheduledTime) || event.scheduledTime < 0) {
        throw ProblemFactory.badRequest(
          "CLOUDFLARE_CRON_EVENT_INVALID",
          "A valid scheduledTime is required.",
        );
      }
      const cron = normalizeCloudflareCron(event.cron);
      const bindings = manifest.bindings.filter((binding) => binding.cron === cron);
      if (bindings.length === 0) {
        throw ProblemFactory.badRequest(
          "CLOUDFLARE_CRON_UNREGISTERED",
          "The scheduled Cron is not registered in this build.",
        );
      }
      const payload: CloudflareCronInvocation = Object.freeze({
        cron,
        scheduledTime: event.scheduledTime,
      });
      await Context.run(
        { requestId: `cron:${options.applicationId}:${event.scheduledTime}` },
        async () => {
          // Await every sibling even when one fails: the host must not finish while other tasks are running.
          const results = await Promise.allSettled(
            bindings.map((binding) => {
              if (!runner) {
                throw executionUnavailable();
              }
              return runner.execute(binding.id, payload, {
                idempotencyKey: JSON.stringify([
                  options.applicationId,
                  binding.id,
                  cron,
                  event.scheduledTime,
                ]),
                metadata: {
                  host: "cloudflare-workers",
                  applicationId: options.applicationId,
                  cron,
                  scheduledTime: event.scheduledTime,
                },
              });
            }),
          );
          const failures = results.filter(
            (result): result is PromiseRejectedResult => result.status === "rejected",
          );
          if (failures.length > 0) throw failures[0].reason;
        },
      );
    },
  );

  const recover = options.runtime.bindHostCallback(async (executionId: string, reason?: string) => {
    if (!runner || !options.executionManager) throw executionUnavailable();
    const execution = await options.executionManager.get(executionId);
    if (
      execution.metadata?.host !== "cloudflare-workers" ||
      execution.metadata.applicationId !== options.applicationId ||
      !registry.get(execution.type)
    ) {
      throw ProblemFactory.badRequest(
        "CLOUDFLARE_CRON_EXECUTION_MISMATCH",
        "The execution does not belong to this application's Cron registry.",
      );
    }
    return Context.run({ requestId: `cron:${options.applicationId}:recovery:${executionId}` }, () =>
      reason === undefined ? runner.retry(executionId) : runner.recoverTimeout(executionId, reason),
    );
  });
  const scheduled: CloudflareScheduledHandler = Object.assign(
    async (
      event: CloudflareScheduledController,
      env: CloudflareFetchEnv,
      context: CloudflareScheduledContext,
    ) => {
      const completion = invoke(event, env);
      context.waitUntil(completion);
      await completion;
    },
    {
      retry: async (executionId: string) => recover(executionId),
      recoverTimeout: async (executionId: string, reason: string) => recover(executionId, reason),
    },
  );
  return scheduled;
}

export { compileCloudflareCrons, normalizeCloudflareCron } from "./cron";
export type { CloudflareCronBinding, CloudflareCronManifest } from "./cron";
