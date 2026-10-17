import { Problem, ProblemCategory } from "@croco/problems-core";
import { canonicalFactValue, factScopeKey, validateFactScope } from "./FactHistory";
import type { FactScope, FactValue } from "./FactHistory";

export type AcquisitionScope = FactScope;
export type AcquisitionIdentity = { readonly kind: "anonymous" | "subject"; readonly ref: string };
export type AcquisitionUrlPolicy = {
  readonly origin: string;
  /** Stable references to registered same-origin paths; never arbitrary redirects. */
  readonly destinations: Readonly<Record<string, string>>;
  readonly campaigns: Readonly<Record<string, readonly string[]>>;
  readonly referrerOrigins: readonly string[];
};
export type AcquisitionContext = {
  readonly landingRef: string;
  readonly campaign: Readonly<Record<string, string>>;
  readonly referrer: {
    readonly status: "observed" | "absent" | "unavailable";
    readonly origin?: string;
  };
};
export type AcquisitionTouchpoint = {
  readonly id: string;
  readonly scope: AcquisitionScope;
  readonly source: string;
  readonly identity: AcquisitionIdentity;
  readonly occurredAt: string;
  readonly recordedAt: string;
  readonly expiresAt: string;
  readonly sourceKind: "observed" | "self-reported" | "referral-claim";
  readonly context: AcquisitionContext;
  /** An application-approved response/claim code, never a privilege credential. */
  readonly claim?: string;
  readonly coverage: "partial" | "window-complete";
};
export type AcquisitionLink = {
  readonly id: string;
  readonly scope: AcquisitionScope;
  readonly anonymousRef: string;
  readonly subjectRef: string;
  readonly touchpointRefs: readonly string[];
  readonly linkedAt: string;
  readonly provenance: string;
  readonly actor: string;
};
export type AcquisitionDefinition = {
  readonly id: string;
  readonly revision: number;
  readonly model: "first-touch" | "last-observed-touch";
  readonly modelVersion: "1";
  readonly windowMs: number;
  readonly actor: string;
  readonly reason: string;
  readonly idempotencyKey: string;
};
export type AcquisitionConversion = {
  readonly ref: string;
  readonly identity: AcquisitionIdentity;
  readonly occurredAt: string;
};
export type AcquisitionAttribution = {
  readonly conversionRef: string;
  readonly modelId: string;
  readonly modelVersion: "1";
  readonly definitionRevision: number;
  readonly window: { readonly fromInclusive: string; readonly toInclusive: string };
  readonly touchpointRefs: readonly string[];
  readonly credit: 0 | 1;
  readonly status: "attributed" | "unattributed";
  readonly channel: "campaign" | "referrer" | "unknown";
  readonly coverage: "partial" | "window-complete";
};
export type AcquisitionComparison = {
  readonly conversion: AcquisitionConversion;
  readonly revision: number;
  readonly results: readonly AcquisitionAttribution[];
  readonly touchpoints: readonly AcquisitionTouchpoint[];
  readonly declarations: readonly AcquisitionTouchpoint[];
  readonly declarationStatus: "none" | "reported" | "conflict";
  /** Distinct conversions, not the sum of model/referral/self-report credits. */
  readonly conversionCount: 1;
};
export type AcquisitionState = {
  revision: number;
  touchpoints: AcquisitionTouchpoint[];
  links: AcquisitionLink[];
  definitions: AcquisitionDefinition[];
  reports: {
    id: string;
    conversionRef: string;
    occurredAt: string;
    identity: AcquisitionIdentity;
    definitionRefs: string[];
    touchpointRefs: string[];
    knownAt: string;
  }[];
  deleted: AcquisitionIdentity[];
};
/** Serializes read/modify/write per scope. A failed callback commits nothing. */
export interface AcquisitionStore {
  transact<T>(scope: AcquisitionScope, operation: (state: AcquisitionState) => T): Promise<T>;
}
export type AcquisitionPolicy = {
  readonly authorize: (request: {
    readonly action: "record" | "link" | "read" | "export" | "define" | "delete" | "purge";
    readonly scope: AcquisitionScope;
    readonly actor: string;
    readonly identity?: AcquisitionIdentity;
    readonly anonymousRef?: string;
    readonly provenance?: string;
  }) => void | Promise<void>;
  readonly mask: (touchpoint: AcquisitionTouchpoint) => AcquisitionTouchpoint;
};
const ACQUISITION_PROBLEMS = {
  invalid: { code: "analytics/acquisition/invalid", category: ProblemCategory.ValidationError },
  denied: { code: "analytics/acquisition/denied", category: ProblemCategory.Forbidden },
  conflict: { code: "analytics/acquisition/conflict", category: ProblemCategory.Conflict },
  deleted: { code: "analytics/acquisition/deleted", category: ProblemCategory.Gone },
  limit: { code: "analytics/acquisition/limit", category: ProblemCategory.ValidationError },
  persistence: {
    code: "analytics/acquisition/persistence",
    category: ProblemCategory.InternalServerError,
  },
} as const;
export class AcquisitionProblem extends Problem {
  readonly code: string;
  readonly category: ProblemCategory;
  constructor(kind: keyof typeof ACQUISITION_PROBLEMS) {
    const metadata = ACQUISITION_PROBLEMS[kind];
    super(metadata.code, metadata.category, `Acquisition ${kind}`);
    this.code = metadata.code;
    this.category = metadata.category;
  }
}
function invalid(): never {
  throw new AcquisitionProblem("invalid");
}
function token(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value)) invalid();
}
function time(value: string): number {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value))
    invalid();
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) invalid();
  return parsed;
}
function identity(value: AcquisitionIdentity): void {
  if (!value || !["anonymous", "subject"].includes(value.kind)) invalid();
  token(value.ref);
}
function normalizedScope(scope: AcquisitionScope): AcquisitionScope {
  if (!scope || typeof scope !== "object" || !Object.hasOwn(scope, "tenantId")) invalid();
  validateFactScope(scope);
  return { app: scope.app, environment: scope.environment, tenantId: scope.tenantId };
}
function normalizedIdentity(value: AcquisitionIdentity): AcquisitionIdentity {
  identity(value);
  return { kind: value.kind, ref: value.ref };
}
function sameIdentity(a: AcquisitionIdentity, b: AcquisitionIdentity): boolean {
  return a.kind === b.kind && a.ref === b.ref;
}
function canonical(value: unknown): string {
  return canonicalFactValue(value as FactValue);
}
function validateUrlPolicy(policy: AcquisitionUrlPolicy): URL {
  let origin: URL;
  try {
    origin = new URL(policy.origin);
  } catch {
    return invalid();
  }
  if (!["https:", "http:"].includes(origin.protocol) || origin.origin !== policy.origin) invalid();
  for (const [ref, path] of Object.entries(policy.destinations)) {
    token(ref);
    if (!/^\/[A-Za-z0-9/_-]*$/.test(path) || path.startsWith("//")) invalid();
  }
  for (const [key, values] of Object.entries(policy.campaigns)) {
    if (
      ![
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_content",
        "utm_term",
        "campaign_code",
      ].includes(key)
    )
      invalid();
    for (const value of values) token(value);
  }
  for (const referrer of policy.referrerOrigins) {
    try {
      if (new URL(referrer).origin !== referrer || !/^https?:/.test(referrer)) invalid();
    } catch {
      invalid();
    }
  }
  return origin;
}
/** Drops every unregistered value; no raw query, fragment, path, email or token is returned. */
export function parseAcquisitionContext(
  input: {
    readonly url: string;
    readonly referrer?: string;
    readonly referrerAvailable: boolean;
  },
  policy: AcquisitionUrlPolicy,
): AcquisitionContext {
  const origin = validateUrlPolicy(policy);
  if (typeof input.url !== "string" || input.url.length > 8192) invalid();
  let url: URL;
  try {
    url = new URL(input.url);
  } catch {
    return invalid();
  }
  if (url.origin !== origin.origin || url.username || url.password) invalid();
  const destination = Object.entries(policy.destinations).find(([, path]) => path === url.pathname);
  if (!destination) invalid();
  const campaign: Record<string, string> = {};
  for (const [key, allowed] of Object.entries(policy.campaigns)) {
    const values = url.searchParams.getAll(key);
    if (values.length !== 1) continue;
    const value = values[0].normalize("NFKC").trim().toLowerCase();
    if (value.length <= 128 && allowed.includes(value)) campaign[key] = value;
  }
  let referrer: AcquisitionContext["referrer"] = {
    status: input.referrerAvailable ? "absent" : "unavailable",
  };
  if (input.referrerAvailable && input.referrer) {
    if (input.referrer.length > 8192) invalid();
    try {
      const parsed = new URL(input.referrer);
      referrer =
        policy.referrerOrigins.includes(parsed.origin) && !parsed.username && !parsed.password
          ? { status: "observed", origin: parsed.origin }
          : { status: "unavailable" };
    } catch {
      referrer = { status: "unavailable" };
    }
  }
  return { landingRef: destination[0], campaign, referrer };
}
/** Validates the sanitized browser payload again on the server. */
export function validateAcquisitionContext(
  value: AcquisitionContext,
  policy: AcquisitionUrlPolicy,
): AcquisitionContext {
  validateUrlPolicy(policy);
  if (
    !value ||
    !Object.hasOwn(policy.destinations, value.landingRef) ||
    !value.campaign ||
    !value.referrer
  )
    invalid();
  if (!["observed", "absent", "unavailable"].includes(value.referrer.status)) invalid();
  if (value.referrer.status === "observed") {
    if (!value.referrer.origin || !policy.referrerOrigins.includes(value.referrer.origin))
      invalid();
  } else if (value.referrer.origin !== undefined) invalid();
  const campaign: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value.campaign)) {
    if (
      typeof entry !== "string" ||
      !Object.hasOwn(policy.campaigns, key) ||
      !policy.campaigns[key].includes(entry)
    )
      invalid();
    campaign[key] = entry;
  }
  return {
    landingRef: value.landingRef,
    campaign,
    referrer:
      value.referrer.status === "observed"
        ? { status: "observed", origin: value.referrer.origin }
        : { status: value.referrer.status },
  };
}
export function resolveAcquisitionDestination(ref: string, policy: AcquisitionUrlPolicy): string {
  validateUrlPolicy(policy);
  if (!Object.hasOwn(policy.destinations, ref)) invalid();
  return new URL(policy.destinations[ref], policy.origin).href;
}
/** Inclusive [conversion-window, conversion], stable ID tie-break, observed sources only. */
export function resolveAttribution(input: {
  readonly scope: AcquisitionScope;
  readonly conversion: AcquisitionConversion;
  readonly definition: AcquisitionDefinition;
  readonly touchpoints: readonly AcquisitionTouchpoint[];
  readonly links?: readonly AcquisitionLink[];
  readonly knownAt: string;
}): AcquisitionAttribution {
  validateFactScope(input.scope);
  identity(input.conversion.identity);
  token(input.conversion.ref);
  const cutoff = time(input.conversion.occurredAt);
  const known = time(input.knownAt);
  const definition = input.definition;
  validateDefinition(definition);
  if (cutoff > known) invalid();
  const start = cutoff - definition.windowMs;
  const linkedIds = new Set(
    (input.links ?? [])
      .filter(
        (link) =>
          factScopeKey(link.scope) === factScopeKey(input.scope) &&
          input.conversion.identity.kind === "subject" &&
          link.subjectRef === input.conversion.identity.ref &&
          time(link.linkedAt) <= known,
      )
      .flatMap((link) => link.touchpointRefs),
  );
  const rows = input.touchpoints
    .filter(
      (row) =>
        factScopeKey(row.scope) === factScopeKey(input.scope) &&
        row.sourceKind === "observed" &&
        (sameIdentity(row.identity, input.conversion.identity) || linkedIds.has(row.id)) &&
        time(row.occurredAt) >= start &&
        time(row.occurredAt) <= cutoff &&
        time(row.recordedAt) <= known &&
        time(row.expiresAt) > known,
    )
    .slice()
    .sort(
      (a, b) => time(a.occurredAt) - time(b.occurredAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
  const row = definition.model === "first-touch" ? rows[0] : rows.at(-1);
  const channel =
    row && Object.keys(row.context.campaign).length
      ? "campaign"
      : row?.context.referrer.status === "observed"
        ? "referrer"
        : "unknown";
  return {
    conversionRef: input.conversion.ref,
    modelId: definition.id,
    modelVersion: "1",
    definitionRevision: definition.revision,
    window: {
      fromInclusive: new Date(start).toISOString(),
      toInclusive: input.conversion.occurredAt,
    },
    touchpointRefs: row ? [row.id] : [],
    credit: row && channel !== "unknown" ? 1 : 0,
    status: row && channel !== "unknown" ? "attributed" : "unattributed",
    channel,
    // A row's collection coverage never proves the whole attribution window was observed.
    coverage: "partial",
  };
}
function validateDefinition(definition: AcquisitionDefinition): void {
  for (const key of ["id", "actor", "reason", "idempotencyKey"] as const) token(definition[key]);
  if (
    !["first-touch", "last-observed-touch"].includes(definition.model) ||
    definition.modelVersion !== "1" ||
    !Number.isSafeInteger(definition.revision) ||
    definition.revision < 1 ||
    !Number.isSafeInteger(definition.windowMs) ||
    definition.windowMs < 1 ||
    definition.windowMs > 366 * 86400000
  )
    invalid();
}
export function emptyAcquisitionState(): AcquisitionState {
  return { revision: 0, touchpoints: [], links: [], definitions: [], reports: [], deleted: [] };
}
/** No global identity graph or durable fallback: all I/O remains on the supplied store. */
export class AcquisitionService {
  constructor(
    private readonly store: AcquisitionStore,
    private readonly options: {
      readonly actor: string;
      readonly policy: AcquisitionPolicy;
      readonly urls: AcquisitionUrlPolicy;
      readonly claimCodes: readonly string[];
      readonly retentionMs: number;
      readonly clock: () => Date;
    },
  ) {
    token(options.actor);
    validateUrlPolicy(options.urls);
    if (
      !Number.isSafeInteger(options.retentionMs) ||
      options.retentionMs < 1 ||
      options.retentionMs > 366 * 86400000
    )
      invalid();
    options.claimCodes.forEach(token);
  }
  private async authorize(
    action: Parameters<AcquisitionPolicy["authorize"]>[0]["action"],
    scope: AcquisitionScope,
    subject?: AcquisitionIdentity,
    extra?: { anonymousRef: string; provenance: string },
  ): Promise<void> {
    if (!scope || typeof scope !== "object" || !Object.hasOwn(scope, "tenantId")) invalid();
    validateFactScope(scope);
    if (subject) identity(subject);
    await this.options.policy.authorize({
      action,
      scope,
      actor: this.options.actor,
      identity: subject,
      ...extra,
    });
  }
  async recordTouchpoint(
    input: Omit<AcquisitionTouchpoint, "recordedAt" | "expiresAt">,
  ): Promise<AcquisitionTouchpoint> {
    if (!input || typeof input !== "object") invalid();
    const row = structuredClone(input);
    token(row.id);
    token(row.source);
    identity(row.identity);
    const context = validateAcquisitionContext(row.context, this.options.urls);
    const now = this.options.clock().toISOString();
    if (
      time(row.occurredAt) > time(now) ||
      time(row.occurredAt) <= time(now) - this.options.retentionMs
    )
      invalid();
    if (
      !["observed", "self-reported", "referral-claim"].includes(row.sourceKind) ||
      !["partial", "window-complete"].includes(row.coverage)
    )
      invalid();
    if (
      row.sourceKind === "observed"
        ? row.claim !== undefined
        : !this.options.claimCodes.includes(row.claim ?? "")
    )
      invalid();
    if (
      row.sourceKind !== "observed" &&
      (Object.keys(context.campaign).length || context.referrer.status !== "absent")
    )
      invalid();
    await this.authorize("record", row.scope, row.identity);
    return this.store.transact(row.scope, (state) => {
      const now = this.options.clock().toISOString();
      if (
        time(row.occurredAt) > time(now) ||
        time(row.occurredAt) <= time(now) - this.options.retentionMs
      )
        invalid();
      this.assertLive(state, row.identity);
      const prior = state.touchpoints.find(
        (entry) => entry.source === row.source && entry.id === row.id,
      );
      const normalized = {
        id: row.id,
        scope: normalizedScope(row.scope),
        source: row.source,
        identity: normalizedIdentity(row.identity),
        occurredAt: row.occurredAt,
        sourceKind: row.sourceKind,
        context,
        coverage: row.coverage,
        ...(row.claim === undefined ? {} : { claim: row.claim }),
      };
      if (prior) {
        const { recordedAt: _recorded, expiresAt: _expires, ...accepted } = prior;
        if (canonical(accepted) !== canonical(normalized)) throw new AcquisitionProblem("conflict");
        return prior;
      }
      // ID is also unambiguous in references across distinct source namespaces.
      if (state.touchpoints.some((entry) => entry.id === row.id))
        throw new AcquisitionProblem("conflict");
      const saved: AcquisitionTouchpoint = {
        ...normalized,
        recordedAt: now,
        expiresAt: new Date(time(row.occurredAt) + this.options.retentionMs).toISOString(),
      };
      state.touchpoints.push(saved);
      state.revision++;
      return saved;
    });
  }
  async linkKnownSubject(input: {
    readonly scope: AcquisitionScope;
    readonly id: string;
    readonly anonymousRef: string;
    readonly subjectRef: string;
    readonly provenance: string;
  }): Promise<AcquisitionLink> {
    const value = structuredClone(input);
    for (const key of ["id", "anonymousRef", "subjectRef", "provenance"] as const)
      token(value[key]);
    await this.authorize("link", value.scope, { kind: "subject", ref: value.subjectRef }, value);
    // App policy must authenticate BOTH the subject and ownership of the anonymous session.
    return this.store.transact(value.scope, (state) => {
      const now = this.options.clock().toISOString();
      this.assertLive(state, { kind: "subject", ref: value.subjectRef });
      this.assertLive(state, { kind: "anonymous", ref: value.anonymousRef });
      const prior = state.links.find(
        (link) => link.anonymousRef === value.anonymousRef || link.id === value.id,
      );
      if (prior) {
        if (
          prior.id !== value.id ||
          prior.anonymousRef !== value.anonymousRef ||
          prior.subjectRef !== value.subjectRef ||
          prior.provenance !== value.provenance ||
          prior.actor !== this.options.actor
        )
          throw new AcquisitionProblem("conflict");
        return prior;
      }
      const receipt: AcquisitionLink = {
        scope: normalizedScope(value.scope),
        id: value.id,
        anonymousRef: value.anonymousRef,
        subjectRef: value.subjectRef,
        provenance: value.provenance,
        actor: this.options.actor,
        linkedAt: now,
        touchpointRefs: state.touchpoints
          .filter(
            (row) =>
              row.identity.kind === "anonymous" &&
              row.identity.ref === value.anonymousRef &&
              time(row.expiresAt) > time(now),
          )
          .map((row) => row.id),
      };
      state.links.push(receipt);
      state.revision++;
      return receipt;
    });
  }
  async define(
    scopeInput: AcquisitionScope,
    definition: Omit<AcquisitionDefinition, "actor">,
  ): Promise<AcquisitionDefinition> {
    const scope = normalizedScope(scopeInput);
    const row: AcquisitionDefinition = {
      id: definition.id,
      revision: definition.revision,
      model: definition.model,
      modelVersion: definition.modelVersion,
      windowMs: definition.windowMs,
      reason: definition.reason,
      idempotencyKey: definition.idempotencyKey,
      actor: this.options.actor,
    };
    validateDefinition(row);
    await this.authorize("define", scope);
    return this.store.transact(scope, (state) => {
      const replay = state.definitions.find((entry) => entry.idempotencyKey === row.idempotencyKey);
      if (replay) {
        if (canonical(replay) !== canonical(row)) throw new AcquisitionProblem("conflict");
        return replay;
      }
      const prior = state.definitions.filter((entry) => entry.id === row.id).at(-1);
      if (row.revision !== (prior?.revision ?? 0) + 1) throw new AcquisitionProblem("conflict");
      state.definitions.push(row);
      state.revision++;
      return row;
    });
  }
  async compare(input: {
    readonly scope: AcquisitionScope;
    readonly conversion: AcquisitionConversion;
    readonly definitions: readonly { readonly id: string; readonly revision: number }[];
    readonly limit: number;
    readonly reportId?: string;
  }): Promise<AcquisitionComparison> {
    const query = {
      ...structuredClone(input),
      scope: normalizedScope(input.scope),
      conversion: {
        ref: input.conversion.ref,
        identity: normalizedIdentity(input.conversion.identity),
        occurredAt: input.conversion.occurredAt,
      },
    };
    identity(query.conversion.identity);
    token(query.conversion.ref);
    time(query.conversion.occurredAt);
    if (
      !Number.isSafeInteger(query.limit) ||
      query.limit < 1 ||
      query.limit > 1000 ||
      query.definitions.length < 1 ||
      query.definitions.length > 10
    )
      invalid();
    if (query.reportId !== undefined) token(query.reportId);
    await this.authorize(
      query.reportId ? "export" : "read",
      query.scope,
      query.conversion.identity,
    );
    return this.store.transact(query.scope, (state) => {
      const now = this.options.clock().toISOString();
      this.assertLive(state, query.conversion.identity);
      const links = state.links.filter(
        (link) =>
          query.conversion.identity.kind === "subject" &&
          link.subjectRef === query.conversion.identity.ref,
      );
      const refs = new Set(links.flatMap((link) => link.touchpointRefs));
      const definitions = query.definitions.map((ref) => {
        const found = state.definitions.find(
          (def) => def.id === ref.id && def.revision === ref.revision,
        );
        if (!found) return invalid();
        return found;
      });
      const windowStart =
        time(query.conversion.occurredAt) - Math.max(...definitions.map((def) => def.windowMs));
      const rows = state.touchpoints.filter(
        (row) =>
          (sameIdentity(row.identity, query.conversion.identity) || refs.has(row.id)) &&
          time(row.expiresAt) > time(now) &&
          time(row.occurredAt) >= windowStart &&
          time(row.occurredAt) <= time(query.conversion.occurredAt),
      );
      if (rows.length > query.limit) throw new AcquisitionProblem("limit");
      const declarations = rows.filter((row) => row.sourceKind !== "observed");
      const results = definitions.map((definition) =>
        resolveAttribution({
          scope: query.scope,
          conversion: query.conversion,
          definition,
          touchpoints: rows,
          links,
          knownAt: now,
        }),
      );
      if (query.reportId) {
        const prior = state.reports.find((entry) => entry.id === query.reportId);
        const report = {
          id: query.reportId,
          conversionRef: query.conversion.ref,
          occurredAt: query.conversion.occurredAt,
          identity: query.conversion.identity,
          definitionRefs: definitions.map((def) => `${def.id}:${def.revision}`),
          touchpointRefs: rows.map((row) => row.id).sort(),
          knownAt: prior?.knownAt ?? now,
        };
        if (prior && canonical(prior) !== canonical(report))
          throw new AcquisitionProblem("conflict");
        if (!prior) {
          state.reports.push(report);
          state.revision++;
        }
      }
      return {
        conversion: query.conversion,
        revision: state.revision,
        results,
        touchpoints: rows
          .filter((row) => row.sourceKind === "observed")
          .map((row) => this.options.policy.mask(structuredClone(row))),
        declarations: declarations.map((row) => this.options.policy.mask(structuredClone(row))),
        declarationStatus:
          declarations.length === 0
            ? "none"
            : ["self-reported", "referral-claim"].some(
                  (kind) =>
                    new Set(
                      declarations.filter((row) => row.sourceKind === kind).map((row) => row.claim),
                    ).size > 1,
                )
              ? "conflict"
              : "reported",
        conversionCount: 1,
      };
    });
  }
  async deleteIdentity(
    scopeInput: AcquisitionScope,
    subjectInput: AcquisitionIdentity,
  ): Promise<void> {
    const scope = normalizedScope(scopeInput);
    const subject = normalizedIdentity(subjectInput);
    await this.authorize("delete", scope, subject);
    return this.store.transact(scope, (state) => {
      const linked = state.links.filter((link) =>
        subject.kind === "subject"
          ? link.subjectRef === subject.ref
          : link.anonymousRef === subject.ref,
      );
      const ids = new Set(linked.flatMap((link) => link.touchpointRefs));
      const identities: AcquisitionIdentity[] = [
        subject,
        ...linked.map((link) => ({ kind: "anonymous" as const, ref: link.anonymousRef })),
      ];
      state.touchpoints = state.touchpoints.filter(
        (row) => !ids.has(row.id) && !identities.some((entry) => sameIdentity(entry, row.identity)),
      );
      state.links = state.links.filter((link) => !linked.includes(link));
      state.reports = state.reports.filter(
        (report) =>
          !sameIdentity(report.identity, subject) &&
          !linked.some(
            (link) => report.identity.kind === "subject" && report.identity.ref === link.subjectRef,
          ),
      );
      for (const entry of identities)
        if (!state.deleted.some((prior) => sameIdentity(prior, entry)))
          state.deleted.push(normalizedIdentity(entry));
      state.revision++;
    });
  }
  async purgeExpired(scopeInput: AcquisitionScope): Promise<void> {
    const scope = normalizedScope(scopeInput);
    await this.authorize("purge", scope);
    return this.store.transact(scope, (state) => {
      const now = time(this.options.clock().toISOString());
      state.touchpoints = state.touchpoints.filter((row) => time(row.expiresAt) > now);
      const live = new Set(state.touchpoints.map((row) => row.id));
      state.links = state.links
        .filter((link) => time(link.linkedAt) + this.options.retentionMs > now)
        .map((link) => ({
          ...link,
          touchpointRefs: link.touchpointRefs.filter((id) => live.has(id)),
        }));
      // No derived report cache can outlive a retention sweep.
      state.reports = [];
      state.revision++;
    });
  }
  private assertLive(state: AcquisitionState, subject: AcquisitionIdentity): void {
    if (state.deleted.some((entry) => sameIdentity(entry, subject)))
      throw new AcquisitionProblem("deleted");
  }
}
