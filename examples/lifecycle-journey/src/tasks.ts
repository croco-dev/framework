import { ExecutionManagerImpl } from "@croco/execution-core";
import { JourneyTaskBridge } from "@croco/lifecycle-core";
import { TaskRegistry, TaskRunner } from "@croco/tasks-core";
import { Cron, TriggerRegistry } from "@croco/triggers-core";
import type { JourneyEngine, JourneyScope, JourneyStore } from "@croco/lifecycle-core";
import { MemoryExecutionStore } from "./MemoryExecutionStore";

type JourneyNodePayload = { scope: JourneyScope; episodeId: string; revision: number };

export class JourneyWakeTrigger {
  constructor(
    private readonly bridge: JourneyTaskBridge,
    private readonly scope: JourneyScope,
    private readonly now: () => Date,
  ) {}

  @Cron("* * * * *", { name: "journey-wake" })
  async run(): Promise<number> {
    return this.bridge.dispatchDue(this.scope, this.now());
  }
}

export function createJourneyRuntime(
  store: JourneyStore,
  engine: JourneyEngine,
  scope: JourneyScope,
  now: () => Date,
  executionStore = new MemoryExecutionStore(),
) {
  let bridge: JourneyTaskBridge;
  const target = {
    run: (payload: JourneyNodePayload) => bridge.execute(payload),
  };
  const name = "croco.journey.node";
  const registry = new TaskRegistry([
    {
      name,
      target,
      methodName: "run",
      metadata: {
        name,
        target,
        methodName: "run",
        options: { maxAttempts: 3, timeout: 30_000, timeoutRetry: "fenced" },
      },
    },
  ]);
  const manager = new ExecutionManagerImpl(executionStore);
  const runner = new TaskRunner(manager, registry);
  bridge = new JourneyTaskBridge(store, engine, {
    invoke: async ({ taskId, idempotencyKey, scope: taskScope, episodeId, revision }) => {
      let executionId: string | undefined;
      try {
        await runner.executeTracked(
          taskId,
          { scope: taskScope, episodeId, revision },
          { idempotencyKey },
          (id) => {
            executionId = id;
          },
        );
      } catch (error) {
        if (executionId === undefined) throw error;
        const execution = await manager.get(executionId);
        if (execution.status === "running") {
          if (
            execution.startedAt === undefined ||
            execution.timeout === undefined ||
            execution.startedAt.getTime() + execution.timeout > Date.now()
          )
            throw error;
          // Durable Journey revision CAS and action admission fence abandoned attempts.
          await manager.timeoutAttempt(
            { executionId, attempt: execution.attempts },
            { retryable: true },
          );
        } else if (execution.status !== "failed" && execution.status !== "timed_out") {
          throw error;
        }
        await runner.retry(executionId);
      }
    },
  });
  const wake = new JourneyWakeTrigger(bridge, scope, now);
  if (
    !TriggerRegistry.getInstance()
      .getTriggersByType(JourneyWakeTrigger.prototype, "cron")
      .has("run")
  ) {
    throw new TypeError("Journey wake cron registration is missing");
  }
  return { bridge, runner, wake, executionStore };
}
