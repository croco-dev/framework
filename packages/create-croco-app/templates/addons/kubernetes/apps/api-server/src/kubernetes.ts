import { setTimeout as delay } from "node:timers/promises";
import type { NodeHostOptions } from "@croco/preset-node";
import { createGracefulShutdownController } from "@croco/transports-http";
import { startNodeApplication } from "./node-application";
import type { CreateCrocoAppOptions } from "./app";
import type { RunningNodeApplication } from "./node-application";
import { NodeHostLifecycleProblem } from "./lifecycle-problems";

/** Application-owned composition; Kubernetes is infrastructure, not a new Host. */
export async function startKubernetesApplication(
  options: NodeHostOptions = {},
  appOptions: CreateCrocoAppOptions = {},
): Promise<RunningNodeApplication> {
  const drain = createGracefulShutdownController({
    signals: [],
    timeoutMs: 20_000,
    onShutdown: (signal) => delay(5_000, undefined, { signal }),
  });
  const running = await startNodeApplication(options, {
    ...appOptions,
    extraMiddlewares: [drain.middleware, ...(appOptions.extraMiddlewares ?? [])],
  });
  let closePromise: Promise<void> | undefined;
  return {
    ...running,
    close: () => {
      closePromise ??= (async () => {
        let drainFailure: unknown;
        try {
          await running.app.applicationRuntime.run(() => drain.shutdown());
        } catch (cause) {
          drainFailure = cause;
        }
        try {
          await running.close();
        } catch (cause) {
          if (drainFailure !== undefined)
            throw new NodeHostLifecycleProblem("close", drainFailure, cause);
          throw cause;
        }
        if (drainFailure !== undefined) throw drainFailure;
      })();
      return closePromise;
    },
  };
}

function reportFatal(error: unknown): void {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

async function main(): Promise<void> {
  const running = await startKubernetesApplication();
  const shutdown = () => {
    void running.close().catch(reportFatal);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

if (require.main === module) void main().catch(reportFatal);
