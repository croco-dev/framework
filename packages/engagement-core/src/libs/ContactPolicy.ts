import { Problem, ProblemCategory } from "@croco/problems-core";
import type { MessageChannel } from "./MessageContracts";

export type ContactPolicyScope = Readonly<{ app: string; environment: string; tenantId: string }>;
export type ContactPolicyTopic = Readonly<{
  id: string;
  kind: "marketing" | "transactional" | "security";
  priority: number;
  messageIds: readonly string[];
}>;
export type ContactPolicyRule = Readonly<{
  id: string;
  channel?: MessageChannel;
  topic?: string;
  limit: number;
  windowMs: number;
  minimumSpacingMs?: number;
}>;
export type ContactPolicyConfig = Readonly<{
  version: string;
  rules: readonly ContactPolicyRule[];
  quietHours?: Readonly<{ startMinute: number; endMinute: number; timezone: string }>;
  reservationTtlMs: number;
}>;
export type ContactPolicyRequest = Readonly<{
  scope: ContactPolicyScope;
  recipient: string;
  channel: MessageChannel;
  topic: string;
  messageId: string;
  campaignId?: string;
  logicalSendId: string;
  payloadFingerprint: string;
  now: Date;
  endpointGroupId?: string;
}>;
export type ContactPolicyDecision = Readonly<{
  allowed: boolean;
  reason: "allowed" | "limit" | "spacing" | "quiet-hours" | "released" | "unknown";
  blockingRuleId: string | null;
  nextEligibleAt?: Date;
  blockingCampaignIds?: readonly string[];
}>;
export type ContactPolicyReservation = Readonly<{
  scope: ContactPolicyScope;
  subject: string;
  recipient: string;
  channel: MessageChannel;
  topic: string;
  messageId: string;
  campaignId?: string;
  logicalSendId: string;
  payloadFingerprint: string;
  policyVersion: string;
  windowKey: string;
  state: "reserved" | "committed" | "released" | "unknown";
  createdAt: Date;
  expiresAt: Date;
  executionIds: readonly string[];
  exempt: boolean;
  reconciliation?: ContactPolicyReconciliation;
}>;
export type ContactPolicyReconciliation = Readonly<{
  evidence: Readonly<{ reference: string; actor: string; reason: string }>;
}> &
  (
    | Readonly<{ outcome: "accepted"; executionIds: readonly string[] }>
    | Readonly<{ outcome: "not-accepted" }>
  );
export type ContactPolicyReserveResult = Readonly<{
  decision: ContactPolicyDecision;
  reservation?: ContactPolicyReservation;
  replay: boolean;
}>;
export interface ContactPolicyTransaction {
  readonly reservations: readonly ContactPolicyReservation[];
  save(reservation: ContactPolicyReservation): void;
}
/** Transactions serialize the entire scoped subject, including an initially empty ledger. */
export interface ContactPolicyStore {
  read(scope: ContactPolicyScope, subject: string): Promise<readonly ContactPolicyReservation[]>;
  transact<T>(
    scope: ContactPolicyScope,
    subject: string,
    operation: (transaction: ContactPolicyTransaction) => Promise<T>,
  ): Promise<T>;
}
export type ContactPolicyOptions = Readonly<{
  store: ContactPolicyStore;
  config: ContactPolicyConfig;
  topics: readonly ContactPolicyTopic[];
  verifyEndpointGroup?: (request: ContactPolicyRequest) => Promise<boolean>;
}>;
export type ContactPolicyReservationRef = Readonly<{
  scope: ContactPolicyScope;
  subject: string;
  logicalSendId: string;
}>;
export type EngagementContactPolicyGate = Readonly<{
  app: string;
  environment: string;
  fingerprint: (value: unknown) => string;
}> &
  (
    | Readonly<{ policy: ContactPolicy; resolvePolicy?: never }>
    | Readonly<{
        policy?: never;
        resolvePolicy: (scope: ContactPolicyScope) => Promise<ContactPolicy>;
      }>
  );

export class ContactPolicyInvalidProblem extends Problem {
  constructor(detail: string) {
    super("engagement-core/contact-policy-invalid", ProblemCategory.ValidationError, detail);
  }
}
export class ContactPolicyConflictProblem extends Problem {
  constructor(detail: string) {
    super("engagement-core/contact-policy-conflict", ProblemCategory.Conflict, detail);
  }
}

