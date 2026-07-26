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
  LifecycleRuleExecutionClaim,
  LifecycleRuleExecutionClaimResult,
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

type StoredExecutionClaim = LifecycleRuleExecutionClaim & {
  readonly released: Promise<void>;
  readonly release: () => void;
};

type Clock = () => Date;
type ExecutionClaimWakeScheduler = (wake: () => void, delayMs: number) => () => void;

export type InMemoryLifecycleRuleStateStoreOptions = {
  readonly commandTtlMs?: number;
  /**
   * Supplies the logical clock used for command retention and execution lease expiry.
   * When this clock does not advance with wall time, provide scheduleExecutionClaimWake
   * on the same logical timeline.
   */
  readonly now?: Clock;
  /**
   * Schedules an execution-lease expiry wakeup and returns a cancellation callback.
   * The default scheduler uses wall-clock timers.
   */
  readonly scheduleExecutionClaimWake?: ExecutionClaimWakeScheduler;
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

function cloneIdentityState(state: LifecycleRuleIdentityState): LifecycleRuleIdentityState {
  return {
    ...state,
    versions: state.versions.map((version) => ({
      ...version,
      descriptor: structuredClone(version.descriptor),
      registeredAt: new Date(version.registeredAt),
      updatedAt: new Date(version.updatedAt),
    })),
    history: state.history.map((event) => ({
      ...event,
      occurredAt: new Date(event.occurredAt),
    })),
  };
}

export class InMemoryLifecycleRuleStateStore implements LifecycleRuleStateStore {
  private readonly states = new Map<string, LifecycleRuleIdentityState>();
  private readonly commands = new Map<string, StoredCommand>();
  private readonly executionClaims = new Map<string, StoredExecutionClaim>();
  private readonly commandTtlMs: number;
  private readonly now: Clock;
  private readonly scheduleExecutionClaimWake: ExecutionClaimWakeScheduler;

  constructor(options: InMemoryLifecycleRuleStateStoreOptions = {}) {
    this.commandTtlMs = options.commandTtlMs ?? DEFAULT_COMMAND_TTL_MS;
    this.now = options.now ?? (() => new Date());
    this.scheduleExecutionClaimWake =
      options.scheduleExecutionClaimWake ??
      ((wake, delayMs) => {
        const timer = setTimeout(wake, delayMs);
        return () => clearTimeout(timer);
      });
  }

  get(ruleId: string): LifecycleRuleIdentityState | undefined {
    const state = this.states.get(ruleId);
    return state ? cloneIdentityState(state) : undefined;
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
        return cloneIdentityState(current);
      }
    }

    const state: LifecycleRuleIdentityState = {
      ruleId: record.descriptor.ruleId,
      revision: current?.revision ?? 0,
      versions: [
        ...(current?.versions ?? []),
        {
          ...record,
          descriptor: structuredClone(record.descriptor),
          registeredAt: new Date(record.registeredAt),
          updatedAt: new Date(record.updatedAt),
        },
      ],
      history: current?.history ?? [],
    };
    this.states.set(record.descriptor.ruleId, state);
    return cloneIdentityState(state);
  }

  applyCommand(input: {
    readonly command: LifecycleRuleActivationCommandType;
    readonly request: LifecycleRuleActivationCommand;
  }): LifecycleRuleStateMutation | Promise<LifecycleRuleStateMutation> {
    this.pruneExpiredExecutionClaims(this.now());
    const blockingClaims = this.getBlockingClaims(input);
    if (blockingClaims.length > 0) {
      return this.waitForExecutionClaimChange(blockingClaims).then(() => this.applyCommand(input));
    }
    return this.applyCommandNow(input);
  }

  claimExecution(claim: LifecycleRuleExecutionClaim): LifecycleRuleExecutionClaimResult {
    const now = this.now();
    this.pruneExpiredExecutionClaims(now);
    const existing = this.executionClaims.get(claim.claimId);
    if (existing) {
      return { claimed: false, state: undefined };
    }

    const state = this.states
      .get(claim.ruleId)
      ?.versions.find((version) => version.descriptor.version === claim.version)?.state;
    if (state !== "active" || claim.expiresAt.getTime() <= now.getTime()) {
      return { claimed: false, state };
    }

    let release: (() => void) | undefined;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.executionClaims.set(claim.claimId, {
      ...claim,
      expiresAt: new Date(claim.expiresAt),
      released,
      release: () => release?.(),
    });
    return { claimed: true };
  }

  releaseExecution(claimId: string): void {
    const claim = this.executionClaims.get(claimId);
    if (!claim) {
      return;
    }
    this.executionClaims.delete(claimId);
    claim.release();
  }

  private applyCommandNow(input: {
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
      return { state: cloneIdentityState(replay.result), replayed: true };
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
      return { state: cloneIdentityState(current), replayed: false };
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
    return { state: cloneIdentityState(result), replayed: false };
  }

  list(): readonly LifecycleRuleIdentityState[] {
    return Array.from(this.states.values()).map(cloneIdentityState);
  }

  private pruneExpiredCommands(now: Date): void {
    for (const [commandId, command] of this.commands) {
      if (command.expiresAt.getTime() <= now.getTime()) {
        this.commands.delete(commandId);
      }
    }
  }

  private pruneExpiredExecutionClaims(now: Date): void {
    for (const [claimId, claim] of this.executionClaims) {
      if (claim.expiresAt.getTime() <= now.getTime()) {
        this.executionClaims.delete(claimId);
        claim.release();
      }
    }
  }

  private waitForExecutionClaimChange(claims: readonly StoredExecutionClaim[]): Promise<void> {
    const nearestExpiry = Math.min(...claims.map((claim) => claim.expiresAt.getTime()));
    const delayMs = Math.max(0, nearestExpiry - this.now().getTime());

    return new Promise<void>((resolve) => {
      let settled = false;
      let cancelWake: (() => void) | undefined;
      const finish = () => {
        if (settled) {
          return;
        }
        settled = true;
        cancelWake?.();
        resolve();
      };
      cancelWake = this.scheduleExecutionClaimWake(finish, delayMs);
      if (settled) {
        cancelWake();
      }
      void Promise.all(claims.map((claim) => claim.released)).then(finish);
    });
  }

  private getBlockingClaims(input: {
    readonly command: LifecycleRuleActivationCommandType;
    readonly request: LifecycleRuleActivationCommand;
  }): readonly StoredExecutionClaim[] {
    const current = this.states.get(input.request.ruleId);
    if (!current) {
      return [];
    }
    const activeVersions = new Set(
      current.versions
        .filter((version) => version.state === "active")
        .map((version) => version.descriptor.version),
    );

    return Array.from(this.executionClaims.values()).filter((claim) => {
      if (claim.ruleId !== input.request.ruleId || !activeVersions.has(claim.version)) {
        return false;
      }
      if (input.command === "pause" || input.command === "supersede") {
        return claim.version === input.request.version;
      }
      if (input.command === "activate") {
        return claim.version !== input.request.version;
      }
      return false;
    });
  }
}
