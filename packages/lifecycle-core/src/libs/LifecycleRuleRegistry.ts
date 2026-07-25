import { createHash } from "node:crypto";
import { InMemoryLifecycleRuleStateStore } from "./InMemoryLifecycleRuleStateStore";
import {
  DuplicateLifecycleRuleProblem,
  LifecycleRuleDefinitionProblem,
  LifecycleRuleVersionDefinitionProblem,
  UnavailableLifecycleRuleVersionProblem,
  UnknownLifecycleRuleVersionProblem,
} from "./problems/LifecycleProblems";
import type {
  LifecycleAction,
  LifecycleRule,
  LifecycleRuleActionDescriptor,
  LifecycleRuleActivationCommand,
  LifecycleRuleIdentityState,
  LifecycleRuleInspection,
  LifecycleRuleRegistration,
  LifecycleRuleRegistrationInput,
  LifecycleRuleState,
  LifecycleRuleStateMutation,
  LifecycleRuleStateStore,
  LifecycleRuleStateStoreResult,
  LifecycleRuleVersionDescriptor,
  LifecycleSignal,
} from "./types";

function validateRule(rule: LifecycleRule): void {
  if (rule.id.trim().length === 0) {
    throw new LifecycleRuleDefinitionProblem(rule.id, "id must not be empty");
  }

  if (rule.description.trim().length === 0) {
    throw new LifecycleRuleDefinitionProblem(rule.id, "description must not be empty");
  }

  if (rule.triggers.length === 0) {
    throw new LifecycleRuleDefinitionProblem(rule.id, "at least one trigger is required");
  }

  if (Array.isArray(rule.actions) && rule.actions.length === 0) {
    throw new LifecycleRuleDefinitionProblem(rule.id, "at least one action is required");
  }

  if (
    rule.cooldown &&
    (!Number.isFinite(rule.cooldown.durationMs) || rule.cooldown.durationMs <= 0)
  ) {
    throw new LifecycleRuleDefinitionProblem(rule.id, "cooldown duration must be positive");
  }
}

function signalMatches(rule: LifecycleRule, signal: LifecycleSignal): boolean {
  return rule.triggers.some((trigger) => trigger.type === "*" || trigger.type === signal.type);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function toActionDescriptor(action: LifecycleAction): LifecycleRuleActionDescriptor {
  const hasConfiguration =
    action.payload !== undefined ||
    action.idempotencyKey !== undefined ||
    action.metadata !== undefined;
  return {
    id: action.id,
    type: action.type,
    title: action.title,
    description: action.description,
    configurationFingerprint: hasConfiguration
      ? createHash("sha256")
          .update(
            JSON.stringify(
              canonicalize({
                payload: action.payload,
                idempotencyKey: action.idempotencyKey,
                metadata: action.metadata,
              }),
            ),
          )
          .digest("hex")
      : undefined,
  };
}

function canonicalize(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => compareStrings(left, right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }

  return value;
}

function createFingerprint(
  input: Omit<LifecycleRuleVersionDescriptor, "fingerprint" | "version" | "description">,
): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(input)))
    .digest("hex");
}

function registrationKey(ruleId: string, version: string): string {
  return `${ruleId}\u0000${version}`;
}

function requireSynchronousResult<T>(result: LifecycleRuleStateStoreResult<T>): T {
  if (result instanceof Promise) {
    throw new LifecycleRuleDefinitionProblem(
      "legacy",
      "register(rule) requires a synchronous state store; use and await registerVersion() with asynchronous stores",
    );
  }
  return result;
}

export type LifecycleRuleRegistryOptions = {
  readonly stateStore?: LifecycleRuleStateStore;
};

export class LifecycleRuleRegistry {
  private readonly registrations = new Map<string, LifecycleRuleRegistration>();
  private readonly activeRegistrationKeys = new Set<string>();
  private readonly stateStore: LifecycleRuleStateStore;

  constructor(options: LifecycleRuleRegistryOptions = {}) {
    this.stateStore = options.stateStore ?? new InMemoryLifecycleRuleStateStore();
  }