export class ContactPolicyAcceptanceUnknownProblem extends Problem {
  constructor(cause: Error) {
    super(
      "engagement-core/contact-policy-acceptance-unknown",
      ProblemCategory.InternalServerError,
      "Provider acceptance could not be durably confirmed; reconciliation is required",
      { cause, extensions: { retryable: false } },
    );
  }
}

export class ContactPolicy {
  private readonly config: ContactPolicyConfig;
  private readonly topics: ReadonlyMap<string, ContactPolicyTopic>;
  constructor(private readonly options: ContactPolicyOptions) {
    validateContactPolicyConfig(options.config);
    this.config = structuredClone(options.config);
    const topics = new Map<string, ContactPolicyTopic>();
    for (const topic of options.topics) {
      if (
        !topic.id.trim() ||
        topics.has(topic.id) ||
        !Number.isFinite(topic.priority) ||
        !["marketing", "transactional", "security"].includes(topic.kind) ||
        topic.messageIds.length === 0 ||
        topic.messageIds.some((id) => !id.trim())
      )
        throw new ContactPolicyInvalidProblem(
          "Topics require unique IDs, finite priority, a valid kind, and registered message IDs",
        );
      topics.set(topic.id, structuredClone(topic));
    }
    for (const rule of this.config.rules)
      if (rule.topic !== undefined && !topics.has(rule.topic))
        throw new ContactPolicyInvalidProblem("Rule references an unregistered topic");
    this.topics = topics;
  }
  async evaluate(request: ContactPolicyRequest): Promise<ContactPolicyDecision> {
    const subject = await this.subject(request);
    return this.decision(request, await this.options.store.read(request.scope, subject));
  }
  async reserve(request: ContactPolicyRequest): Promise<ContactPolicyReserveResult> {
    const subject = await this.subject(request);
    return this.options.store.transact(request.scope, subject, async (tx) => {
      const existing = this.existing(request, tx.reservations);
      const decision = this.decision(request, tx.reservations);
      if (existing !== undefined) return { decision, reservation: existing, replay: true };
      if (!decision.allowed) return { decision, replay: false };
      const reservation: ContactPolicyReservation = {
        scope: { ...request.scope },
        subject,
        recipient: request.recipient,
        channel: request.channel,
        topic: request.topic,
        messageId: request.messageId,
        ...(request.campaignId === undefined ? {} : { campaignId: request.campaignId }),
        logicalSendId: request.logicalSendId,
        payloadFingerprint: request.payloadFingerprint,
        policyVersion: this.config.version,
        windowKey: this.config.rules
          .map((rule) => `${rule.id}:${Math.floor(request.now.getTime() / rule.windowMs)}`)
          .join("|"),
        state: "reserved",
        createdAt: new Date(request.now),
        expiresAt: new Date(request.now.getTime() + this.config.reservationTtlMs),
        executionIds: [],
        exempt: this.topics.get(request.topic)?.kind !== "marketing",
      };
      tx.save(reservation);
      return { decision, reservation, replay: false };
    });
  }
  /** Priority applies only to this submitted batch. Ties use logicalSendId in code-unit order. */
  async reserveBatch(
    requests: readonly ContactPolicyRequest[],
  ): Promise<readonly ContactPolicyReserveResult[]> {
    for (const request of requests) await this.subject(request);
    const ordered = requests
      .map((request, index) => ({ request, index }))
      .sort(
        (a, b) =>
          (this.topics.get(b.request.topic)?.priority ?? 0) -
            (this.topics.get(a.request.topic)?.priority ?? 0) ||
          compare(a.request.logicalSendId, b.request.logicalSendId) ||
          a.index - b.index,
      );
    const results: ContactPolicyReserveResult[] = [];
    for (const { request, index } of ordered) results[index] = await this.reserve(request);
    return results;
  }
  async markUnknown(ref: ContactPolicyReservationRef): Promise<ContactPolicyReservation> {
    return this.transition(ref, "unknown", []);
  }
  async commit(
    ref: ContactPolicyReservationRef,
    executionIds: readonly string[] = [],
  ): Promise<ContactPolicyReservation> {
    return this.transition(ref, "committed", executionIds);
  }
  /** Only a reservation for which dispatch never started may be released. */
  async release(ref: ContactPolicyReservationRef): Promise<ContactPolicyReservation> {
    return this.transition(ref, "released", []);
  }
  /** The caller verifies provider evidence; ordinary expiry and retries never reconcile acceptance. */
  async reconcile(
    ref: ContactPolicyReservationRef,
    resolution: ContactPolicyReconciliation,
  ): Promise<ContactPolicyReservation> {
    assertContactPolicyScope(ref.scope);
    text(ref.subject);
    text(ref.logicalSendId);
    if (
      resolution === undefined ||
      resolution === null ||
      resolution.evidence === undefined ||
      resolution.evidence === null
    )
      throw new ContactPolicyInvalidProblem("Reconciliation requires verified provider evidence");
    text(resolution.evidence.reference);
    text(resolution.evidence.actor);
    text(resolution.evidence.reason);
    if (resolution.outcome !== "accepted" && resolution.outcome !== "not-accepted")
      throw new ContactPolicyInvalidProblem("Invalid reconciliation outcome");
    if (resolution.outcome === "accepted") {
      if (!Array.isArray(resolution.executionIds) || resolution.executionIds.length === 0)
        throw new ContactPolicyInvalidProblem("Accepted reconciliation requires execution IDs");
      for (const executionId of resolution.executionIds) text(executionId);
    }
    return this.options.store.transact(ref.scope, ref.subject, async (tx) => {
      const existing = tx.reservations.find((item) => item.logicalSendId === ref.logicalSendId);
      if (existing === undefined)
        throw new ContactPolicyConflictProblem("Reservation does not exist");
      const prior = existing.reconciliation;
      if (
        prior !== undefined &&
        prior.outcome === resolution.outcome &&
        prior.evidence.reference === resolution.evidence.reference &&
        prior.evidence.actor === resolution.evidence.actor &&
        prior.evidence.reason === resolution.evidence.reason &&
        (prior.outcome === "not-accepted" ||
          (resolution.outcome === "accepted" &&
            JSON.stringify(prior.executionIds) === JSON.stringify(resolution.executionIds)))
      )
        return existing;
      if (existing.state !== "unknown")
        throw new ContactPolicyConflictProblem("Only unknown reservations can be reconciled");
      const updated: ContactPolicyReservation = {
        ...existing,
        state: resolution.outcome === "accepted" ? "committed" : "released",
        executionIds: resolution.outcome === "accepted" ? [...resolution.executionIds] : [],
        reconciliation: structuredClone(resolution),
      };
      tx.save(updated);
      return updated;
    });
  }
  private async transition(
    ref: ContactPolicyReservationRef,
    state: ContactPolicyReservation["state"],
    executionIds: readonly string[],
  ): Promise<ContactPolicyReservation> {
    assertContactPolicyScope(ref.scope);
    text(ref.subject);
    text(ref.logicalSendId);
    return this.options.store.transact(ref.scope, ref.subject, async (tx) => {
      const existing = tx.reservations.find((item) => item.logicalSendId === ref.logicalSendId);
      if (existing === undefined)
        throw new ContactPolicyConflictProblem("Reservation does not exist");
      if (existing.state === state && state !== "unknown") {
        if (
          state === "committed" &&
          JSON.stringify(existing.executionIds) !== JSON.stringify(executionIds)
        )
          throw new ContactPolicyConflictProblem("Commit result differs from the stored result");
        return existing;
      }
      if (
        state === "unknown" || state === "released"
          ? existing.state !== "reserved"
          : existing.state !== "unknown"
      )
        throw new ContactPolicyConflictProblem(`Cannot transition ${existing.state} to ${state}`);
      const updated = { ...existing, state, executionIds: [...executionIds] };
      tx.save(updated);
      return updated;
    });
  }
  private async subject(request: ContactPolicyRequest): Promise<string> {
    assertContactPolicyScope(request.scope);
    for (const value of [
      request.recipient,
      request.topic,
      request.messageId,
      request.logicalSendId,
      request.payloadFingerprint,
    ])
      text(value);
    if (
      !["email", "push", "sms", "inApp"].includes(request.channel) ||
      !(request.now instanceof Date) ||
      !Number.isFinite(request.now.getTime())
    )
      throw new ContactPolicyInvalidProblem("Request requires a supported channel and valid clock");
    if (request.campaignId !== undefined) text(request.campaignId);
    const topic = this.topics.get(request.topic);
    if (topic === undefined || !topic.messageIds.includes(request.messageId))
      throw new ContactPolicyInvalidProblem("Message is not registered for this topic");
    if (request.endpointGroupId !== undefined) {
      text(request.endpointGroupId);
      if (
        this.options.verifyEndpointGroup === undefined ||
        !(await this.options.verifyEndpointGroup(request))
      )
        throw new ContactPolicyInvalidProblem("Endpoint grouping requires a verified mapping");
      return `group:${request.endpointGroupId}`;
    }
    return `recipient:${request.recipient}`;
  }
  private existing(
    request: ContactPolicyRequest,
    reservations: readonly ContactPolicyReservation[],
  ): ContactPolicyReservation | undefined {
    const existing = reservations.find((item) => item.logicalSendId === request.logicalSendId);
    if (
      existing !== undefined &&
      (existing.payloadFingerprint !== request.payloadFingerprint ||
        existing.channel !== request.channel ||
        existing.topic !== request.topic ||
        existing.messageId !== request.messageId ||
        existing.campaignId !== request.campaignId ||
        existing.recipient !== request.recipient)
    )
      throw new ContactPolicyConflictProblem("logicalSendId was reused with different content");
    return existing;
  }
  private decision(
    request: ContactPolicyRequest,
    reservations: readonly ContactPolicyReservation[],
  ): ContactPolicyDecision {
    const existing = this.existing(request, reservations);
    if (existing !== undefined) {
      if (
        existing.state === "unknown" ||
        (existing.state === "reserved" && existing.expiresAt.getTime() <= request.now.getTime())
      )
        return { allowed: false, reason: "unknown", blockingRuleId: null };
      return {
        allowed: existing.state !== "released",
        reason: existing.state === "released" ? "released" : "allowed",
        blockingRuleId: null,
      };
    }
    if (this.topics.get(request.topic)?.kind !== "marketing") return allowed();
    const first = this.ruleDecision(request, reservations);
    if (first.allowed || first.nextEligibleAt === undefined) return first;
    let next = first.nextEligibleAt;
    while (true) {
      const decision = this.ruleDecision({ ...request, now: next }, reservations);
      if (decision.allowed) return { ...first, nextEligibleAt: next };
      if (decision.nextEligibleAt === undefined) {
        const { nextEligibleAt: _nextEligibleAt, ...permanent } = first;
        return permanent;
      }
      next = decision.nextEligibleAt;
    }
  }
  private ruleDecision(
    request: ContactPolicyRequest,
    reservations: readonly ContactPolicyReservation[],
  ): ContactPolicyDecision {
    const quiet = this.config.quietHours;
    if (quiet !== undefined && isQuiet(request.now, quiet)) {
      let next = new Date(Math.floor(request.now.getTime() / 60000) * 60000 + 60000);
      while (isQuiet(next, quiet)) next = new Date(next.getTime() + 60000);
      return {
        allowed: false,
        reason: "quiet-hours",
        blockingRuleId: "quiet-hours",
        nextEligibleAt: next,
      };
    }
    for (const rule of this.config.rules) {
      if (
        (rule.channel !== undefined && rule.channel !== request.channel) ||
        (rule.topic !== undefined && rule.topic !== request.topic)
      )
        continue;
      const charged = reservations
        .filter(
          (item) =>
            item.state !== "released" &&
            !item.exempt &&
            (rule.channel === undefined || item.channel === rule.channel) &&
            (rule.topic === undefined || item.topic === rule.topic),
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const latest = charged[0];
      if (
        latest !== undefined &&
        rule.minimumSpacingMs !== undefined &&
        latest.createdAt.getTime() + rule.minimumSpacingMs > request.now.getTime()
      )
        return {
          allowed: false,
          reason: "spacing",
          blockingRuleId: rule.id,
          blockingCampaignIds: latest.campaignId === undefined ? [] : [latest.campaignId],
          nextEligibleAt: new Date(latest.createdAt.getTime() + rule.minimumSpacingMs),
        };
      const active = charged.filter(
        (item) => item.createdAt.getTime() + rule.windowMs > request.now.getTime(),
      );
      if (active.length >= rule.limit) {
        const release = active[rule.limit - 1];
        return {
          allowed: false,
          reason: "limit",
          blockingRuleId: rule.id,
          blockingCampaignIds: [
            ...new Set(
              active.flatMap((item) => (item.campaignId === undefined ? [] : [item.campaignId])),
            ),
          ].sort(),
          ...(release === undefined
            ? {}
            : { nextEligibleAt: new Date(release.createdAt.getTime() + rule.windowMs) }),
        };
      }
    }
    return allowed();
  }
}

export function assertContactPolicyScope(scope: ContactPolicyScope): void {
  if (typeof scope !== "object" || scope === null)
    throw new ContactPolicyInvalidProblem("Explicit policy scope is required");
  text(scope.app);
  text(scope.environment);
  text(scope.tenantId);
}
export function validateContactPolicyConfig(config: ContactPolicyConfig): void {
  text(config.version);
  if (!Number.isSafeInteger(config.reservationTtlMs) || config.reservationTtlMs <= 0)
    throw new ContactPolicyInvalidProblem("reservationTtlMs must be positive");
  const ids = new Set<string>();
  for (const rule of config.rules) {
    text(rule.id);
    if (
      ids.has(rule.id) ||
      !Number.isSafeInteger(rule.limit) ||
      rule.limit < 0 ||
      !Number.isSafeInteger(rule.windowMs) ||
      rule.windowMs <= 0 ||
      (rule.minimumSpacingMs !== undefined &&
        (!Number.isSafeInteger(rule.minimumSpacingMs) || rule.minimumSpacingMs < 0)) ||
      (rule.channel !== undefined && !["email", "push", "sms", "inApp"].includes(rule.channel))
    )
      throw new ContactPolicyInvalidProblem("Invalid or duplicate contact rule");
    ids.add(rule.id);
  }
  const quiet = config.quietHours;
  if (quiet !== undefined) {
    if (
      ![quiet.startMinute, quiet.endMinute].every(
        (value) => Number.isInteger(value) && value >= 0 && value < 1440,
      ) ||
      quiet.startMinute === quiet.endMinute
    )
      throw new ContactPolicyInvalidProblem(
        "Quiet hours must have distinct minute boundaries within a day",
      );
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: quiet.timezone }).format(new Date(0));
    } catch {
      throw new ContactPolicyInvalidProblem("Invalid quiet-hours timezone");
    }
  }
}
function text(value: string): void {
  if (typeof value !== "string" || !value.trim())
    throw new ContactPolicyInvalidProblem("Contact policy identifiers must not be empty");
}
function allowed(): ContactPolicyDecision {
  return { allowed: true, reason: "allowed", blockingRuleId: null };
}
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
function isQuiet(now: Date, quiet: NonNullable<ContactPolicyConfig["quietHours"]>): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: quiet.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const minute =
    Number(parts.find((part) => part.type === "hour")?.value) * 60 +
    Number(parts.find((part) => part.type === "minute")?.value);
  return quiet.startMinute < quiet.endMinute
    ? minute >= quiet.startMinute && minute < quiet.endMinute
    : minute >= quiet.startMinute || minute < quiet.endMinute;
}

