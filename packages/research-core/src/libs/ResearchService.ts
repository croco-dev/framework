import {
  ResearchConflictProblem,
  ResearchDeniedProblem,
  ResearchInvalidProblem,
  researchIdentity,
} from "./ResearchContracts";
import type {
  Candidate,
  Invitation,
  InvitationState,
  ResearchAccess,
  ResearchAuthorizer,
  ResearchCommand,
  ResearchPage,
  ResearchPermission,
  ResearchRecord,
  ResearchScope,
  ResearchSender,
  ResearchStore,
  StudyDefinition,
} from "./ResearchContracts";

const RELEASED: readonly InvitationState[] = ["declined", "withdrawn", "suppressed"];
/** One study is an immutable dataset/policy publication. Revision tracks operations, not a new contact budget. */
export class ResearchService {
  constructor(
    private readonly store: ResearchStore,
    private readonly authorizer: ResearchAuthorizer,
    private readonly sender: ResearchSender,
    private readonly approvedBookingUrls: readonly string[],
    private readonly clock: () => Date = () => new Date(),
  ) {}

  private async authorize(
    scope: ResearchScope,
    id: string,
    access: ResearchAccess,
    permission: ResearchPermission,
    subject?: string,
  ): Promise<void> {
    const identity = researchIdentity(scope, id);
    if (
      identity !== researchIdentity(access.scope, id) ||
      !access.actor?.trim() ||
      !(await this.authorizer.authorize(access, permission, subject))
    )
      throw new ResearchDeniedProblem();
  }
  private async mutate(
    scope: ResearchScope,
    id: string,
    access: ResearchAccess,
    command: ResearchCommand,
    operation: string,
    payload: unknown,
    apply: (record: ResearchRecord, at: string) => void | Promise<void>,
    permission: ResearchPermission = "research.write",
    subject?: string,
  ): Promise<number> {
    await this.authorize(scope, id, access, "research.write", subject);
    if (permission !== "research.write")
      await this.authorize(scope, id, access, permission, subject);
    assertFields(command, ["expectedRevision", "idempotencyKey", "reason", "source"]);
    text(command.idempotencyKey, "idempotencyKey");
    text(command.reason, "reason");
    text(command.source, "source");
    const fingerprint = await fingerprintOf([operation, payload, command, access.actor]);
    return this.store.transact(scope, id, async (record) => {
      const replay = record.mutations.find((value) => value.key === command.idempotencyKey);
      if (replay) {
        if (replay.fingerprint !== fingerprint)
          throw new ResearchConflictProblem("Idempotency key reused with different input");
        return record.revision;
      }
      if (
        !Number.isSafeInteger(command.expectedRevision) ||
        command.expectedRevision !== record.revision
      )
        throw new ResearchConflictProblem("Study revision changed; reload before writing");
      if (record.history.length >= 50000)
        throw new ResearchInvalidProblem("Study audit capacity reached");
      const at = this.clock().toISOString();
      const beforeStates = new Map(record.invitations.map((value) => [value.subject, value.state]));
      await apply(record, at);
      record.revision++;
      record.history.push({
        actor: access.actor,
        reason: command.reason,
        source: command.source,
        revision: record.revision,
        idempotencyKey: command.idempotencyKey,
        at,
        operation,
        transitions: record.invitations
          .filter((value) => beforeStates.get(value.subject) !== value.state)
          .map(({ subject, state }) => ({ subject, state })),
        ...(operation === "consent" && subject
          ? {
              contactConsent: requireCandidate(record, subject).contactConsent,
              participationConsent:
                record.invitations.find((value) => value.subject === subject)
                  ?.participationConsent ?? false,
            }
          : {}),
        ...(subject ? { subject } : {}),
      });
      record.mutations.push({ key: command.idempotencyKey, fingerprint });
      return record.revision;
    });
  }
  async publishStudy(
    scope: ResearchScope,
    definition: StudyDefinition,
    access: ResearchAccess,
    command: ResearchCommand,
  ): Promise<number> {
    validateStudy(definition, this.approvedBookingUrls);
    return this.mutate(scope, definition.id, access, command, "publish", definition, (record) => {
      if (record.definition && canonicalJson(record.definition) !== canonicalJson(definition))
        throw new ResearchConflictProblem(
          "Published study policy and snapshot are immutable; revisions cannot reset contact caps",
        );
      record.definition = structuredClone(definition);
    });
  }
  async importCandidates(
    scope: ResearchScope,
    id: string,
    candidates: readonly Candidate[],
    access: ResearchAccess,
    command: ResearchCommand,
  ): Promise<number> {
    if (!Array.isArray(candidates) || candidates.length > 1000)
      throw new ResearchInvalidProblem("Import is limited to 1,000 candidates");
    const fingerprints = await Promise.all(candidates.map((candidate) => fingerprintOf(candidate)));
    return this.mutate(scope, id, access, command, "import", candidates, async (record) => {
      const study = requireStudy(record);
      const seen = new Set<string>();
      for (const [index, candidate] of candidates.entries()) {
        validateCandidate(candidate, study);
        await this.authorize(scope, id, access, "research.write", candidate.subject);
        if (seen.has(candidate.subject))
          throw new ResearchInvalidProblem("Duplicate subject in import");
        seen.add(candidate.subject);
        const existing = record.candidates.find((value) => value.subject === candidate.subject);
        if (
          existing &&
          record.candidateFingerprints.find((value) => value.subject === candidate.subject)
            ?.fingerprint !== fingerprints[index]
        )
          throw new ResearchConflictProblem(
            "Imported subjects and provenance are immutable; update consent explicitly",
          );
        if (!existing) {
          record.candidates.push(structuredClone(candidate));
          record.consents.push({
            subject: candidate.subject,
            contact: candidate.contactConsent,
            participation: false,
            recordedAt: candidate.consentRecordedAt,
            source: candidate.consentSource,
          });
          record.candidateFingerprints.push({
            subject: candidate.subject,
            fingerprint: fingerprints[index],
          });
        }
      }
      if (record.candidates.length > 10000)
        throw new ResearchInvalidProblem("Study is limited to 10,000 candidates");
    });
  }
  async selectCandidates(
    scope: ResearchScope,
    id: string,
    access: ResearchAccess,
    command: ResearchCommand,
  ): Promise<number> {
    return this.mutate(scope, id, access, command, "select", null, async (record, at) => {
      const study = requireStudy(record);
      for (const group of study.groups) {
        let slots = group.quota - held(record, group.id);
        const candidates = record.candidates.filter(
          (value) =>
            value.group === group.id &&
            !exclusion(value, study) &&
            !record.invitations.some((invite) => invite.subject === value.subject),
        );
        candidates.sort(
          (a, b) =>
            compare(rank(study.seed, a.subject), rank(study.seed, b.subject)) ||
            compare(a.subject, b.subject),
        );
        for (const candidate of candidates) {
          if (slots-- <= 0) break;
          await this.authorize(scope, id, access, "research.write", candidate.subject);
          record.invitations.push({
            id: JSON.stringify([researchIdentity(scope, id), candidate.subject]),
            subject: candidate.subject,
            group: group.id,
            state: "selected",
            contactCount: 0,
            executionIds: [],
            participationConsent: false,
          });
        }
      }
      expireNotes(record, at);
    });
  }
  /** Commit admission before dispatch. Withdrawal completed before admission prevents contact. After admission, cancellation is not claimed. */
  async invite(
    scope: ResearchScope,
    id: string,
    subject: string,
    access: ResearchAccess,
    command: ResearchCommand,
  ): Promise<number> {
    text(subject, "subject");
    await this.mutate(
      scope,
      id,
      access,
      command,
      "admit",
      subject,
      (record, at) => {
        const candidate = requireCandidate(record, subject);
        const study = requireStudy(record);
        const invitation = requireInvitation(record, subject);
        if (invitation.state !== "selected")
          throw new ResearchConflictProblem(
            "Only selected candidates may be admitted; unknown sends require reconciliation",
          );
        if (exclusion(candidate, study)) throw new ResearchDeniedProblem();
        if (invitation.contactCount >= study.contactPolicy.perStudyCap)
          throw new ResearchConflictProblem("Per-study contact cap reached");
        invitation.state = "admitted";
        invitation.contactCount++;
        invitation.lastContactAt = at;
      },
      "research.write",
      subject,
    );
    const record = await this.store.read(scope, id);
    const invitation = requireInvitation(record, subject);
    // A replay never issues an additional send. Interrupted admissions are reconciled explicitly.
    if (invitation.state !== "admitted") return record.revision;
    // Only the original admission owner sends. Persist a claim before leaving the database.
    const claimed = await this.store.transact(scope, id, async (current) => {
      const value = requireInvitation(current, subject);
      if (value.state !== "admitted") return false;
      value.state = "unknown";
      current.history.push({
        actor: access.actor,
        reason: "Dispatch ownership claimed; external acceptance unknown",
        source: "research/admission",
        revision: current.revision,
        idempotencyKey: invitation.id + "/claim",
        at: this.clock().toISOString(),
        operation: "dispatch-claim",
        subject,
        transitions: [{ subject, state: "unknown" }],
      });
      return true;
    });
    if (!claimed) return (await this.store.read(scope, id)).revision;
    try {
      const result = await this.sender.send(scope, requireStudy(record), invitation);
      return this.store.transact(scope, id, async (current) => {
        const value = requireInvitation(current, subject);
        if (result.status === "queued") {
          value.executionIds = [...result.executionIds];
          if (value.state === "unknown") value.state = "invited";
        } else {
          value.failureCode = result.reason;
          if (value.state === "unknown") value.state = "suppressed";
        }
        current.revision++;
        current.history.push({
          actor: access.actor,
          reason: "Engagement dispatch result",
          source: "engagement",
          revision: current.revision,
          idempotencyKey: invitation.id,
          at: this.clock().toISOString(),
          operation: result.status,
          transitions: [{ subject, state: value.state }],
          subject,
        });
        return current.revision;
      });
    } catch {
      await this.store.transact(scope, id, async (current) => {
        requireInvitation(current, subject).failureCode = "research/dispatch-unknown";
      });
      throw new ResearchConflictProblem(
        "Dispatch acceptance is unknown; reconcile provider evidence before releasing the slot",
      );
    }
  }
  async recordConsent(
    scope: ResearchScope,
    id: string,
    subject: string,
    consent: Readonly<{ contact: boolean; participation: boolean }>,
    access: ResearchAccess,
    command: ResearchCommand,
  ): Promise<number> {
    assertFields(consent, ["contact", "participation"]);
    if (typeof consent.contact !== "boolean" || typeof consent.participation !== "boolean")
      throw new ResearchInvalidProblem("Contact and participation consent must both be explicit");
    return this.mutate(
      scope,
      id,
      access,
      command,
      "consent",
      { subject, consent },
      (record, at) => {
        const candidate = requireCandidate(record, subject);
        record.candidates[record.candidates.indexOf(candidate)] = {
          ...candidate,
          contactConsent: consent.contact,
          consentSource: command.source,
          consentRecordedAt: at,
        };
        const invitation = record.invitations.find((value) => value.subject === subject);
        if (!invitation && consent.participation)
          throw new ResearchConflictProblem("Participation consent requires a selected invitation");
        record.consents.push({
          subject,
          contact: consent.contact,
          participation: consent.participation,
          recordedAt: at,
          source: command.source,
        });
        if (invitation) {
          invitation.participationConsent = consent.participation;
          if (!consent.participation && invitation.state === "accepted")
            invitation.state = "withdrawn";
          if (!consent.contact && invitation.state === "selected") invitation.state = "withdrawn";
        }
      },
      "research.write",
      subject,
    );
  }
  async recordResponse(
    scope: ResearchScope,
    id: string,
    subject: string,
    response: "accepted" | "declined" | "withdrawn",
    access: ResearchAccess,
    command: ResearchCommand,
  ): Promise<number> {
    if (!["accepted", "declined", "withdrawn"].includes(response))
      throw new ResearchInvalidProblem("Unsupported response");
    return this.mutate(
      scope,
      id,
      access,
      command,
      "response",
      { subject, response },
      (record) => {
        const value = requireInvitation(record, subject);
        if (response === "accepted" && (!value.participationConsent || value.state !== "invited"))
          throw new ResearchConflictProblem(
            "Acceptance requires participation consent and a confirmed invitation",
          );
        if (response !== "accepted" && !["selected", "invited", "accepted"].includes(value.state))
          throw new ResearchConflictProblem(
            "Unknown or terminal invitation cannot release a slot without reconciliation",
          );
        value.state = response;
      },
      "research.write",
      subject,
    );
  }
  async markParticipated(
    scope: ResearchScope,
    id: string,
    subject: string,
    access: ResearchAccess,
    command: ResearchCommand,
  ): Promise<number> {
    return this.mutate(
      scope,
      id,
      access,
      command,
      "participated",
      subject,
      (record) => {
        const value = requireInvitation(record, subject);
        if (value.state !== "accepted" || !value.participationConsent)
          throw new ResearchConflictProblem(
            "Actual participation requires accepted consent and an audited confirmation",
          );
        value.state = "participated";
      },
      "research.participate",
      subject,
    );
  }
  /** Provider evidence is supplied through an authenticated host with participation authority; no blind retry of unknown sends. */
  async reconcileInvitation(
    scope: ResearchScope,
    id: string,
    subject: string,
    outcome: "invited" | "suppressed",
    access: ResearchAccess,
    command: ResearchCommand,
  ): Promise<number> {
    if (!["invited", "suppressed"].includes(outcome))
      throw new ResearchInvalidProblem("Unsupported reconciliation outcome");
    return this.mutate(
      scope,
      id,
      access,
      command,
      "reconcile",
      { subject, outcome },
      (record) => {
        const value = requireInvitation(record, subject);
        if (!["unknown", "admitted"].includes(value.state))
          throw new ResearchConflictProblem("Only interrupted or unknown sends can be reconciled");
        value.state = outcome;
      },
      "research.participate",
      subject,
    );
  }
  async writeNote(
    scope: ResearchScope,
    id: string,
    subject: string,
    note: string | null,
    access: ResearchAccess,
    command: ResearchCommand,
  ): Promise<number> {
    if (note !== null && (typeof note !== "string" || note.length > 2000))
      throw new ResearchInvalidProblem("Notes are limited to 2,000 characters");
    return this.mutate(
      scope,
      id,
      access,
      command,
      "note",
      { subject, note },
      (record, at) => {
        requireCandidate(record, subject);
        expireNotes(record, at);
        record.notes = record.notes.filter((value) => value.subject !== subject);
        if (note !== null)
          record.notes.push({
            subject,
            text: note,
            expiresAt: new Date(
              Date.parse(at) + requireStudy(record).noteRetentionDays * 86400000,
            ).toISOString(),
          });
      },
      "research.notes",
      subject,
    );
  }
  /** Physical expiration is an audited write; read paths never expose expired notes. */
  async purgeExpiredNotes(
    scope: ResearchScope,
    id: string,
    access: ResearchAccess,
    command: ResearchCommand,
  ): Promise<number> {
    return this.mutate(
      scope,
      id,
      access,
      command,
      "purge-notes",
      null,
      expireNotes,
      "research.notes",
    );
  }
  async inspect(
    scope: ResearchScope,
    id: string,
    access: ResearchAccess,
    offset = 0,
    limit = 20,
  ): Promise<ResearchPage> {
    await this.authorize(scope, id, access, "research.read");
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
      throw new ResearchInvalidProblem(
        "Page offset and limit must be bounded integers (limit 1–100)",
      );
    const record = await this.store.read(scope, id);
    const study = requireStudy(record);
    const candidates: {
      candidate: Candidate;
      invitation?: Invitation;
      exclusion?: string;
      note?: string;
    }[] = [];
    for (const candidate of record.candidates.slice(offset, offset + limit)) {
      if (!(await this.authorizer.authorize(access, "research.read", candidate.subject)))
        throw new ResearchDeniedProblem();
      const invitation = record.invitations.find((value) => value.subject === candidate.subject);
      const note = record.notes.find(
        (value) =>
          value.subject === candidate.subject &&
          Date.parse(value.expiresAt) > this.clock().getTime(),
      );
      const showNote =
        note && (await this.authorizer.authorize(access, "research.notes", candidate.subject));
      candidates.push({
        candidate,
        ...(invitation ? { invitation } : {}),
        ...(exclusion(candidate, study) ? { exclusion: exclusion(candidate, study) } : {}),
        ...(showNote ? { note: note.text } : {}),
      });
    }
    const groups = study.groups.map((group) => {
      const invitations = record.invitations.filter((value) => value.group === group.id);
      const count = (...states: InvitationState[]) =>
        invitations.filter((value) => states.includes(value.state)).length;
      return {
        group: group.id,
        population: record.candidates.filter((value) => value.group === group.id).length,
        eligible: record.candidates.filter(
          (value) => value.group === group.id && !exclusion(value, study),
        ).length,
        selected: count("selected"),
        invited: count("invited", "accepted", "participated"),
        accepted: count("accepted", "participated"),
        participated: count("participated"),
        unknown: count("admitted", "unknown"),
        held: held(record, group.id),
        shortage: Math.max(0, group.quota - held(record, group.id)),
      };
    });
    // History contains operational metadata only; note text and deleted response contents never enter audit/idempotency records.
    return structuredClone({
      scope,
      study,
      revision: record.revision,
      groups,
      candidates,
      history: record.history
        .filter(
          (value) =>
            !value.subject || candidates.some((row) => row.candidate.subject === value.subject),
        )
        .slice(-100)
        .map((event) => ({
          ...event,
          ...(event.transitions
            ? {
                transitions: event.transitions.filter((transition) =>
                  candidates.some((row) => row.candidate.subject === transition.subject),
                ),
              }
            : {}),
        })),
      ...(offset + limit < record.candidates.length ? { nextOffset: offset + limit } : {}),
    });
  }
}
function text(value: string, field: string): void {
  if (typeof value !== "string" || !value.trim() || value.length > 2000)
    throw new ResearchInvalidProblem(`${field} must be nonempty and bounded`);
}
function date(value: string): void {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
    throw new ResearchInvalidProblem("A valid timestamp is required");
}
function requireStudy(record: ResearchRecord): StudyDefinition {
  if (!record.definition) throw new ResearchInvalidProblem("Study is not published");
  return record.definition;
}
function requireCandidate(record: ResearchRecord, subject: string): Candidate {
  const value = record.candidates.find((candidate) => candidate.subject === subject);
  if (!value) throw new ResearchInvalidProblem("Candidate does not exist in this study");
  return value;
}
function requireInvitation(record: ResearchRecord, subject: string): Invitation {
  const value = record.invitations.find((invite) => invite.subject === subject);
  if (!value) throw new ResearchInvalidProblem("Candidate has not been selected");
  return value;
}
function held(record: ResearchRecord, group: string): number {
  return record.invitations.filter(
    (value) => value.group === group && !RELEASED.includes(value.state),
  ).length;
}
function exclusion(candidate: Candidate, study: StudyDefinition): string | undefined {
  if (Date.parse(candidate.observedThrough) < Date.parse(study.observationEndsAt))
    return "observation-incomplete";
  if (!candidate.eligible) return "ineligible";
  if (!candidate.contactConsent) return "contact-consent";
  if (
    candidate.priorParticipatedAt &&
    Date.parse(candidate.priorParticipatedAt) >=
      Date.parse(study.contactPolicy.excludeParticipatedSince)
  )
    return "recent-participant";
  if (
    candidate.priorContactAt &&
    Date.parse(candidate.priorContactAt) >= Date.parse(study.contactPolicy.excludeContactedSince)
  )
    return "recent-contact";
  return undefined;
}
function rank(seed: string, subject: string): string {
  let value = 2166136261;
  for (const char of JSON.stringify([seed, subject]))
    value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return (value >>> 0).toString(16).padStart(8, "0");
}
function expireNotes(record: ResearchRecord, at: string): void {
  record.notes = record.notes.filter((value) => Date.parse(value.expiresAt) > Date.parse(at));
}
function validateStudy(study: StudyDefinition, urls: readonly string[]): void {
  if (!study || !Array.isArray(study.groups) || !study.contactPolicy)
    throw new ResearchInvalidProblem("Study groups and contact policy are required");
  assertFields(study, [
    "id",
    "version",
    "groups",
    "quotaUnit",
    "slotPolicy",
    "seed",
    "datasetDefinition",
    "sourceSnapshotId",
    "observationEndsAt",
    "bookingUrl",
    "contactPolicy",
    "noteRetentionDays",
  ]);
  assertFields(study.contactPolicy, [
    "perStudyCap",
    "excludeParticipatedSince",
    "excludeContactedSince",
  ]);
  for (const group of study.groups) assertFields(group, ["id", "quota", "outcome"]);
  for (const field of [study.id, study.seed, study.datasetDefinition, study.sourceSnapshotId])
    text(field, "study identity/provenance");
  if (
    !Number.isSafeInteger(study.version) ||
    study.version < 1 ||
    study.quotaUnit !== "active-invitations" ||
    study.slotPolicy !== "release-declined-withdrawn"
  )
    throw new ResearchInvalidProblem(
      "Explicit supported quota/slot policy and positive version are required",
    );
  if (
    !study.groups.length ||
    study.groups.length > 20 ||
    new Set(study.groups.map((group) => group.id)).size !== study.groups.length
  )
    throw new ResearchInvalidProblem("Study groups must be unique (1–20)");
  for (const group of study.groups) {
    text(group.id, "group");
    if (
      !Number.isSafeInteger(group.quota) ||
      group.quota < 1 ||
      group.quota > 10000 ||
      !["achieved", "not-achieved"].includes(group.outcome)
    )
      throw new ResearchInvalidProblem("Group quota/outcome invalid");
  }
  date(study.observationEndsAt);
  date(study.contactPolicy.excludeParticipatedSince);
  date(study.contactPolicy.excludeContactedSince);
  if (
    !Number.isSafeInteger(study.contactPolicy.perStudyCap) ||
    study.contactPolicy.perStudyCap !== 1
  )
    throw new ResearchInvalidProblem(
      "Supported per-study contact cap is one logical invitation per subject",
    );
  if (
    !Number.isSafeInteger(study.noteRetentionDays) ||
    study.noteRetentionDays < 1 ||
    study.noteRetentionDays > 365
  )
    throw new ResearchInvalidProblem("Note retention must be 1–365 days");
  let url: URL;
  try {
    url = new URL(study.bookingUrl);
  } catch {
    throw new ResearchInvalidProblem("Booking URL is invalid");
  }
  if (url.protocol !== "https:" || url.username || url.password || !urls.includes(url.href))
    throw new ResearchInvalidProblem(
      "Booking URL must use an approved HTTPS URL without credentials",
    );
}
function validateCandidate(candidate: Candidate, study: StudyDefinition): void {
  if (!candidate || typeof candidate !== "object")
    throw new ResearchInvalidProblem("Candidate object is required");
  assertFields(candidate, [
    "subject",
    "group",
    "sourceSnapshotId",
    "observedThrough",
    "eligible",
    "contactConsent",
    "consentSource",
    "consentRecordedAt",
    "priorContactAt",
    "priorParticipatedAt",
  ]);
  text(candidate.subject, "subject");
  text(candidate.consentSource, "consentSource");
  date(candidate.consentRecordedAt);
  date(candidate.observedThrough);
  if (candidate.priorContactAt) date(candidate.priorContactAt);
  if (candidate.priorParticipatedAt) date(candidate.priorParticipatedAt);
  if (
    candidate.sourceSnapshotId !== study.sourceSnapshotId ||
    !study.groups.some((group) => group.id === candidate.group) ||
    typeof candidate.eligible !== "boolean" ||
    typeof candidate.contactConsent !== "boolean"
  )
    throw new ResearchInvalidProblem("Candidate snapshot, group or eligibility/consent invalid");
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (value !== null && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map(
          (key) =>
            JSON.stringify(key) + ":" + canonicalJson((value as Record<string, unknown>)[key]),
        )
        .join(",") +
      "}"
    );
  return JSON.stringify(value) ?? "null";
}
async function fingerprintOf(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalJson(value)),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function assertFields(value: unknown, fields: readonly string[]): void {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !fields.includes(key))
  )
    throw new ResearchInvalidProblem("Input contains unsupported fields or is not an object");
}