  register(rule: LifecycleRule): void {
    const current = requireSynchronousResult(this.stateStore.get(rule.id));
    if (
      current ||
      Array.from(this.registrations.values()).some((entry) => entry.rule.id === rule.id)
    ) {
      throw new DuplicateLifecycleRuleProblem(rule.id);
    }

    validateRule(rule);
    const actionDescriptors = Array.isArray(rule.actions)
      ? rule.actions.map(toActionDescriptor)
      : [{ id: "legacy-dynamic-actions", type: "code" }];

    const fingerprint = createFingerprint({
      ruleId: rule.id,
      executableRegistrationId: `legacy:${rule.id}`,
      executableFingerprint: "legacy-unversioned",
      triggers: [...rule.triggers].sort((left, right) => compareStrings(left.type, right.type)),
      contextRequirements: [],
      severity: rule.severity,
      cooldownDurationMs: rule.cooldown?.durationMs,
      actions: [...actionDescriptors].sort((left, right) =>
        compareStrings(`${left.type}:${left.id}`, `${right.type}:${right.id}`),
      ),
    });
    const registeredAt = new Date();
    const descriptor: LifecycleRuleVersionDescriptor = {
      ruleId: rule.id,
      version: `legacy-${fingerprint.slice(0, 12)}`,
      fingerprint,
      executableRegistrationId: `legacy:${rule.id}`,
      executableFingerprint: "legacy-unversioned",
      description: rule.description,
      triggers: [...rule.triggers].sort((left, right) => compareStrings(left.type, right.type)),
      contextRequirements: [],
      severity: rule.severity,
      cooldownDurationMs: rule.cooldown?.durationMs,
      actions: [...actionDescriptors].sort((left, right) =>
        compareStrings(`${left.type}:${left.id}`, `${right.type}:${right.id}`),
      ),
    };
    requireSynchronousResult(
      this.stateStore.saveRegistration({
        descriptor,
        state: "registered",
        registeredAt,
        updatedAt: registeredAt,
      }),
    );
    this.registrations.set(registrationKey(rule.id, descriptor.version), { descriptor, rule });
    const identity = requireSynchronousResult(this.stateStore.get(rule.id));
    const activated = requireSynchronousResult(
      this.stateStore.applyCommand({
        command: "activate",
        request: {
          commandId: `registration:${rule.id}:${descriptor.version}`,
          ruleId: rule.id,
          version: descriptor.version,
          expectedRevision: identity?.revision ?? 0,
          reason: "compatibility registration",
          at: registeredAt,
        },
      }),
    );
    this.synchronizeActiveRegistrations(activated.state);
  }

