import { Problem, ProblemCategory } from "@croco/problems-core";
import type {
  JourneyCommand,
  JourneyDryRunResult,
  JourneyDryRunStep,
  JourneyDispatchProblemCode,
  JourneyContext,
  JourneyDefinition,
  JourneyEngineOptions,
  JourneyEntry,
  JourneyEpisode,
  JourneyNode,
  JourneyReference,
  JourneyReconciliation,
  JourneyScope,
} from "./types";

export class JourneyProblem extends Problem {
  constructor(code: string, message: string) {
    super(`lifecycle-core/journey-${code}`, ProblemCategory.Conflict, message);
  }
}
export function validateJourneyScope(scope: JourneyScope): void {
  if (!scope.appId?.trim() || !scope.environment?.trim() || !scope.tenantId?.trim())
    throw new JourneyProblem("scope", "App, environment and tenant are required");
}
export class JourneyEngine {
  private readonly definitions = new Map<string, JourneyDefinition>();
  private readonly now: () => Date;
  constructor(private readonly options: JourneyEngineOptions) {
    this.now = options.now ?? (() => new Date());
  }
  register(definition: JourneyDefinition): void {
    const key = JSON.stringify([definition.id, definition.version]);
    if (this.definitions.has(key))
      throw new JourneyProblem("version", "Definition version is immutable");
    if (
      !definition.id.trim() ||
      !definition.version.trim() ||
      !["once", "episode-key"].includes(definition.reentry) ||
      definition.nodes.length < 1 ||
      definition.nodes.length > 8 ||
      !Number.isFinite(definition.unknownRetryMs) ||
      definition.unknownRetryMs <= 0 ||
      !Number.isFinite(definition.unknownDeadlineMs) ||
      definition.unknownDeadlineMs <= 0
    )
      throw new JourneyProblem("definition", "Invalid bounded definition");
    const nodes = new Map(definition.nodes.map((node) => [node.id, node]));
    if (nodes.size !== definition.nodes.length || !nodes.has(definition.entry))
      throw new JourneyProblem("graph", "Duplicate node or missing entry");
    this.validateReference(definition.goal, false);
    const visited = new Set<string>();
    const active = new Set<string>();
    const visit = (id: string): void => {
      if (active.has(id)) throw new JourneyProblem("graph", "Cycles are forbidden");
      if (visited.has(id)) return;
      const node = nodes.get(id);
      if (!node || !id.trim()) throw new JourneyProblem("graph", "Missing node");
      active.add(id);
      if (node.kind === "wait") {
        if (!Number.isFinite(node.durationMs) || node.durationMs <= 0)
          throw new JourneyProblem("definition", "Wait must be positive");
        visit(node.next);
      } else if (node.kind === "action") {
        this.validateReference(node.action, true);
        visit(node.next);
      } else if (node.kind === "condition") {
        this.validateReference(node.predicate, false);
        visit(node.matched);
        visit(node.unmatched);
      } else if (node.kind !== "end")
        throw new JourneyProblem("definition", "Unsupported node kind");
      active.delete(id);
      visited.add(id);
    };
    visit(definition.entry);
    if (visited.size !== nodes.size)
      throw new JourneyProblem("graph", "Unreachable nodes are forbidden");
    this.definitions.set(key, structuredClone(definition));
  }
  private validateReference(reference: JourneyReference, action: boolean): void {
    const registry = action ? this.options.actions : this.options.predicates;
    const registration = Object.hasOwn(registry, reference.registration)
      ? registry[reference.registration]
      : undefined;
    if (!registration) throw new JourneyProblem("registration", "Unregistered action or predicate");
    if (
      action &&
      !this.options.capabilities.includes(this.options.actions[reference.registration].capability)
    )
      throw new JourneyProblem("capability", "Action capability is unavailable");
    try {
      registration.validate(reference.params);
    } catch {
      throw new JourneyProblem("parameters", "Registered parameter validation failed");
    }
  }
  private definition(id: string, version: string): JourneyDefinition {
    const definition = this.definitions.get(JSON.stringify([id, version]));
    if (!definition) throw new JourneyProblem("version", "Definition version is unavailable");
    return definition;
  }
  private initial(definition: JourneyDefinition, input: JourneyEntry): JourneyEpisode {
    validateJourneyScope(input.scope);
    if (
      ![
        input.id,
        input.subject,
        input.businessObjectRef,
        input.episodeKey,
        input.sourceEventId,
      ].every((value) => value?.trim())
    )
      throw new JourneyProblem("entry", "Entry identity and sourceEventId are required");
    return {
      ...structuredClone(input),
      definitionId: definition.id,
      definitionVersion: definition.version,
      definitionSnapshot: JSON.stringify(definition),
      reentryKey: JSON.stringify([
        definition.id,
        input.subject,
        input.businessObjectRef,
        definition.reentry === "once" ? null : input.episodeKey,
      ]),
      nodeId: definition.entry,
      wakeAt: null,
      status: "running",
      revision: 0,
      startedAt: this.now().toISOString(),
      unknownSince: null,
      unknownSource: null,
      reason: "entered",
      receipts: [],
      intents: [],
      commands: [],
      reconciliations: [],
    };
  }
  async enter(id: string, version: string, input: JourneyEntry): Promise<JourneyEpisode> {
    return (await this.options.store.create(this.initial(this.definition(id, version), input)))
      .episode;
  }
  private async load(scope: JourneyScope, id: string): Promise<JourneyEpisode> {
    validateJourneyScope(scope);
    const episode = await this.options.store.get(scope, id);
    if (!episode) throw new JourneyProblem("not-found", "Episode not found in scope");
    const registered = this.definition(episode.definitionId, episode.definitionVersion);
    if (JSON.stringify(registered) !== episode.definitionSnapshot)
      throw new JourneyProblem(
        "version-drift",
        "Pinned definition differs from the registered version",
      );
    return episode;
  }
  private async save(previous: JourneyEpisode, next: JourneyEpisode): Promise<JourneyEpisode> {
    next.revision = previous.revision + 1;
    if (
      !(await this.options.store.compareAndSet(
        previous.scope,
        previous.id,
        previous.revision,
        next,
      ))
    )
      throw new JourneyProblem("stale-revision", "Episode changed concurrently");
    return next;
  }
  private receipt(episode: JourneyEpisode, reason: string, now: Date): void {
    episode.reason = reason;
    episode.receipts.push({
      nodeId: episode.nodeId,
      evaluatedAt: now.toISOString(),
      reason,
      sourceEventId: episode.sourceEventId,
    });
  }
  private defer(
    episode: JourneyEpisode,
    definition: JourneyDefinition,
    now: Date,
    source: string,
  ): void {
    if (episode.unknownSource !== source) episode.unknownSince = null;
    episode.unknownSource = source;
    episode.unknownSince ??= now.toISOString();
    const deadline = Date.parse(episode.unknownSince) + definition.unknownDeadlineMs;
    episode.status = now.getTime() >= deadline ? "failed" : "waiting";
    episode.wakeAt =
      episode.status === "waiting"
        ? new Date(Math.min(deadline, now.getTime() + definition.unknownRetryMs)).toISOString()
        : null;
    this.receipt(
      episode,
      episode.status === "failed" ? "blocked-unknown-deadline" : "unknown-deferred",
      now,
    );
  }
  private async goal(
    definition: JourneyDefinition,
    context: JourneyContext,
  ): Promise<boolean | "unknown"> {
    return this.options.predicates[definition.goal.registration].evaluate(
      context,
      definition.goal.params,
    );
  }
  async tick(scope: JourneyScope, id: string, expectedRevision?: number): Promise<JourneyEpisode> {
    const previous = await this.load(scope, id);
    if (expectedRevision !== undefined && previous.revision !== expectedRevision) return previous;
    if (!["running", "waiting"].includes(previous.status)) return previous;
    const now = this.now();
    const definition = this.definition(previous.definitionId, previous.definitionVersion);
    const next = structuredClone(previous);
    const context = { episode: structuredClone(previous), now };
    const goal = await this.goal(definition, context);
    if (goal === true) {
      next.status = "exited";
      next.wakeAt = null;
      this.receipt(next, "goal-achieved", now);
      return this.save(previous, next);
    }
    if (goal === "unknown") {
      this.defer(next, definition, now, "goal");
      return this.save(previous, next);
    }
    if (next.unknownSource === "goal") {
      next.unknownSince = null;
      next.unknownSource = null;
    }
    if (previous.wakeAt && Date.parse(previous.wakeAt) > now.getTime())
      return next.unknownSince !== previous.unknownSince ? this.save(previous, next) : previous;
    const node = definition.nodes.find((candidate) => candidate.id === previous.nodeId);
    if (!node) throw new JourneyProblem("node", "Pinned node is unavailable");
    if (node.kind === "action") return this.dispatch(previous, next, definition, node, now);
    if (node.kind === "wait") {
      next.unknownSince = null;
      const entered = [...previous.receipts]
        .reverse()
        .find((receipt) => receipt.nodeId === node.id && receipt.reason === "wait-started");
      if (!entered) {
        next.status = "waiting";
        next.wakeAt = new Date(now.getTime() + node.durationMs).toISOString();
        this.receipt(next, "wait-started", now);
      } else if (Date.parse(entered.evaluatedAt) + node.durationMs > now.getTime()) {
        next.status = "waiting";
        next.wakeAt = new Date(Date.parse(entered.evaluatedAt) + node.durationMs).toISOString();
      } else {
        this.receipt(next, "wait-finished", now);
        next.nodeId = node.next;
        next.status = "running";
        next.wakeAt = null;
      }
    } else if (node.kind === "condition") {
      const result = await this.options.predicates[node.predicate.registration].evaluate(
        context,
        node.predicate.params,
      );
      if (result === "unknown") this.defer(next, definition, now, `condition:${node.id}`);
      else {
        this.receipt(next, result ? "matched" : "no-match", now);
        next.nodeId = result ? node.matched : node.unmatched;
        next.status = "running";
        next.wakeAt = null;
        next.unknownSince = null;
      }
    } else {
      next.status = "completed";
      next.wakeAt = null;
      this.receipt(next, "completed", now);
    }
    return this.save(previous, next);
  }
  private async dispatch(
    previous: JourneyEpisode,
    next: JourneyEpisode,
    definition: JourneyDefinition,
    node: Extract<JourneyNode, { kind: "action" }>,
    now: Date,
  ): Promise<JourneyEpisode> {
    const context = { episode: structuredClone(previous), now };
    const latest = await this.options.checkLatest(context);
    const goal = await this.goal(definition, context);
    const checks = { ...latest, goal, evaluatedAt: this.now().toISOString() };
    const executionReference = JSON.stringify(["journey", previous.id, node.id, previous.revision]);
    this.receipt(next, "action-checks", this.now());
    Object.assign(next.receipts[next.receipts.length - 1], { checks, executionReference });
    if (goal === true || latest.consent === false || latest.resource === false) {
      next.status = "exited";
      next.wakeAt = null;
      this.receipt(
        next,
        goal === true
          ? "goal-achieved"
          : latest.consent === false
            ? "consent-denied"
            : "resource-invalid",
        now,
      );
      return this.save(previous, next);
    }
    if (goal === "unknown" || latest.consent === "unknown" || latest.resource === "unknown") {
      this.defer(
        next,
        definition,
        now,
        goal === "unknown" ? "goal" : latest.consent === "unknown" ? "consent" : "resource",
      );
      return this.save(previous, next);
    }
    const identity = JSON.stringify([previous.scope, previous.id, node.id]);
    const intent = {
      episodeId: previous.id,
      nodeId: node.id,
      attemptIdentity: identity,
      idempotencyKey: identity,
      status: "admitted" as const,
      checks,
      executionReference,
    };
    next.intents.push(intent);
    next.status = "indeterminate";
    next.wakeAt = null;
    this.receipt(next, "dispatch-admitted", now);
    Object.assign(next.receipts[next.receipts.length - 1], { checks, executionReference });
    const admitted = await this.save(previous, next);
    let result: "accepted" | "rejected" | "indeterminate";
    let problemCode: JourneyDispatchProblemCode | undefined;
    try {
      result = await this.options.actions[node.action.registration].dispatch(
        context,
        node.action.params,
        intent,
      );
    } catch (error) {
      result = "indeterminate";
      problemCode =
        error instanceof Problem
          ? "lifecycle-core/journey-provider-problem"
          : "lifecycle-core/journey-provider-exception";
    }
    if (result === "indeterminate" && !problemCode)
      problemCode = "lifecycle-core/journey-acceptance-unknown";
    const evidence = { checks, executionReference, ...(problemCode ? { problemCode } : {}) };
    const finalized = structuredClone(admitted);
    Object.assign(finalized.intents[finalized.intents.length - 1], { status: result, ...evidence });
    finalized.status =
      result === "accepted" ? "running" : result === "rejected" ? "failed" : "indeterminate";
    this.receipt(finalized, `dispatch-${result}`, this.now());
    Object.assign(finalized.receipts[finalized.receipts.length - 1], evidence);
    if (result === "accepted") {
      finalized.nodeId = node.next;
      finalized.unknownSince = null;
    }
    // A concurrent operator stop/pause is authoritative after admission; accepted work is not retractable.
    if (
      !(await this.options.store.compareAndSet(admitted.scope, admitted.id, admitted.revision, {
        ...finalized,
        revision: admitted.revision + 1,
      }))
    ) {
      const current = await this.load(admitted.scope, admitted.id);
      const currentIntent = current.intents.find(
        (item) => item.attemptIdentity === intent.attemptIdentity,
      );
      if (current.status !== "exited" || currentIntent?.status !== "admitted") return current;
      const stopped = structuredClone(current);
      const stoppedIntent = stopped.intents.find(
        (item) => item.attemptIdentity === intent.attemptIdentity,
      );
      if (!stoppedIntent) throw new JourneyProblem("intent", "Admitted intent disappeared");
      Object.assign(stoppedIntent, { status: result, ...evidence });
      stopped.receipts.push({
        nodeId: node.id,
        evaluatedAt: this.now().toISOString(),
        reason: `dispatch-${result}-after-stop`,
        ...evidence,
        sourceEventId: stopped.sourceEventId,
      });
      return this.save(current, stopped);
    }
    return { ...finalized, revision: admitted.revision + 1 };
  }
  async command(scope: JourneyScope, id: string, command: JourneyCommand): Promise<JourneyEpisode> {
    if (
      ![command.actor, command.reason, command.idempotencyKey].every((value) => value?.trim()) ||
      !["pause", "resume", "stop"].includes(command.type)
    )
      throw new JourneyProblem("command", "Actor, reason and command identity are required");
    const previous = await this.load(scope, id);
    const existing = previous.commands.find(
      (item) => item.idempotencyKey === command.idempotencyKey,
    );
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(command))
        throw new JourneyProblem("command-conflict", "Command identity reused");
      return previous;
    }
    if (previous.revision !== command.expectedRevision)
      throw new JourneyProblem("stale-revision", "Episode changed concurrently");
    const next = structuredClone(previous);
    if (command.type === "pause" && ["running", "waiting"].includes(previous.status))
      next.status = "paused";
    else if (command.type === "resume" && previous.status === "paused") {
      next.status = "running";
      const definition = this.definition(previous.definitionId, previous.definitionVersion);
      const node = definition.nodes.find((item) => item.id === previous.nodeId);
      if (node?.kind === "wait") {
        next.status = "waiting";
        next.wakeAt = new Date(this.now().getTime() + node.durationMs).toISOString();
        this.receipt(next, "wait-started", this.now());
      } else next.wakeAt = null;
    } else if (
      command.type === "stop" &&
      ["running", "waiting", "paused", "indeterminate"].includes(previous.status)
    ) {
      next.status = "exited";
      next.wakeAt = null;
    } else throw new JourneyProblem("transition", "Unsupported episode transition");
    next.commands.push(structuredClone(command));
    this.receipt(next, `operator-${command.type}`, this.now());
    return this.save(previous, next);
  }
  async reconcile(
    scope: JourneyScope,
    id: string,
    reconciliation: JourneyReconciliation,
  ): Promise<JourneyEpisode> {
    if (
      ![
        reconciliation.actor,
        reconciliation.reason,
        reconciliation.proofReference,
        reconciliation.idempotencyKey,
        reconciliation.attemptIdentity,
      ].every((value) => value?.trim()) ||
      !["accepted", "rejected"].includes(reconciliation.outcome)
    )
      throw new JourneyProblem("reconciliation", "Acceptance proof and actor audit are required");
    const previous = await this.load(scope, id);
    const existing = previous.reconciliations.find(
      (item) => item.idempotencyKey === reconciliation.idempotencyKey,
    );
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(reconciliation))
        throw new JourneyProblem("command-conflict", "Reconciliation identity reused");
      return previous;
    }
    if (previous.revision !== reconciliation.expectedRevision)
      throw new JourneyProblem("stale-revision", "Episode changed concurrently");
    if (previous.status !== "indeterminate")
      throw new JourneyProblem("transition", "Only uncertain acceptance can be reconciled");
    const next = structuredClone(previous);
    const intent = next.intents.find(
      (item) => item.attemptIdentity === reconciliation.attemptIdentity,
    );
    const node = this.definition(previous.definitionId, previous.definitionVersion).nodes.find(
      (item) => item.id === previous.nodeId,
    );
    if (
      !intent ||
      !["admitted", "indeterminate"].includes(intent.status) ||
      node?.kind !== "action" ||
      intent.nodeId !== node.id
    )
      throw new JourneyProblem("reconciliation", "Uncertain action intent is unavailable");
    intent.status = reconciliation.outcome;
    next.status = reconciliation.outcome === "accepted" ? "running" : "failed";
    next.wakeAt = null;
    next.unknownSince = null;
    next.unknownSource = null;
    this.receipt(next, `reconciled-${reconciliation.outcome}`, this.now());
    if (reconciliation.outcome === "accepted") next.nodeId = node.next;
    next.reconciliations.push(structuredClone(reconciliation));
    return this.save(previous, next);
  }
  async dryRun(id: string, version: string, input: JourneyEntry): Promise<JourneyDryRunResult> {
    const definition = this.definition(id, version);
    const episode = this.initial(definition, input);
    let projectedAt = this.now();
    const context = { episode: structuredClone(episode), now: projectedAt };
    let goal = await this.goal(definition, context);
    let checks = await this.options.checkLatest(context);
    const steps: JourneyDryRunStep[] = [];
    let nodeId = definition.entry;
    for (let index = 0; index < definition.nodes.length; index++) {
      const node = definition.nodes.find((candidate) => candidate.id === nodeId);
      if (!node) throw new JourneyProblem("node", "Dry-run node is unavailable");
      context.episode.nodeId = nodeId;
      context.now = projectedAt;
      if (index > 0) goal = await this.goal(definition, context);
      if (node.kind === "action") {
        checks = await this.options.checkLatest(context);
        goal = await this.goal(definition, context);
      }
      const step: JourneyDryRunStep = {
        nodeId,
        kind: node.kind,
        outcome: "completed",
        reason: "completed",
        evaluatedAt: this.now().toISOString(),
        projectedAt: projectedAt.toISOString(),
        checks: { goal, ...checks },
      };
      if (
        goal === true ||
        (node.kind === "action" && (checks.consent === false || checks.resource === false))
      ) {
        step.outcome = "suppressed";
        step.reason =
          goal === true
            ? "goal-achieved"
            : checks.consent === false
              ? "consent-denied"
              : "resource-invalid";
        steps.push(step);
        break;
      }
      let unknown =
        goal === "unknown" ||
        (node.kind === "action" && (checks.consent === "unknown" || checks.resource === "unknown"));
      if (!unknown && node.kind === "condition") {
        const matched = await this.options.predicates[node.predicate.registration].evaluate(
          context,
          node.predicate.params,
        );
        step.conditionResult = matched;
        unknown = matched === "unknown";
        if (!unknown) {
          step.outcome = matched ? "matched" : "no-match";
          step.reason = step.outcome;
          nodeId = matched ? node.matched : node.unmatched;
        }
      }
      if (unknown) {
        step.outcome = "deferred";
        step.reason = "unknown-deferred";
        step.wakeAt = new Date(
          projectedAt.getTime() + Math.min(definition.unknownRetryMs, definition.unknownDeadlineMs),
        ).toISOString();
        step.deadlineAt = new Date(
          projectedAt.getTime() + definition.unknownDeadlineMs,
        ).toISOString();
        step.deadlineReason = "blocked-unknown-deadline";
        steps.push(step);
        break;
      }
      if (node.kind === "wait") {
        projectedAt = new Date(projectedAt.getTime() + node.durationMs);
        step.outcome = "wait";
        step.reason = "wait-projected";
        step.wakeAt = projectedAt.toISOString();
        nodeId = node.next;
      } else if (node.kind === "action") {
        step.outcome = "proposed";
        step.reason = "action-proposed";
        nodeId = node.next;
      }
      steps.push(step);
      if (node.kind === "end") break;
    }
    return { episode, goal, checks, nodes: structuredClone(definition.nodes), steps };
  }
}
