import {
  SurveyConflictProblem,
  SurveyDeniedProblem,
  SurveyExpiredProblem,
  SurveyInvalidProblem,
} from "./SurveyProblems";
import {
  requireSurveyText,
  validateSurveyAnswers,
  validateSurveyDefinition,
  validateSurveyScope,
} from "./validation";
import type {
  SurveyAnswers,
  SurveyAuthority,
  SurveyDefinition,
  SurveyInvitation,
  SurveyPublication,
  SurveyResponse,
  SurveyScope,
  SurveySession,
  SurveyStore,
  SurveySubject,
  SurveyTargeting,
  SurveyTokenCodec,
  SurveyPermission,
} from "./types";

type Context = { scope: SurveyScope; actor: string };
type TokenInput = Context & { token: string };
const definitionKey = (id: string, version: string) => JSON.stringify([id, version]);
const equivalent = (a: unknown, b: unknown): boolean => canonical(a) === canonical(b);
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
/** All clocks and identity/permission decisions belong to the server, never to a submitted body. */
export class SurveyManager {
  constructor(
    private readonly store: SurveyStore,
    private readonly authority: SurveyAuthority,
    private readonly tokens: SurveyTokenCodec,
    private readonly targeting: SurveyTargeting,
    private readonly triggers: readonly string[],
    private readonly clock: () => Date = () => new Date(),
  ) {}
  private now(): string {
    const value = this.clock();
    if (!Number.isFinite(value.getTime())) throw new SurveyInvalidProblem("clock");
    return value.toISOString();
  }
  private context(input: Context): void {
    validateSurveyScope(input.scope);
    requireSurveyText(input.actor, "actor");
  }
  private async permission(input: Context, permission: SurveyPermission): Promise<void> {
    this.context(input);
    if (!(await this.authority.authorize({ ...input, permission })))
      throw new SurveyDeniedProblem();
  }
  private async subject(input: Context & { subject: SurveySubject }): Promise<void> {
    this.context(input);
    if (!input.subject || !["member", "anonymous"].includes(input.subject.kind))
      throw new SurveyInvalidProblem("subject");
    requireSurveyText(input.subject.id, "subject id");
    if (!(await this.authority.verifySubject(input))) throw new SurveyDeniedProblem();
  }
  private registered(d: SurveyDefinition): void {
    if (!Object.hasOwn(this.targeting, d.eligibility) || !this.triggers.includes(d.trigger))
      throw new SurveyInvalidProblem("unregistered targeting/trigger");
  }
  async publish(
    input: Context & {
      definition: SurveyDefinition;
      expectedRevision: number;
      reason: string;
      idempotencyKey: string;
    },
  ): Promise<SurveyPublication> {
    await this.permission(input, "publish");
    validateSurveyDefinition(input.definition);
    this.registered(input.definition);
    requireSurveyText(input.reason, "reason", 1000);
    requireSurveyText(input.idempotencyKey, "idempotency key");
    if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0)
      throw new SurveyInvalidProblem("revision");
    const d = structuredClone(input.definition);
    return this.store.transaction(input.scope, async (s) => {
      const old = await s.get("definition", definitionKey(d.id, d.version));
      if (old?.kind === "definition") {
        const p = old.value;
        if (
          p.idempotencyKey === input.idempotencyKey &&
          p.actor === input.actor &&
          p.reason === input.reason &&
          p.revision === input.expectedRevision + 1 &&
          equivalent(p.definition, d)
        )
          return p;
        throw new SurveyConflictProblem("immutable version");
      }
      const latest = await s.latest(d.id);
      if ((latest?.revision ?? 0) !== input.expectedRevision)
        throw new SurveyConflictProblem("publication revision");
      const p: SurveyPublication = {
        definition: d,
        revision: input.expectedRevision + 1,
        actor: input.actor,
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
        publishedAt: this.now(),
      };
      const auditId = JSON.stringify(["publish", d.id, input.idempotencyKey]);
      if (await s.get("audit", auditId))
        throw new SurveyConflictProblem("publication idempotency key reused");
      await s.put({
        kind: "definition",
        id: definitionKey(d.id, d.version),
        familyId: d.id,
        value: p,
      });
      await this.audit(s, d.id, input, "publish", p.revision, auditId);
      return p;
    });
  }
  private async eligibility(
    s: SurveySession,
    input: Context & { subject: SurveySubject; familyId: string; trigger: string },
    now: string,
  ): Promise<{ eligible: boolean; reason: string; definition: SurveyDefinition | null }> {
    const p = await s.latest(input.familyId);
    if (!p) return { eligible: false, reason: "unpublished", definition: null };
    const d = p.definition;
    this.registered(d);
    if (input.trigger !== "manual" && input.trigger !== d.trigger)
      return { eligible: false, reason: "trigger", definition: d };
    if (now < new Date(d.startsAt).toISOString() || now >= new Date(d.endsAt).toISOString())
      return { eligible: false, reason: "period", definition: d };
    const predicate = this.targeting[d.eligibility];
    if (!predicate || !(await predicate({ scope: input.scope, subject: input.subject })))
      return { eligible: false, reason: "target", definition: d };
    const since = new Date(Date.parse(now) - d.frequencyPolicy.windowMs).toISOString();
    if ((await s.invitations(d.id, input.subject, since)) >= d.frequencyPolicy.maxInvitations)
      return { eligible: false, reason: "frequency", definition: d };
    return { eligible: true, reason: "eligible", definition: d };
  }
  async evaluateEligibility(
    input: Context & { subject: SurveySubject; familyId: string; trigger: string },
  ) {
    await this.subject(input);
    requireSurveyText(input.familyId, "family");
    requireSurveyText(input.trigger, "trigger");
    return this.store.transaction(input.scope, (s) => this.eligibility(s, input, this.now()));
  }
  async createInvitation(
    input: Context & { subject: SurveySubject; familyId: string; trigger: string },
  ): Promise<{ token: string; invitationId: string; definition: SurveyDefinition } | null> {
    await this.subject(input);
    requireSurveyText(input.familyId, "family");
    requireSurveyText(input.trigger, "trigger");
    return this.store.transaction(input.scope, async (s) => {
      const now = this.now();
      const e = await this.eligibility(s, input, now);
      if (!e.eligible || !e.definition) return null;
      const token = this.tokens.create();
      requireSurveyText(token.raw, "token");
      requireSurveyText(token.hash, "token hash");
      if (await s.get("invitation", token.hash)) throw new SurveyConflictProblem("token collision");
      const d = e.definition;
      const invitation: SurveyInvitation = {
        id: token.hash,
        familyId: d.id,
        surveyVersion: d.version,
        subject: structuredClone(input.subject),
        tokenHash: token.hash,
        createdAt: now,
        expiresAt: new Date(
          Math.min(Date.parse(d.endsAt), Date.parse(now) + 86400000),
        ).toISOString(),
      };
      await s.put({ kind: "invitation", id: invitation.id, familyId: d.id, value: invitation });
      return { token: token.raw, invitationId: invitation.id, definition: d };
    });
  }
  private async invitation(
    s: SurveySession,
    input: TokenInput,
  ): Promise<{ invitation: SurveyInvitation; definition: SurveyDefinition }> {
    this.context(input);
    requireSurveyText(input.token, "token");
    const record = await s.get("invitation", this.tokens.hash(input.token));
    if (!record || record.kind !== "invitation") throw new SurveyDeniedProblem();
    const i = record.value;
    // An anonymous bearer remains anonymous even when used by a logged-in principal.
    if (i.subject.kind === "member") await this.subject({ ...input, subject: i.subject });
    if (this.now() >= i.expiresAt) throw new SurveyExpiredProblem();
    const p = await s.get("definition", definitionKey(i.familyId, i.surveyVersion));
    if (!p || p.kind !== "definition") throw new SurveyConflictProblem("pinned definition missing");
    this.registered(p.value.definition);
    const predicate = this.targeting[p.value.definition.eligibility];
    if (!predicate || !(await predicate({ scope: input.scope, subject: i.subject })))
      throw new SurveyDeniedProblem();
    return { invitation: i, definition: p.value.definition };
  }
  async expose(input: TokenInput): Promise<SurveyDefinition> {
    this.context(input);
    return this.store.transaction(input.scope, async (s) => {
      const { invitation: i, definition } = await this.invitation(s, input);
      if (i.dismissedAt || i.submittedAt) throw new SurveyConflictProblem("invitation completed");
      if (!i.shownAt)
        await s.put({
          kind: "invitation",
          id: i.id,
          familyId: i.familyId,
          value: { ...i, shownAt: this.now() },
        });
      return definition;
    });
  }
  async dismiss(input: TokenInput): Promise<void> {
    this.context(input);
    await this.store.transaction(input.scope, async (s) => {
      const { invitation: i } = await this.invitation(s, input);
      if (i.submittedAt || !i.shownAt)
        throw new SurveyConflictProblem("already submitted or not exposed");
      if (!i.dismissedAt)
        await s.put({
          kind: "invitation",
          id: i.id,
          familyId: i.familyId,
          value: { ...i, dismissedAt: this.now() },
        });
    });
  }
  async submitResponse(
    input: TokenInput & {
      answers: SurveyAnswers;
      idempotencyKey: string;
      expectedRevision?: number;
    },
  ): Promise<SurveyResponse> {
    this.context(input);
    requireSurveyText(input.idempotencyKey, "idempotency key");
    const answers = structuredClone(input.answers);
    return this.store.transaction(input.scope, async (s) => {
      const { invitation: i, definition: d } = await this.invitation(s, input);
      validateSurveyAnswers(d, answers);
      if (!i.shownAt || i.dismissedAt) throw new SurveyConflictProblem("not exposed or dismissed");
      const old = await s.get("response", i.id);
      const previous = old?.kind === "response" ? old.value : null;
      if (
        previous?.deletedAt ||
        (previous && Date.parse(this.now()) >= Date.parse(previous.submittedAt) + d.retentionMs)
      )
        throw new SurveyConflictProblem("response no longer retained");
      const auditId = JSON.stringify(["submit", i.id, input.idempotencyKey]);
      if (previous?.idempotencyKey === input.idempotencyKey) {
        if (!equivalent(previous.answers, answers))
          throw new SurveyConflictProblem("submit identity payload mismatch");
        return { ...previous, classification: undefined };
      }
      if (await s.get("audit", auditId)) throw new SurveyConflictProblem("submit identity reused");
      if (previous && (!d.allowEdits || input.expectedRevision !== previous.revision))
        throw new SurveyConflictProblem("edit revision or edits disabled");
      if (!previous && input.expectedRevision !== undefined && input.expectedRevision !== 0)
        throw new SurveyConflictProblem("initial revision");
      const response: SurveyResponse = {
        id: i.id,
        invitationId: i.id,
        familyId: i.familyId,
        answers,
        submittedAt: previous?.submittedAt ?? this.now(),
        revision: (previous?.revision ?? 0) + 1,
        idempotencyKey: input.idempotencyKey,
      };
      if (previous)
        await s.put({
          kind: "response",
          id: JSON.stringify([i.id, previous.revision]),
          familyId: i.familyId,
          value: previous,
        });
      await s.put({ kind: "response", id: i.id, familyId: i.familyId, value: response });
      await s.put({
        kind: "invitation",
        id: i.id,
        familyId: i.familyId,
        value: { ...i, submittedAt: response.submittedAt },
      });
      await this.audit(
        s,
        i.familyId,
        { ...input, reason: "Customer survey response" },
        "submit",
        response.revision,
        auditId,
      );
      return response;
    });
  }
  async results(input: Context & { familyId: string; denominator: "invitation" | "exposure" }) {
    await this.permission(input, "read");
    requireSurveyText(input.familyId, "family");
    if (!["invitation", "exposure"].includes(input.denominator))
      throw new SurveyInvalidProblem("denominator");
    return this.store.transaction(input.scope, async (s) => {
      const counts = await s.counts(input.familyId);
      const denominator =
        input.denominator === "invitation" ? counts.invitations : counts.exposures;
      return {
        ...counts,
        unexposed: counts.invitations - counts.exposures,
        unanswered: counts.exposures - counts.submitted - counts.dismissed,
        denominatorKind: input.denominator,
        denominator,
        responseRate: denominator === 0 ? null : counts.submitted / denominator,
      };
    });
  }
  async rawResponses(
    input: Context & { familyId: string; after?: string; limit: number },
  ): Promise<readonly SurveyResponse[]> {
    await this.permission(input, "raw");
    requireSurveyText(input.familyId, "family");
    if (
      !Number.isSafeInteger(input.limit) ||
      input.limit < 1 ||
      input.limit > 100 ||
      (input.after !== undefined && (typeof input.after !== "string" || input.after.length > 512))
    )
      throw new SurveyInvalidProblem("page");
    return this.store.transaction(input.scope, async (s) => {
      const rows = await s.responses(input.familyId, input.after ?? "", input.limit);
      const result: SurveyResponse[] = [];
      for (const row of rows) {
        const invite = await s.get("invitation", row.invitationId);
        if (!invite || invite.kind !== "invitation")
          throw new SurveyConflictProblem("invitation missing");
        const p = await s.get(
          "definition",
          definitionKey(row.familyId, invite.value.surveyVersion),
        );
        if (!p || p.kind !== "definition") throw new SurveyConflictProblem("definition missing");
        const expired =
          Date.parse(this.now()) >= Date.parse(row.submittedAt) + p.value.definition.retentionMs;
        if (expired && !row.deletedAt) await s.eraseAnswers(row.invitationId, this.now());
        result.push(
          row.deletedAt || expired
            ? {
                ...row,
                answers: {},
                classification: undefined,
                deletedAt: row.deletedAt ?? this.now(),
              }
            : row,
        );
      }
      return result;
    });
  }
  async changeResponse(
    input: Context & {
      invitationId: string;
      operation: "delete" | "classify";
      classification?: string;
      expectedRevision: number;
      reason: string;
      idempotencyKey: string;
    },
  ): Promise<void> {
    await this.permission(input, input.operation === "delete" ? "delete" : "classify");
    requireSurveyText(input.invitationId, "invitation");
    requireSurveyText(input.reason, "reason", 1000);
    requireSurveyText(input.idempotencyKey, "idempotency key");
    if (
      !["delete", "classify"].includes(input.operation) ||
      !Number.isSafeInteger(input.expectedRevision) ||
      input.expectedRevision < 1
    )
      throw new SurveyInvalidProblem("response operation/revision");
    if (input.operation === "classify") {
      await this.permission(input, "raw");
      requireSurveyText(input.classification, "classification", 1000);
    }
    await this.store.transaction(input.scope, async (s) => {
      const r = await s.get("response", input.invitationId);
      if (!r || r.kind !== "response" || r.id !== r.value.invitationId)
        throw new SurveyConflictProblem("current response missing");
      const auditId = JSON.stringify([input.operation, r.id, input.idempotencyKey]);
      const done = await s.get("audit", auditId);
      if (done) {
        if (
          done.kind === "audit" &&
          done.value.actor === input.actor &&
          done.value.reason === input.reason &&
          done.value.revision === input.expectedRevision + 1 &&
          r.value.revision === done.value.revision &&
          (input.operation === "delete"
            ? Boolean(r.value.deletedAt)
            : r.value.classification === input.classification)
        )
          return;
        throw new SurveyConflictProblem("operation idempotency key used");
      }
      if (r.value.revision !== input.expectedRevision || r.value.deletedAt)
        throw new SurveyConflictProblem("response revision/deleted");
      const now = this.now();
      if (input.operation === "classify") {
        const invitation = await s.get("invitation", r.value.invitationId);
        if (!invitation || invitation.kind !== "invitation")
          throw new SurveyConflictProblem("invitation missing");
        const publication = await s.get(
          "definition",
          definitionKey(r.familyId, invitation.value.surveyVersion),
        );
        if (!publication || publication.kind !== "definition")
          throw new SurveyConflictProblem("definition missing");
        if (
          Date.parse(now) >=
          Date.parse(r.value.submittedAt) + publication.value.definition.retentionMs
        )
          throw new SurveyConflictProblem("response no longer retained");
      }
      // The store exposes revisions by invitation identity through get; each history revision is bounded by the current revision.
      if (input.operation === "delete") {
        await s.eraseAnswers(r.id, now);
      }
      await s.put({
        ...r,
        value: {
          ...r.value,
          revision: r.value.revision + 1,
          ...(input.operation === "delete"
            ? { answers: {}, classification: undefined, deletedAt: now }
            : { classification: input.classification }),
        },
      });
      await this.audit(s, r.familyId, input, input.operation, r.value.revision + 1, auditId);
    });
  }
  private async audit(
    s: SurveySession,
    familyId: string,
    input: Context & { reason: string; idempotencyKey: string },
    operation: string,
    revision: number,
    id: string,
  ): Promise<void> {
    await s.put({
      kind: "audit",
      id,
      familyId,
      value: {
        actor: input.actor,
        reason: input.reason,
        operation,
        at: this.now(),
        idempotencyKey: input.idempotencyKey,
        revision,
      },
    });
  }
}