  async registerVersion(input: LifecycleRuleRegistrationInput): Promise<LifecycleRuleRegistration> {
    validateRule(input.rule);

    if (input.version.trim().length === 0) {
      throw new LifecycleRuleVersionDefinitionProblem(
        input.rule.id,
        input.version,
        "version must not be empty",
      );
    }
    if (input.executableRegistrationId.trim().length === 0) {
      throw new LifecycleRuleVersionDefinitionProblem(
        input.rule.id,
        input.version,
        "executableRegistrationId must not be empty",
      );
    }
    if (input.executableFingerprint.trim().length === 0) {
      throw new LifecycleRuleVersionDefinitionProblem(
        input.rule.id,
        input.version,
        "executableFingerprint must not be empty",
      );
    }

    const actionDescriptors =
      input.actionDescriptors ??
      (Array.isArray(input.rule.actions) ? input.rule.actions.map(toActionDescriptor) : undefined);
    if (!actionDescriptors || actionDescriptors.length === 0) {
      throw new LifecycleRuleVersionDefinitionProblem(
        input.rule.id,
        input.version,
        "function actions require at least one declared action descriptor",
      );
    }

    const descriptorInput = {
      ruleId: input.rule.id,
      executableRegistrationId: input.executableRegistrationId,
      executableFingerprint: input.executableFingerprint,
      triggers: [...input.rule.triggers].sort((left, right) =>
        compareStrings(left.type, right.type),
      ),
      contextRequirements: [...(input.contextRequirements ?? [])].sort(),
      severity: input.rule.severity,
      cooldownDurationMs: input.rule.cooldown?.durationMs,
      actions: [...actionDescriptors].sort((left, right) =>
        compareStrings(`${left.type}:${left.id}`, `${right.type}:${right.id}`),
      ),
    };
    const descriptor: LifecycleRuleVersionDescriptor = {
      ...descriptorInput,
      version: input.version,
      fingerprint: createFingerprint(descriptorInput),
      description: input.rule.description,
    };
    const key = registrationKey(input.rule.id, input.version);
    const existingRegistration = this.registrations.get(key);
    if (existingRegistration) {
      if (JSON.stringify(existingRegistration.descriptor) !== JSON.stringify(descriptor)) {
        throw new LifecycleRuleVersionDefinitionProblem(
          input.rule.id,
          input.version,
          "an immutable version cannot be registered with a different fingerprint",
        );
      }
    }

    const current = await this.stateStore.get(input.rule.id);
    const persistedVersion = current?.versions.find(
      (record) => record.descriptor.version === input.version,
    );
    const activeVersion = current?.versions.find(
      (record) => record.state === "active" || record.state === "paused",
    );
    if (
      input.activate &&
      ((activeVersion !== undefined && activeVersion.descriptor.version !== input.version) ||
        (persistedVersion === undefined && current !== undefined && current.versions.length > 0))
    ) {
      throw new LifecycleRuleVersionDefinitionProblem(
        input.rule.id,
        input.version,
        "a new version cannot replace an existing version without an explicit activate command",
      );
    }

    const registeredAt = input.registeredAt ?? new Date();
    const initialState =
      current?.versions.some(
        (version) => version.state === "active" || version.state === "paused",
      ) === true
        ? "inactive"
        : "registered";
    await this.stateStore.saveRegistration({
      descriptor,
      state: initialState,
      registeredAt,
      updatedAt: registeredAt,
    });
    const registration = existingRegistration ?? { descriptor, rule: input.rule };
    this.registrations.set(key, registration);
    if (persistedVersion?.state === "active") {
      this.activeRegistrationKeys.add(key);
    }

    if (input.activate && persistedVersion?.state !== "active") {
      const activated = await this.stateStore.applyCommand({
        command: "activate",
        request: {
          commandId: `registration:${input.rule.id}:${input.version}`,
          ruleId: input.rule.id,
          version: input.version,
          expectedRevision: (await this.stateStore.get(input.rule.id))?.revision ?? 0,
          reason: "compatibility registration",
          at: registeredAt,
        },
      });
      this.synchronizeActiveRegistrations(activated.state);
    }

    return registration;
  }

  async activate(request: LifecycleRuleActivationCommand): Promise<LifecycleRuleStateMutation> {
    await this.assertExecutableAvailable(request.ruleId, request.version);
    const mutation = await this.stateStore.applyCommand({ command: "activate", request });
    this.synchronizeActiveRegistrations(mutation.state);
    return mutation;
  }

  async pause(request: LifecycleRuleActivationCommand): Promise<LifecycleRuleStateMutation> {
    const mutation = await this.stateStore.applyCommand({ command: "pause", request });
    this.synchronizeActiveRegistrations(mutation.state);
    return mutation;
  }

  async resume(request: LifecycleRuleActivationCommand): Promise<LifecycleRuleStateMutation> {
    await this.assertExecutableAvailable(request.ruleId, request.version);
    const mutation = await this.stateStore.applyCommand({ command: "resume", request });
    this.synchronizeActiveRegistrations(mutation.state);
    return mutation;
  }

  async supersede(request: LifecycleRuleActivationCommand): Promise<LifecycleRuleStateMutation> {
    const mutation = await this.stateStore.applyCommand({ command: "supersede", request });
    this.synchronizeActiveRegistrations(mutation.state);
    return mutation;
  }

