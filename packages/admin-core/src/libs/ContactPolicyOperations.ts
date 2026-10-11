import { Problem, ProblemCategory } from "@croco/problems-core";
import type {
  ContactPolicy,
  ContactPolicyConfig,
  ContactPolicyDecision,
  ContactPolicyRequest,
  ContactPolicyScope,
  ContactPolicyTopic,
} from "@croco/engagement-core";

export type ContactPolicyAdminScope = Readonly<{ scope: ContactPolicyScope; subject: string }>;
export type ContactPolicyAdminAccess = Readonly<{
  actorId: string;
  permissions: readonly ("contact-policy.read" | "contact-policy.write")[];
}>;
export type ContactPolicyAdminRegistration = Readonly<{
  config: ContactPolicyConfig;
  topics: readonly ContactPolicyTopic[];
  limits: Readonly<Record<string, Readonly<{ min: number; max: number }>>>;
  quietHours: boolean;
  priorities: Readonly<Record<string, Readonly<{ min: number; max: number }>>>;
}>;
export type ContactPolicyAdminSnapshot = Readonly<{
  revision: number;
  config: ContactPolicyConfig;
  topics: readonly ContactPolicyTopic[];
}>;
export type ContactPolicySuppression = Readonly<{
  logicalSendId: string;
  campaignId?: string;
  occurredAt: Date;
  decision: ContactPolicyDecision;
}>;
export type ContactPolicyAdminView = Readonly<{
  policy: ContactPolicyAdminSnapshot;
  recentSuppressions: readonly ContactPolicySuppression[];
  historyComplete: boolean;
}>;
export type ContactPolicyAdminEdit = Readonly<{
  limits: Readonly<Record<string, number>>;
  quietHours?: ContactPolicyConfig["quietHours"] | null;
  priorities: Readonly<Record<string, number>>;
  expectedRevision: number;
  reason: string;
  idempotencyKey: string;
}>;
export type ContactPolicyAdminSave = Readonly<{
  edit: ContactPolicyAdminEdit;
  target: ContactPolicyAdminScope;
  policy: ContactPolicyAdminSnapshot;
  expectedRevision: number;
  actorId: string;
  reason: string;
  idempotencyKey: string;
}>;
/** Settings and write keys are scoped by app/environment/tenant; subject only selects authorized history.
 * Implementations atomically compare revision, persist policy and audit, and reject changed key reuse. */
export interface ContactPolicyAdminStore {
  load(target: ContactPolicyAdminScope): Promise<ContactPolicyAdminView | undefined>;
  save(input: ContactPolicyAdminSave): Promise<ContactPolicyAdminSnapshot>;
}
export type ContactPolicyConsoleState =
  | Readonly<{ kind: "loading" | "empty" }>
  | Readonly<{ kind: "denied" | "error"; code: string }>
  | Readonly<{
      kind: "ready" | "partial";
      view: ContactPolicyAdminView;
      decision?: ContactPolicyDecision;
    }>;

export class ContactPolicyAdminProblem extends Problem {
  constructor(detail: string) {
    super("admin-core/contact-policy-invalid", ProblemCategory.ValidationError, detail);
  }
}

export class ContactPolicyAdminAccessProblem extends Problem {
  constructor() {
    super(
      "admin-core/contact-policy-denied",
      ProblemCategory.Forbidden,
      "Contact policy access denied",
    );
  }
}

