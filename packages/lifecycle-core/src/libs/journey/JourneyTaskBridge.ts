import type { JourneyEngine } from "./JourneyEngine";
import type { JourneyEpisode, JourneyScope, JourneyStore } from "./types";
/** The application supplies its existing TaskRunner/dispatcher invocation; this bridge owns no timer. */
export interface JourneyTaskInvoker {
  invoke(input: {
    taskId: string;
    idempotencyKey: string;
    scope: JourneyScope;
    episodeId: string;
    revision: number;
  }): Promise<void>;
}
export class JourneyTaskBridge {
  constructor(
    private readonly store: JourneyStore,
    private readonly engine: JourneyEngine,
    private readonly tasks: JourneyTaskInvoker,
  ) {}
  async dispatchDue(scope: JourneyScope, now: Date, limit = 100, leaseMs = 30000): Promise<number> {
    const due = await this.store.claimDue(scope, now.toISOString(), limit, leaseMs);
    const failures: unknown[] = [];
    for (const episode of due) {
      try {
        await this.tasks.invoke({
          taskId: "croco.journey.node",
          idempotencyKey: JSON.stringify([
            scope.appId,
            scope.environment,
            scope.tenantId,
            episode.id,
            episode.nodeId,
            episode.revision,
          ]),
          scope,
          episodeId: episode.id,
          revision: episode.revision,
        });
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length > 0) throw failures[0];
    return due.length;
  }
  async execute(input: {
    scope: JourneyScope;
    episodeId: string;
    revision: number;
  }): Promise<JourneyEpisode | undefined> {
    const episode = await this.store.get(input.scope, input.episodeId);
    if (!episode || episode.revision !== input.revision) return episode;
    return this.engine.tick(input.scope, input.episodeId, input.revision);
  }
}
