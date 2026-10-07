import {
  assertMissionScope,
  missionDate,
  missionDateStart,
  missionInstant,
  missionKey,
  missionLocalDate,
  missionPeriod,
  missionText,
  MissionAccessDeniedProblem,
  MissionConflictProblem,
  MissionInvalidProblem,
  MissionNotFoundProblem,
  validateMissionDefinition,
} from "./MissionContracts";
import type {
  MissionAggregate,
  MissionCommand,
  MissionDefinition,
  MissionEvidence,
  MissionIngestResult,
  MissionInstance,
  MissionProgress,
  MissionPublication,
  MissionServiceOptions,
} from "./types";

export class MissionService {
  constructor(private readonly options: MissionServiceOptions) {}
  private now(): string {
    const instant = (this.options.clock ?? (() => new Date()))();
    if (!(instant instanceof Date) || !Number.isFinite(instant.getTime()))
      throw new MissionInvalidProblem("Invalid server clock");
    const value = instant.toISOString();
    missionInstant(value);
    return value;
  }
  private async authorize(command: MissionCommand, operation: "read" | "write"): Promise<void> {
    if (!command || typeof command !== "object" || !command.key || typeof command.key !== "object")
      throw new MissionInvalidProblem("Command and key required");
    assertMissionScope(command.key.scope);
    for (const field of ["subjectId", "missionId", "episodeId"] as const)
      missionText(command.key[field], field);
    missionText(command.actor?.id, "actor");
    missionDate(command.key.periodKey);
    if (
      !Number.isSafeInteger(command.key.version) ||
      command.key.version < 1 ||
      command.key.version > 2147483647
    )
      throw new MissionInvalidProblem("Invalid version");
    if (
      !(await this.options.authorization.authorize({
        actor: command.actor,
        scope: command.key.scope,
        subjectId: command.key.subjectId,
        operation,
      }))
    )
      throw new MissionAccessDeniedProblem();
  }
  private async definition(command: MissionCommand): Promise<MissionDefinition> {
    const publication = await this.options.store.getDefinition(
      command.key.scope,
      command.key.missionId,
      command.key.version,
    );
    if (!publication) throw new MissionNotFoundProblem();
    validateMissionDefinition(publication.definition);
    if (
      missionPeriod(publication.definition, command.key.periodKey).periodKey !==
      command.key.periodKey
    )
      throw new MissionInvalidProblem("Key is not a period start");
    return publication.definition;
  }
  private instance(definition: MissionDefinition, periodKey: string): MissionInstance {
    return {
      ...missionPeriod(definition, periodKey),
      progress: 0,
      state: "active",
      activityDates: [],
    };
  }
  private progress(aggregate: MissionAggregate): MissionProgress {
    const instance = aggregate.instances[aggregate.key.periodKey];
    if (!instance) throw new MissionInvalidProblem("Missing aggregate period");
    return structuredClone({
      key: aggregate.key,
      definition: aggregate.definition,
      instance,
      remaining: Math.max(0, aggregate.definition.target - instance.progress),
    });
  }
  private aggregate(command: MissionCommand, definition: MissionDefinition): MissionAggregate {
    return {
      key: structuredClone(command.key),
      definition: structuredClone(definition),
      instances: { [command.key.periodKey]: this.instance(definition, command.key.periodKey) },
      receipts: {},
      completions: {},
    };
  }
  async publishDefinition(input: {
    actor: { id: string };
    publication: MissionPublication;
  }): Promise<MissionPublication> {
    if (
      !input ||
      typeof input !== "object" ||
      !input.publication ||
      typeof input.publication !== "object"
    )
      throw new MissionInvalidProblem("Publication required");
    const { publication, actor } = input;
    assertMissionScope(publication.scope);
    validateMissionDefinition(publication.definition);
    for (const field of ["actorId", "reason", "idempotencyKey"] as const)
      missionText(publication[field], field);
    missionInstant(publication.publishedAt);
    missionText(actor?.id, "actor");
    if (
      actor.id !== publication.actorId ||
      !(await this.options.authorization.authorize({
        actor,
        scope: publication.scope,
        operation: "publish",
      }))
    )
      throw new MissionAccessDeniedProblem();
    if (
      !Number.isSafeInteger(publication.revision) ||
      publication.revision < 1 ||
      publication.revision > 2147483647
    )
      throw new MissionInvalidProblem("Invalid publication revision");
    return this.options.store.publish(structuredClone(publication));
  }
  async getProgress(command: MissionCommand): Promise<MissionProgress> {
    await this.authorize(command, "read");
    const definition = await this.definition(command);
    const aggregate = await this.options.store.read(command.key);
    return this.progress(aggregate ?? this.aggregate(command, definition));
  }
  async ingestEvidence(
    command: MissionCommand & { evidence: MissionEvidence },
  ): Promise<MissionIngestResult> {
    await this.authorize(command, "write");
    const definition = await this.definition(command);
    if (
      !command.evidence ||
      typeof command.evidence !== "object" ||
      Array.isArray(command.evidence)
    )
      throw new MissionInvalidProblem("Evidence required");
    if (
      Object.keys(command.evidence).some(
        (key) => !["eventId", "actionId", "occurredAt", "reversalOf"].includes(key),
      )
    )
      throw new MissionInvalidProblem("Unknown evidence field");
    const evidence: MissionEvidence = {
      eventId: command.evidence.eventId,
      actionId: command.evidence.actionId,
      occurredAt: command.evidence.occurredAt,
      ...(command.evidence.reversalOf === undefined
        ? {}
        : { reversalOf: command.evidence.reversalOf }),
    };
    missionText(evidence.eventId, "eventId");
    missionText(evidence.actionId, "actionId");
    if (evidence.reversalOf !== undefined) missionText(evidence.reversalOf, "reversalOf");
    missionInstant(evidence.occurredAt);
    if (evidence.actionId !== definition.actionId)
      throw new MissionInvalidProblem("Action does not match mission");
    const acceptedAt = this.now();
    if (missionInstant(evidence.occurredAt) > missionInstant(acceptedAt))
      throw new MissionInvalidProblem("Evidence is in the future");
    if (!(await this.options.verifier.verify({ key: command.key, actor: command.actor, evidence })))
      throw new MissionAccessDeniedProblem();
    return this.options.store.transaction<MissionIngestResult>(command.key, (current) => {
      const aggregate = current ?? this.aggregate(command, definition);
      const previous = Object.hasOwn(aggregate.receipts, evidence.eventId)
        ? aggregate.receipts[evidence.eventId]
        : undefined;
      if (previous) {
        const {
          acceptedAt: _acceptedAt,
          periodKey: _periodKey,
          activityDate: _activityDate,
          effect: _effect,
          ...original
        } = previous;
        if (missionKey(original) !== missionKey(evidence))
          throw new MissionConflictProblem("Event payload changed");
        return {
          aggregate,
          result: {
            progress: this.progress(aggregate),
            receipt: previous,
            duplicate: true,
            completionCreated: false,
          },
        };
      }
      if (
        !evidence.reversalOf &&
        Object.values(aggregate.receipts).filter((receipt) => !receipt.reversalOf).length >= 10000
      )
        throw new MissionInvalidProblem("Period original receipt limit reached");
      const pinned = aggregate.definition;
      const instance = aggregate.instances[command.key.periodKey];
      if (!instance) throw new MissionInvalidProblem("Missing aggregate period");
      let activityDate = missionLocalDate(evidence.occurredAt, pinned.timezone);
      if (evidence.reversalOf) {
        const original = Object.hasOwn(aggregate.receipts, evidence.reversalOf)
          ? aggregate.receipts[evidence.reversalOf]
          : undefined;
        if (!original || original.reversalOf || original.effect !== "counted")
          throw new MissionInvalidProblem("Correction requires original counted evidence");
        if (
          Object.values(aggregate.receipts).some(
            (receipt) => receipt.reversalOf === evidence.reversalOf,
          )
        )
          throw new MissionConflictProblem("Evidence already reversed");
        activityDate = original.activityDate;
      }
      if (missionPeriod(pinned, activityDate).periodKey !== command.key.periodKey)
        throw new MissionInvalidProblem("Evidence belongs to another period");
      const end = missionDateStart(instance.endDate, pinned.timezone);
      const closed = instance.state === "closed";
      if (closed && (!evidence.reversalOf || pinned.closedCorrection === "reject"))
        throw new MissionConflictProblem("Period is closed");
      if (!evidence.reversalOf && missionInstant(acceptedAt) > end + pinned.lateAcceptanceMs)
        throw new MissionConflictProblem("Evidence acceptance deadline passed");
      const receipt = {
        ...evidence,
        acceptedAt,
        periodKey: instance.periodKey,
        activityDate,
        effect:
          closed && pinned.closedCorrection === "record-only"
            ? ("record-only" as const)
            : ("counted" as const),
      };
      Object.defineProperty(aggregate.receipts, evidence.eventId, {
        value: receipt,
        enumerable: true,
        configurable: true,
        writable: true,
      });
      const reversed = new Set(
        Object.values(aggregate.receipts)
          .filter((item) => item.reversalOf && item.effect === "counted")
          .map((item) => item.reversalOf),
      );
      const active = Object.values(aggregate.receipts).filter(
        (item) => !item.reversalOf && !reversed.has(item.eventId) && item.effect === "counted",
      );
      instance.activityDates = [...new Set(active.map((item) => item.activityDate))].sort();
      let count = pinned.countMode === "events" ? active.length : instance.activityDates.length;
      if (pinned.countMode === "streak") {
        count = 0;
        let run = 0;
        let previousDay: number | undefined;
        for (const date of instance.activityDates) {
          const day = missionDate(date);
          run = previousDay !== undefined && day - previousDay === 86400000 ? run + 1 : 1;
          count = Math.max(count, run);
          previousDay = day;
        }
      }
      instance.progress = Math.min(count, pinned.perPeriodCap);
      instance.state = closed
        ? "closed"
        : instance.progress >= pinned.target
          ? "achieved"
          : "active";
      let completionCreated = false;
      if (instance.progress >= pinned.target && !aggregate.completions[instance.periodKey]) {
        const completion = {
          id: missionKey([command.key, "completion"]),
          periodKey: instance.periodKey,
          achievedAt: acceptedAt,
          eventId: evidence.eventId,
        };
        aggregate.completions[instance.periodKey] = completion;
        instance.completion = completion;
        completionCreated = true;
      }
      return {
        aggregate,
        result: {
          progress: this.progress(aggregate),
          receipt,
          duplicate: false,
          completionCreated,
        },
      };
    });
  }
  async closePeriod(command: MissionCommand): Promise<MissionProgress> {
    await this.authorize(command, "write");
    const definition = await this.definition(command);
    const now = this.now();
    return this.options.store.transaction(command.key, (current) => {
      const aggregate = current ?? this.aggregate(command, definition);
      const instance = aggregate.instances[command.key.periodKey];
      if (!instance) throw new MissionInvalidProblem("Missing aggregate period");
      if (
        missionInstant(now) <
        missionDateStart(instance.endDate, aggregate.definition.timezone) +
          aggregate.definition.lateAcceptanceMs
      )
        throw new MissionConflictProblem("Acceptance window is still open");
      instance.closedAt ??= now;
      instance.state = "closed";
      return { aggregate, result: this.progress(aggregate) };
    });
  }
}