/** Reject persisted settings that require an explicit migration to the current code registration. */
export function assertContactPolicyRegistration(
  snapshot: ContactPolicyAdminSnapshot,
  registration: ContactPolicyAdminRegistration,
): void {
  const fail = () => {
    throw new ContactPolicyAdminProblem(
      "Persisted contact policy does not match code registration; migrate or reinitialize settings",
    );
  };
  const permitted = (
    id: string,
    value: number,
    initial: number,
    bounds: Readonly<Record<string, Readonly<{ min: number; max: number }>>>,
  ) => {
    const bound = Object.hasOwn(bounds, id) ? bounds[id] : undefined;
    return bound
      ? Number.isFinite(value) &&
          (value === initial || Number.isSafeInteger(value)) &&
          value >= bound.min &&
          value <= bound.max
      : Number.isFinite(value) && value === initial;
  };
  if (
    !Number.isSafeInteger(snapshot.revision) ||
    snapshot.revision < 0 ||
    snapshot.config.version !==
      (snapshot.revision === 0
        ? registration.config.version
        : `${registration.config.version}:${snapshot.revision}`) ||
    snapshot.config.reservationTtlMs !== registration.config.reservationTtlMs ||
    snapshot.config.rules.length !== registration.config.rules.length ||
    snapshot.topics.length !== registration.topics.length ||
    new Set(snapshot.config.rules.map((rule) => rule.id)).size !== snapshot.config.rules.length ||
    new Set(snapshot.topics.map((topic) => topic.id)).size !== snapshot.topics.length
  )
    fail();
  for (const rule of snapshot.config.rules) {
    const registered = registration.config.rules.find((candidate) => candidate.id === rule.id);
    if (
      !registered ||
      rule.channel !== registered.channel ||
      rule.topic !== registered.topic ||
      rule.windowMs !== registered.windowMs ||
      rule.minimumSpacingMs !== registered.minimumSpacingMs ||
      !permitted(rule.id, rule.limit, registered.limit, registration.limits)
    )
      fail();
  }
  for (const topic of snapshot.topics) {
    const registered = registration.topics.find((candidate) => candidate.id === topic.id);
    if (
      !registered ||
      topic.kind !== registered.kind ||
      topic.messageIds.length !== registered.messageIds.length ||
      new Set(topic.messageIds).size !== topic.messageIds.length ||
      topic.messageIds.some((id) => !registered.messageIds.includes(id)) ||
      !permitted(topic.id, topic.priority, registered.priority, registration.priorities)
    )
      fail();
  }
  const quiet = snapshot.config.quietHours;
  const initialQuiet = registration.config.quietHours;
  if (
    !registration.quietHours &&
    (quiet?.startMinute !== initialQuiet?.startMinute ||
      quiet?.endMinute !== initialQuiet?.endMinute ||
      quiet?.timezone !== initialQuiet?.timezone)
  )
    fail();
  if (quiet) {
    if (
      ![quiet.startMinute, quiet.endMinute].every(
        (minute) => Number.isInteger(minute) && minute >= 0 && minute < 1440,
      ) ||
      quiet.startMinute === quiet.endMinute ||
      typeof quiet.timezone !== "string" ||
      !quiet.timezone.trim()
    )
      fail();
    try {
      new Intl.DateTimeFormat("en", { timeZone: quiet.timezone });
    } catch {
      fail();
    }
  }
}

/** Resolve access from the server's authenticated context; never accept client-granted permissions. */
export class ContactPolicyOperations {
  constructor(
    private readonly options: Readonly<{
      store: ContactPolicyAdminStore;
      registration: ContactPolicyAdminRegistration;
      authorize(
        target: ContactPolicyAdminScope,
        permission: "contact-policy.read" | "contact-policy.write",
      ): Promise<ContactPolicyAdminAccess>;
      createPolicy(snapshot: ContactPolicyAdminSnapshot): ContactPolicy;
    }>,
  ) {}

  private async access(
    target: ContactPolicyAdminScope,
    permission: "contact-policy.read" | "contact-policy.write",
  ): Promise<ContactPolicyAdminAccess> {
    if (
      ![target.scope.app, target.scope.environment, target.scope.tenantId, target.subject].every(
        (value) => typeof value === "string" && value.trim(),
      )
    )
      throw new ContactPolicyAdminProblem("App, environment, tenant and subject are required");
    const access = await this.options.authorize(target, permission);
    if (!access.actorId.trim() || !access.permissions.includes(permission))
      throw new ContactPolicyAdminAccessProblem();
    return access;
  }