export class InMemoryContactPolicyStore implements ContactPolicyStore {
  private readonly ledgers = new Map<string, readonly ContactPolicyReservation[]>();
  private readonly locks = new Map<string, Promise<void>>();
  async read(
    scope: ContactPolicyScope,
    subject: string,
  ): Promise<readonly ContactPolicyReservation[]> {
    assertContactPolicyScope(scope);
    text(subject);
    return structuredClone(
      this.ledgers.get(JSON.stringify([scope.app, scope.environment, scope.tenantId, subject])) ??
        [],
    );
  }
  async transact<T>(
    scope: ContactPolicyScope,
    subject: string,
    operation: (transaction: ContactPolicyTransaction) => Promise<T>,
  ): Promise<T> {
    assertContactPolicyScope(scope);
    text(subject);
    const key = JSON.stringify([scope.app, scope.environment, scope.tenantId, subject]);
    const previous = this.locks.get(key) ?? Promise.resolve();
    let unlock: () => void = () => {};
    const lock = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    this.locks.set(key, lock);
    await previous;
    try {
      const reservations = [...(await this.read(scope, subject))];
      const result = await operation({
        reservations,
        save: (reservation) => {
          if (
            reservation.scope.app !== scope.app ||
            reservation.scope.environment !== scope.environment ||
            reservation.scope.tenantId !== scope.tenantId ||
            reservation.subject !== subject
          )
            throw new ContactPolicyInvalidProblem("Reservation escaped transaction scope");
          const index = reservations.findIndex(
            (item) => item.logicalSendId === reservation.logicalSendId,
          );
          if (index < 0) reservations.push(structuredClone(reservation));
          else reservations[index] = structuredClone(reservation);
        },
      });
      this.ledgers.set(key, structuredClone(reservations));
      return structuredClone(result);
    } finally {
      unlock();
      if (this.locks.get(key) === lock) this.locks.delete(key);
    }
  }
}