  /**
   * Returns the synchronous local compatibility view.
   * Do not use this view as authoritative state for a shared durable store.
   */
  get(ruleId: string): LifecycleRule | undefined {
    return this.getAll().find((rule) => rule.id === ruleId);
  }

  /**
   * Returns the synchronous local compatibility view.
   * Await inspect(), getIdentityState(), or matchRegistrations() for versioned operations.
   */
  getAll(): readonly LifecycleRule[] {
    return Array.from(this.activeRegistrationKeys).flatMap((key) => {
      const registration = this.registrations.get(key);
      return registration ? [registration.rule] : [];
    });
  }

  getRegistration(ruleId: string, version: string): LifecycleRuleRegistration | undefined {
    return this.registrations.get(registrationKey(ruleId, version));
  }

  async getIdentityState(ruleId: string): Promise<LifecycleRuleIdentityState | undefined> {
    return this.stateStore.get(ruleId);
  }

  async getRegistrationState(
    ruleId: string,
    version: string,
  ): Promise<LifecycleRuleState | undefined> {
    const record = (await this.stateStore.get(ruleId))?.versions.find(
      (entry) => entry.descriptor.version === version,
    );
    if (!record) {
      return undefined;
    }
    return this.registrations.has(registrationKey(ruleId, version)) ? record.state : "unavailable";
  }

  async inspect(): Promise<readonly LifecycleRuleInspection[]> {
    return (await this.stateStore.list()).flatMap((identity) =>
      identity.versions.map((version) => ({
        ...version.descriptor,
        state: this.registrations.has(
          registrationKey(version.descriptor.ruleId, version.descriptor.version),
        )
          ? version.state
          : "unavailable",
        revision: identity.revision,
        registeredAt: version.registeredAt,
        updatedAt: version.updatedAt,
      })),
    );
  }

  /**
   * Matches the synchronous local compatibility view.
   * Production dispatch uses the authoritative asynchronous matchRegistrations() path.
   */
  match(signal: LifecycleSignal): readonly LifecycleRule[] {
    return this.getAll().filter((rule) => signalMatches(rule, signal));
  }

  async matchRegistrations(signal: LifecycleSignal): Promise<
    readonly (LifecycleRuleRegistration & {
      readonly state: "active" | "paused";
    })[]
  > {
    return (await this.getRunnableRegistrations())
      .filter(({ registration }) => signalMatches(registration.rule, signal))
      .map(({ registration, state }) => ({
        ...registration,
        state,
      }));
  }

  private async assertExecutableAvailable(ruleId: string, version: string): Promise<void> {
    const record = (await this.stateStore.get(ruleId))?.versions.find(
      (entry) => entry.descriptor.version === version,
    );
    if (!record) {
      throw new UnknownLifecycleRuleVersionProblem(ruleId, version);
    }
    if (!this.registrations.has(registrationKey(ruleId, version))) {
      throw new UnavailableLifecycleRuleVersionProblem(ruleId, version);
    }
  }

  private async getRunnableRegistrations(): Promise<
    readonly {
      readonly registration: LifecycleRuleRegistration;
      readonly state: "active" | "paused";
    }[]
  > {
    return (await this.stateStore.list()).flatMap((identity) =>
      identity.versions.flatMap((version) => {
        if (version.state !== "active" && version.state !== "paused") {
          return [];
        }
        const registration = this.registrations.get(
          registrationKey(version.descriptor.ruleId, version.descriptor.version),
        );
        return registration ? [{ registration, state: version.state }] : [];
      }),
    );
  }

  private synchronizeActiveRegistrations(identity: LifecycleRuleIdentityState): void {
    for (const version of identity.versions) {
      const key = registrationKey(identity.ruleId, version.descriptor.version);
      if (version.state === "active") {
        this.activeRegistrationKeys.add(key);
      } else {
        this.activeRegistrationKeys.delete(key);
      }
    }
  }
}