  async load(target: ContactPolicyAdminScope): Promise<ContactPolicyAdminView | undefined> {
    await this.access(target, "contact-policy.read");
    const view = await this.options.store.load(target);
    if (view) assertContactPolicyRegistration(view.policy, this.options.registration);
    return view;
  }

  async dryRun(
    target: ContactPolicyAdminScope,
    request: ContactPolicyRequest,
  ): Promise<ContactPolicyDecision> {
    await this.access(target, "contact-policy.read");
    if (
      request.scope.app !== target.scope.app ||
      request.scope.environment !== target.scope.environment ||
      request.scope.tenantId !== target.scope.tenantId ||
      request.recipient !== target.subject
    )
      throw new ContactPolicyAdminAccessProblem();
    const view = await this.options.store.load(target);
    if (!view) throw new ContactPolicyAdminProblem("Contact policy is not configured");
    assertContactPolicyRegistration(view.policy, this.options.registration);
    return this.options.createPolicy(view.policy).evaluate(request);
  }

  async save(
    target: ContactPolicyAdminScope,
    edit: ContactPolicyAdminEdit,
  ): Promise<ContactPolicyAdminSnapshot> {
    const access = await this.access(target, "contact-policy.write");
    if (
      !edit.reason.trim() ||
      !edit.idempotencyKey.trim() ||
      !Number.isSafeInteger(edit.expectedRevision) ||
      edit.expectedRevision < 0
    )
      throw new ContactPolicyAdminProblem(
        "Reason, idempotency key and expected revision are required",
      );
    if (
      Object.keys(edit).some(
        (key) =>
          ![
            "limits",
            "priorities",
            "quietHours",
            "expectedRevision",
            "reason",
            "idempotencyKey",
          ].includes(key),
      ) ||
      (edit.quietHours &&
        Object.keys(edit.quietHours).some(
          (key) => !["startMinute", "endMinute", "timezone"].includes(key),
        ))
    )
      throw new ContactPolicyAdminProblem("Unregistered edit fields are not permitted");
    const registration = this.options.registration;
    const prior = await this.options.store.load(target);
    if (prior) assertContactPolicyRegistration(prior.policy, registration);
    const base = prior?.policy ?? {
      revision: 0,
      config: registration.config,
      topics: registration.topics,
    };
    const checkValues = (
      values: Readonly<Record<string, number>>,
      bounds: Readonly<Record<string, Readonly<{ min: number; max: number }>>>,
    ) => {
      for (const [key, value] of Object.entries(values)) {
        const bound = Object.hasOwn(bounds, key) ? bounds[key] : undefined;
        if (!bound || !Number.isSafeInteger(value) || value < bound.min || value > bound.max)
          throw new ContactPolicyAdminProblem(`Edit is outside registered bounds: ${key}`);
      }
    };
    checkValues(edit.limits, registration.limits);
    checkValues(edit.priorities, registration.priorities);
    if (edit.quietHours !== undefined && !registration.quietHours)
      throw new ContactPolicyAdminProblem("Quiet hours edits are not registered");
    const revision = edit.expectedRevision + 1;
    const config: ContactPolicyConfig = {
      ...base.config,
      version: `${registration.config.version}:${revision}`,
      rules: base.config.rules.map((rule) => ({
        ...rule,
        limit: Object.hasOwn(edit.limits, rule.id) ? edit.limits[rule.id] : rule.limit,
      })),
      quietHours:
        edit.quietHours === undefined ? base.config.quietHours : (edit.quietHours ?? undefined),
    };
    const topics = base.topics.map((topic) => ({
      ...topic,
      priority: Object.hasOwn(edit.priorities, topic.id)
        ? edit.priorities[topic.id]
        : topic.priority,
    }));
    const policy = { revision, config, topics };
    assertContactPolicyRegistration(policy, registration);
    this.options.createPolicy(policy);
    return this.options.store.save({
      edit,
      target,
      policy,
      expectedRevision: edit.expectedRevision,
      actorId: access.actorId,
      reason: edit.reason,
      idempotencyKey: edit.idempotencyKey,
    });
  }
}
