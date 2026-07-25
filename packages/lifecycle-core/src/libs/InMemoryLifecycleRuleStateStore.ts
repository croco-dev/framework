import {
  LifecycleRuleCommandConflictProblem,
  LifecycleRuleTransitionProblem,
  LifecycleRuleVersionConflictProblem,
  LifecycleRuleVersionDefinitionProblem,
  UnknownLifecycleRuleVersionProblem,
} from "./problems/LifecycleProblems";
import type {
  LifecycleRuleActivationCommand,
  LifecycleRuleActivationCommandType,
  LifecycleRuleIdentityState,
  LifecycleRuleState,
  LifecycleRuleStateMutation,
  LifecycleRuleStateStore,
  LifecycleRuleVersionRecord,
} from "./types";

type StoredCommand = {
  readonly fingerprint: string;
  readonly result: LifecycleRuleIdentityState;
  readonly expiresAt: Date;
};

type Clock = () => Date;

export type InMemoryLifecycleRuleStateStoreOptions = {
  readonly commandTtlMs?: number;
  readonly now?: Clock;
};

const DEFAULT_COMMAND_TTL_MS = 24 * 60 * 60 * 1000;

function commandFingerprint(
  command: LifecycleRuleActivationCommandType,
  request: LifecycleRuleActivationCommand,
): string {
  return JSON.stringify({
    command,
    ruleId: request.ruleId,
    version: request.version,
    expectedRevision: request.expectedRevision,
    actor: request.actor,
    reason: request.reason,
    at: request.at?.toISOString(),
  });
}

function nextState(
  command: LifecycleRuleActivationCommandType,
  state: Exclude<LifecycleRuleState, "unavailable">,
): Exclude<LifecycleRuleState, "unavailable"> | undefined {
  if (command === "activate") {
    if (state === "active") {
      return state;
    }
    if (state === "registered" || state === "inactive") {
      return "active";
    }
    return undefined;
  }

  if (command === "pause") {
    if (state === "paused") {
      return state;
    }
    return state === "active" ? "paused" : undefined;
  }

  if (command === "resume") {
    if (state === "active") {
      return state;
    }
    return state === "paused" ? "active" : undefined;
  }

  if (state === "superseded") {
    return state;
  }
  return state === "registered" || state === "inactive" || state === "active" || state === "paused"
    ? "superseded"
    : undefined;
}

export class InMemoryLifecycleRuleStateStore implements LifecycleRuleStateStore {
  private readonly states = new Map<string, LifecycleRuleIdentityState>();
  private readonly commands = new Map<string, StoredCommand>();
  private readonly commandTtlMs: number;
  private readonly now: Clock;

  constructor(options: InMemoryLifecycleRuleStateStoreOptions = {}) {
    this.commandTtlMs = options.commandTtlMs ?? DEFAULT_COMMAND_TTL_MS;
    this.now = options.now ?? (() => new Date());
  }

  get(ruleId: string): LifecycleRuleIdentityState | undefined {
    return this.states.get(ruleId);
  }

  saveRegistration(record: LifecycleRuleVersionRecord): LifecycleRuleIdentityState {
    const current = this.states.get(record.descriptor.ruleId);
    const existing = current?.versions.find(
      (version) => version.descriptor.version === record.descriptor.version,
    );

    if (existing) {
      if (JSON.stringify(existing.descriptor) !== JSON.stringify(record.descriptor)) {
        throw new LifecycleRuleVersionDefinitionProblem(
          record.descriptor.ruleId,
          record.descriptor.version,
          "an immutable version cannot be registered with a different fingerprint",
        );
      }
      if (current) {
        return current;
      }
    }

    const state: LifecycleRuleIdentityState = {
      ruleId: record.descriptor.ruleId,
      revision: current?.revision ?? 0,
      versions: [...(current?.versions ?? []), record],
      history: current?.history ?? [],
    };
    this.states.set(record.descriptor.ruleId, state);
    return state;
  }

  applyCommand(input: {
    readonly command: LifecycleRuleActivationCommandType;
    readonly request: LifecycleRuleActivationCommand;
  }): LifecycleRuleStateMutation {
    const commandRecordedAt = this.now();
    this.pruneExpiredCommands(commandRecordedAt);
    const fingerprint = commandFingerprint(input.command, input.request);
    const replay = this.commands.get(input.request.commandId);

    if (replay) {
      if (replay.fingerprint !== fingerprint) {
        throw new LifecycleRuleCommandConflictProblem(input.request.commandId);
      }
      return { state: replay.result, replayed: true };
    }

    const current = this.states.get(input.request.ruleId);
    const target = current?.versions.find(
      (version) => version.descriptor.version === input.request.version,
    );

    if (!current || !target) {
      throw new UnknownLifecycleRuleVersionProblem(input.request.ruleId, input.request.version);
    }

    if (current.revision !== input.request.expectedRevision) {
      throw new LifecycleRuleVersionConflictProblem(
        input.request.ruleId,
        input.request.expectedRevision,
        current.revision,
      );
    }

    const state = nextState(input.command, target.state);
    if (!state) {
      throw new LifecycleRuleTransitionProblem(
        input.request.ruleId,
        input.request.version,
        target.state,
        input.command,
      );
    }

    if (state === target.state) {
      this.commands.set(input.request.commandId, {
        fingerprint,
        result: current,
        expiresAt: new Date(commandRecordedAt.getTime() + this.commandTtlMs),
      });
      return { state: current, replayed: false };
    }

    const occurredAt = input.request.at ?? commandRecordedAt;
    const revision = current.revision + 1;
    const versions = current.versions.map((version) => {
      if (version.descriptor.version === target.descriptor.version) {
        return {
          ...version,
          state,
          updatedAt: occurredAt,
        };
      }

      if (
        input.command === "activate" &&
        (version.state === "active" || version.state === "paused")
      ) {
        return {
          ...version,
          state: "superseded" as const,
          updatedAt: occurredAt,
        };
      }

      return version;
    });
    const result: LifecycleRuleIdentityState = {
      ...current,
      revision,
      versions,
      history: [
        ...current.history,
        {
          commandId: input.request.commandId,
          command: input.command,
          ruleId: input.request.ruleId,
          version: input.request.version,
          previousState: target.state,
          state,
          revision,
          actor: input.request.actor,
          reason: input.request.reason,
          occurredAt,
        },
      ],
    };
    this.states.set(input.request.ruleId, result);
    this.commands.set(input.request.commandId, {
      fingerprint,
      result,
      expiresAt: new Date(commandRecordedAt.getTime() + this.commandTtlMs),
    });
    return { state: result, replayed: false };
  }

  list(): readonly LifecycleRuleIdentityState[] {
    return Array.from(this.states.values());
  }

  private pruneExpiredCommands(now: Date): void {
    for (const [commandId, command] of this.commands) {
      if (command.expiresAt.getTime() <= now.getTime()) {
        this.commands.delete(commandId);
      }
    }
  }
}
