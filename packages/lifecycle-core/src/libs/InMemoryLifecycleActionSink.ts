import type {
  LifecycleAction,
  LifecycleActionAdapter,
  LifecycleActionResult,
  LifecycleContext,
  LifecycleRun,
} from "./types";

export type LifecycleActionEmission = {
  readonly id: string;
  readonly action: LifecycleAction;
  readonly tenantId: string;
  readonly ruleId: string;
  readonly runId: string;
  readonly emittedAt: Date;
};

export type InMemoryLifecycleActionSinkOptions = {
  readonly failActionIds?: readonly string[];
  readonly skipActionIds?: readonly string[];
};

export class InMemoryLifecycleActionSink implements LifecycleActionAdapter {
  private readonly emissions: LifecycleActionEmission[] = [];
  private readonly failActionIds: ReadonlySet<string>;
  private readonly skipActionIds: ReadonlySet<string>;
  private sequence = 0;

  constructor(options: InMemoryLifecycleActionSinkOptions = {}) {
    this.failActionIds = new Set(options.failActionIds ?? []);
    this.skipActionIds = new Set(options.skipActionIds ?? []);
  }

  async execute(
    action: LifecycleAction,
    context: LifecycleContext,
    run: Pick<LifecycleRun, "id" | "ruleId">,
  ): Promise<LifecycleActionResult> {
    if (this.skipActionIds.has(action.id)) {
      return {
        actionId: action.id,
        type: action.type,
        status: "skipped",
        message: "Action was skipped by the in-memory lifecycle sink",
      };
    }

    if (this.failActionIds.has(action.id)) {
      return {
        actionId: action.id,
        type: action.type,
        status: "failure",
        error: {
          code: "lifecycle-core/in-memory-action-failed",
          message: `Action '${action.id}' failed in the in-memory lifecycle sink`,
        },
      };
    }

    const emission: LifecycleActionEmission = {
      id: `lifecycle_action_${++this.sequence}`,
      action,
      tenantId: context.tenantId,
      ruleId: run.ruleId,
      runId: run.id,
      emittedAt: context.now,
    };
    this.emissions.push(emission);

    return {
      actionId: action.id,
      type: action.type,
      status: "success",
      emissionId: emission.id,
      message: "Action emitted to the in-memory lifecycle sink",
    };
  }

  getEmissions(): readonly LifecycleActionEmission[] {
    return [...this.emissions];
  }
}
