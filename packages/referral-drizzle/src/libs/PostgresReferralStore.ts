import { sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { Problem, ProblemCategory } from "@croco/problems-core";
import {
  addReferralAmounts,
  compareReferralAmounts,
  stableReferralFingerprint,
  subtractReferralAmounts,
  ZERO_REFERRAL_AMOUNT,
} from "@croco/referral-core";
import {
  InvalidReferralProgramProblem,
  ReferralAttributionNotFoundProblem,
  ReferralAttributionStateConflictProblem,
  ReferralBudgetExhaustedProblem,
  ReferralDuplicateClaimProblem,
  ReferralLinkNotFoundProblem,
  ReferralProgramConflictProblem,
  ReferralProgramNotFoundProblem,
} from "@croco/referral-core";
import type {
  ListAttributionsFilter,
  ListBenefitIntentsFilter,
  ListReferralLinksFilter,
  ReferralAttribution,
  ReferralAttributionState,
  ReferralAuditEntry,
  ReferralBenefitIntent,
  ReferralBenefitIntentStatus,
  ReferralLink,
  ReferralProgramDefinition,
  ReferralStore,
  ReferralSubject,
  ReferralTx,
} from "@croco/referral-core";

export interface ReferralPgExecutor {
  execute(query: SQL): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface ReferralPgDatabase extends ReferralPgExecutor {
  transaction<T>(work: (tx: ReferralPgExecutor) => Promise<T>): Promise<T>;
}

/** Reports a PostgreSQL failure without leaking statement text or parameters. */
export class ReferralPersistenceProblem extends Problem {
  readonly code = "referral-drizzle/persistence-failure";
  readonly category = ProblemCategory.InternalServerError;

  constructor(operation: string, cause: Error) {
    super(undefined, undefined, `Referral persistence failed during '${operation}'.`, { cause });
  }
}

const ATTRIBUTION_STATES: readonly ReferralAttributionState[] = [
  "claimed",
  "qualified",
  "benefits-pending",
  "benefits-partial",
  "fulfilled",
  "held",
  "rejected",
  "expired",
  "indeterminate",
];

function asDate(value: unknown, field: string): Date {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new ReferralPersistenceProblem(
      "read referral document",
      new Error(`stored ${field} is not a valid timestamp`),
    );
  }
  return date;
}

function asOptionalDate(value: unknown, field: string): Date | undefined {
  if (value === null || value === undefined) return undefined;
  return asDate(value, field);
}

function reviveLink(document: unknown): ReferralLink {
  const link = document as ReferralLink;
  return {
    ...link,
    referrer: link.referrer as ReferralSubject,
    createdAt: asDate(link.createdAt, "link.createdAt"),
    expiresAt: asDate(link.expiresAt, "link.expiresAt"),
    revokedAt: asOptionalDate(link.revokedAt, "link.revokedAt"),
  };
}

function reviveAttribution(document: unknown): ReferralAttribution {
  const attribution = document as ReferralAttribution;
  if (!ATTRIBUTION_STATES.includes(attribution.state)) {
    throw new ReferralPersistenceProblem(
      "read referral document",
      new Error(`stored attribution state '${String(attribution.state)}' is not known`),
    );
  }
  return {
    ...attribution,
    scope: attribution.scope as ReferralAttribution["scope"],
    referrer: attribution.referrer as ReferralSubject,
    recipient: attribution.recipient as ReferralSubject | undefined,
    claimedAt: asDate(attribution.claimedAt, "claimedAt"),
    expiresAt: asDate(attribution.expiresAt, "expiresAt"),
    qualification: attribution.qualification
      ? {
          ...attribution.qualification,
          qualifiedAt: asDate(attribution.qualification.qualifiedAt, "qualifiedAt"),
        }
      : undefined,
    createdAt: asDate(attribution.createdAt, "createdAt"),
    updatedAt: asDate(attribution.updatedAt, "updatedAt"),
  };
}

function reviveProgram(document: unknown): ReferralProgramDefinition {
  const program = document as ReferralProgramDefinition;
  return {
    ...program,
    referrerBenefit: reviveProgramBenefit(program.referrerBenefit),
    recipientBenefit: reviveProgramBenefit(program.recipientBenefit),
    startsAt: asDate(program.startsAt, "startsAt"),
    endsAt: asDate(program.endsAt, "endsAt"),
    registeredAt: asDate(program.registeredAt, "registeredAt"),
  };
}

function reviveProgramBenefit(
  benefit: ReferralProgramDefinition["referrerBenefit"],
): ReferralProgramDefinition["referrerBenefit"] {
  if (benefit.kind !== "trial-credits" || benefit.expiresAt === undefined) return benefit;
  return { ...benefit, expiresAt: asDate(benefit.expiresAt, "benefit.expiresAt") };
}

function reviveIntent(document: unknown): ReferralBenefitIntent {
  const intent = document as ReferralBenefitIntent;
  return {
    ...intent,
    subject: intent.subject as ReferralSubject,
    createdAt: asDate(intent.createdAt, "createdAt"),
    updatedAt: asDate(intent.updatedAt, "updatedAt"),
  };
}

function assertLimit(limit: number | undefined, fallback: number): number {
  const resolved = limit ?? fallback;
  if (!Number.isInteger(resolved) || resolved < 1 || resolved > 1000) {
    throw new InvalidReferralProgramProblem("list limit must be an integer between 1 and 1000");
  }
  return resolved;
}

function recipientKey(recipient: ReferralSubject | undefined): string | null {
  if (!recipient) return null;
  return `${recipient.appId}|${recipient.environment}|${recipient.tenantId}|${recipient.kind}|${recipient.id}`;
}

function isUniqueViolation(error: unknown): boolean {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    const message = error.message;
    if (code === "23505") return true;
    if (message.includes("duplicate key") || message.includes("unique constraint")) return true;
  }
  return false;
}

async function run<T>(operation: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof Problem) throw error;
    throw new ReferralPersistenceProblem(
      operation,
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}

/** PostgreSQL adapter for a Drizzle node-postgres execute/transaction boundary. */
export class PostgresReferralStore implements ReferralStore {
  constructor(private readonly database: ReferralPgDatabase) {}

  async transact<T>(work: (tx: ReferralTx) => Promise<T>): Promise<T> {
    return run("transact", () =>
      this.database.transaction((executor) => work(new PostgresReferralTx(executor))),
    );
  }

  async getProgram(programId: string, version: number): Promise<ReferralProgramDefinition | null> {
    return run("read referral program", async () => {
      const result = await this.database.execute(sql`
        SELECT document FROM croco_referral_programs
        WHERE program_id = ${programId} AND version = ${version}
      `);
      const row = result.rows[0];
      return row ? reviveProgram(row.document) : null;
    });
  }

  async latestProgramVersion(programId: string): Promise<number | null> {
    return run("read referral program version", async () => {
      const result = await this.database.execute(sql`
        SELECT MAX(version) AS latest FROM croco_referral_programs
        WHERE program_id = ${programId}
      `);
      const latest = result.rows[0]?.latest;
      if (typeof latest === "number") return latest;
      if (typeof latest === "string" && latest.trim().length > 0) {
        return Number.parseInt(latest, 10);
      }
      return null;
    });
  }

  async getLink(linkId: string): Promise<ReferralLink | null> {
    return run("read referral link", async () => {
      const result = await this.database.execute(sql`
        SELECT document FROM croco_referral_links WHERE link_id = ${linkId}
      `);
      const row = result.rows[0];
      return row ? reviveLink(row.document) : null;
    });
  }

  async getLinkByTokenHash(tokenHash: string): Promise<ReferralLink | null> {
    return run("read referral link", async () => {
      const result = await this.database.execute(sql`
        SELECT document FROM croco_referral_links WHERE token_hash = ${tokenHash}
      `);
      const row = result.rows[0];
      return row ? reviveLink(row.document) : null;
    });
  }

  async getAttribution(attributionId: string): Promise<ReferralAttribution | null> {
    return run("read referral attribution", async () => {
      const result = await this.database.execute(sql`
        SELECT document FROM croco_referral_attributions WHERE attribution_id = ${attributionId}
      `);
      const row = result.rows[0];
      return row ? reviveAttribution(row.document) : null;
    });
  }

  async getBenefitIntent(intentId: string): Promise<ReferralBenefitIntent | null> {
    return run("read referral benefit intent", async () => {
      const result = await this.database.execute(sql`
        SELECT document FROM croco_referral_benefit_intents WHERE intent_id = ${intentId}
      `);
      const row = result.rows[0];
      return row ? reviveIntent(row.document) : null;
    });
  }

  async listAttributions(filter: ListAttributionsFilter): Promise<readonly ReferralAttribution[]> {
    return run("list referral attributions", () => listAttributionsWith(this.database, filter));
  }

  async listLinks(filter: ListReferralLinksFilter): Promise<readonly ReferralLink[]> {
    return run("list referral links", async () => {
      const limit = assertLimit(filter.limit, 100);
      const programId: string | null = filter.programId ?? null;
      const familyId: string | null = filter.familyId ?? null;
      const cycleId: string | null = filter.benefitCycleId ?? null;
      const referrerJson: string | null = filter.referrer ? JSON.stringify(filter.referrer) : null;
      const result = await this.database.execute(sql`
        SELECT document FROM croco_referral_links
        WHERE (${programId}::text IS NULL OR program_id = ${programId})
          AND (${familyId}::text IS NULL OR family_id = ${familyId})
          AND (${cycleId}::text IS NULL OR benefit_cycle_id = ${cycleId})
          AND (${referrerJson}::jsonb IS NULL OR referrer = ${referrerJson}::jsonb)
        ORDER BY created_at, link_id
        LIMIT ${limit}
      `);
      return result.rows.map((row) => reviveLink(row.document));
    });
  }

  async countClicksForProgram(programId: string): Promise<number> {
    return run("count referral clicks", async () => {
      const result = await this.database.execute(sql`
        SELECT COUNT(*) AS total FROM croco_referral_clicks
        WHERE link_id IN (SELECT link_id FROM croco_referral_links WHERE program_id = ${programId})
      `);
      return Number(result.rows[0]?.total ?? 0);
    });
  }

  async listBenefitIntents(
    filter: ListBenefitIntentsFilter,
  ): Promise<readonly ReferralBenefitIntent[]> {
    return run("list referral benefit intents", () =>
      listBenefitIntentsWith(this.database, filter),
    );
  }
}

async function listAttributionsWith(
  executor: ReferralPgExecutor,
  filter: ListAttributionsFilter,
): Promise<readonly ReferralAttribution[]> {
  const limit = assertLimit(filter.limit, 100);
  const states = filter.states ?? [...ATTRIBUTION_STATES];
  const stateList = sql.join(
    states.map((state) => sql`${state}`),
    sql`, `,
  );
  const programId: string | null = filter.programId ?? null;
  const familyId: string | null = filter.familyId ?? null;
  const cycleId: string | null = filter.benefitCycleId ?? null;
  const referrerJson: string | null = filter.referrer ? JSON.stringify(filter.referrer) : null;
  const recipientJson: string | null = filter.recipient ? JSON.stringify(filter.recipient) : null;
  const result = await executor.execute(sql`
    SELECT document FROM croco_referral_attributions
    WHERE (${programId}::text IS NULL OR program_id = ${programId})
      AND (${familyId}::text IS NULL OR family_id = ${familyId})
      AND (${cycleId}::text IS NULL OR benefit_cycle_id = ${cycleId})
      AND state IN (${stateList})
      AND (${referrerJson}::jsonb IS NULL OR referrer = ${referrerJson}::jsonb)
      AND (${recipientJson}::jsonb IS NULL OR recipient = ${recipientJson}::jsonb)
    ORDER BY created_at, attribution_id
    LIMIT ${limit}
  `);
  return result.rows.map((row) => reviveAttribution(row.document));
}

async function listBenefitIntentsWith(
  executor: ReferralPgExecutor,
  filter: ListBenefitIntentsFilter,
): Promise<readonly ReferralBenefitIntent[]> {
  const limit = assertLimit(filter.limit, 100);
  const attributionId: string | null = filter.attributionId ?? null;
  const side: string | null = filter.side ?? null;
  const statuses = filter.statuses ?? [
    "pending",
    "granting",
    "granted",
    "failed",
    "unknown",
    "canceled",
    "returned",
    "skipped",
  ];
  const statusList = sql.join(
    statuses.map((status) => sql`${status}`),
    sql`, `,
  );
  const result = await executor.execute(sql`
    SELECT document FROM croco_referral_benefit_intents
    WHERE (${attributionId}::text IS NULL OR attribution_id = ${attributionId})
      AND (${side}::text IS NULL OR side = ${side})
      AND status IN (${statusList})
    ORDER BY created_at, intent_id
    LIMIT ${limit}
  `);
  return result.rows.map((row) => reviveIntent(row.document));
}

class PostgresReferralTx implements ReferralTx {
  constructor(private readonly executor: ReferralPgExecutor) {}

  async getProgram(programId: string, version: number): Promise<ReferralProgramDefinition | null> {
    return run("read referral program", async () => {
      const result = await this.executor.execute(sql`
        SELECT document FROM croco_referral_programs
        WHERE program_id = ${programId} AND version = ${version}
      `);
      const row = result.rows[0];
      return row ? reviveProgram(row.document) : null;
    });
  }

  async latestProgramVersion(programId: string): Promise<number | null> {
    return run("read referral program version", async () => {
      const result = await this.executor.execute(sql`
        SELECT MAX(version) AS latest FROM croco_referral_programs
        WHERE program_id = ${programId}
      `);
      const latest = result.rows[0]?.latest;
      if (typeof latest === "number") return latest;
      if (typeof latest === "string" && latest.trim().length > 0) {
        return Number.parseInt(latest, 10);
      }
      return null;
    });
  }

  async saveProgram(program: ReferralProgramDefinition): Promise<{ readonly created: boolean }> {
    return run("save referral program", async () => {
      const document = JSON.stringify(program);
      const fingerprint = stableReferralFingerprint(program);
      const inserted = await this.executor.execute(sql`
        INSERT INTO croco_referral_programs (
          program_id, version, family_id, benefit_cycle_id, document, fingerprint,
          budget_total, budget_reserved, actor_id, reason, idempotency_key
        ) VALUES (
          ${program.id}, ${program.version}, ${program.familyId}, ${program.benefitCycleId},
          ${document}::jsonb, ${fingerprint}, ${program.budgetTotal}, ${ZERO_REFERRAL_AMOUNT},
          ${program.actorId}, ${program.reason}, ${program.idempotencyKey}
        )
        ON CONFLICT (program_id, version) DO NOTHING
        RETURNING program_id
      `);
      if (inserted.rows.length > 0) return { created: true };
      const existing = await this.executor.execute(sql`
        SELECT fingerprint FROM croco_referral_programs
        WHERE program_id = ${program.id} AND version = ${program.version}
      `);
      if (existing.rows[0]?.fingerprint !== fingerprint) {
        throw new ReferralProgramConflictProblem(program.id, program.version);
      }
      return { created: false };
    });
  }

  async getLink(linkId: string): Promise<ReferralLink | null> {
    return run("read referral link", async () => {
      const result = await this.executor.execute(sql`
        SELECT document FROM croco_referral_links WHERE link_id = ${linkId}
      `);
      const row = result.rows[0];
      return row ? reviveLink(row.document) : null;
    });
  }

  async getLinkByTokenHash(tokenHash: string): Promise<ReferralLink | null> {
    return run("read referral link", async () => {
      const result = await this.executor.execute(sql`
        SELECT document FROM croco_referral_links WHERE token_hash = ${tokenHash}
      `);
      const row = result.rows[0];
      return row ? reviveLink(row.document) : null;
    });
  }

  async saveLink(
    link: ReferralLink,
  ): Promise<{ readonly created: boolean; readonly link: ReferralLink }> {
    return run("save referral link", async () => {
      const inserted = await this.executor.execute(sql`
        INSERT INTO croco_referral_links (
          link_id, token_hash, program_id, program_version, family_id, benefit_cycle_id,
          referrer, document, expires_at, revoked_at
        ) VALUES (
          ${link.id}, ${link.tokenHash}, ${link.programId}, ${link.programVersion},
          ${link.familyId}, ${link.benefitCycleId}, ${JSON.stringify(link.referrer)}::jsonb,
          ${JSON.stringify(link)}::jsonb, ${link.expiresAt}, ${link.revokedAt ?? null}
        )
        ON CONFLICT (link_id) DO NOTHING
        RETURNING link_id
      `);
      if (inserted.rows.length > 0) return { created: true, link: reviveLink(link) };
      const existing = await this.executor.execute(sql`
        SELECT document, token_hash FROM croco_referral_links WHERE link_id = ${link.id}
      `);
      const row = existing.rows[0];
      if (!row) {
        throw new ReferralPersistenceProblem(
          "save referral link",
          new Error("link insert lost a concurrent update"),
        );
      }
      if (String(row.token_hash) !== link.tokenHash) {
        throw new ReferralDuplicateClaimProblem(link.referrer.id);
      }
      return { created: false, link: reviveLink(row.document) };
    });
  }

  async revokeLink(linkId: string, revokedAt: Date): Promise<ReferralLink> {
    return run("revoke referral link", async () => {
      const stored = await this.getLink(linkId);
      if (!stored) throw new ReferralLinkNotFoundProblem();
      if (stored.revokedAt !== undefined) return stored;
      const revoked: ReferralLink = { ...stored, revokedAt: new Date(revokedAt.getTime()) };
      const moved = await this.executor.execute(sql`
        UPDATE croco_referral_links
        SET document = ${JSON.stringify(revoked)}::jsonb, revoked_at = ${revoked.revokedAt}
        WHERE link_id = ${linkId} AND revoked_at IS NULL
        RETURNING link_id
      `);
      if (moved.rows.length === 0) {
        const latest = await this.getLink(linkId);
        if (!latest) throw new ReferralLinkNotFoundProblem();
        return latest;
      }
      return revoked;
    });
  }

  async recordClick(linkId: string, occurredAt: Date): Promise<void> {
    await run("record referral click", () =>
      this.executor.execute(sql`
        INSERT INTO croco_referral_clicks (link_id, occurred_at)
        VALUES (${linkId}, ${occurredAt})
      `),
    );
  }

  async getAttribution(attributionId: string): Promise<ReferralAttribution | null> {
    return run("read referral attribution", async () => {
      const result = await this.executor.execute(sql`
        SELECT document FROM croco_referral_attributions WHERE attribution_id = ${attributionId}
      `);
      const row = result.rows[0];
      return row ? reviveAttribution(row.document) : null;
    });
  }

  async getFirstAttributionForRecipient(
    familyId: string,
    recipient: ReferralSubject,
  ): Promise<ReferralAttribution | null> {
    return run("read first referral attribution", async () => {
      const key = recipientKey(recipient);
      const result = await this.executor.execute(sql`
        SELECT document FROM croco_referral_attributions
        WHERE family_id = ${familyId} AND recipient_key = ${key}
        ORDER BY claimed_at, attribution_id
        LIMIT 1
      `);
      const row = result.rows[0];
      return row ? reviveAttribution(row.document) : null;
    });
  }

  async listAttributionsForRecipient(
    familyId: string,
    recipient: ReferralSubject,
  ): Promise<readonly ReferralAttribution[]> {
    return run("list recipient attributions", async () => {
      const key = recipientKey(recipient);
      const result = await this.executor.execute(sql`
        SELECT document FROM croco_referral_attributions
        WHERE family_id = ${familyId} AND recipient_key = ${key}
        ORDER BY claimed_at, attribution_id
      `);
      return result.rows.map((row) => reviveAttribution(row.document));
    });
  }

  async saveAttribution(
    attribution: ReferralAttribution,
    fingerprint: string,
  ): Promise<{ readonly created: boolean; readonly attribution: ReferralAttribution }> {
    return run("save referral attribution", async () => {
      const key = recipientKey(attribution.recipient);
      try {
        const inserted = await this.executor.execute(sql`
          INSERT INTO croco_referral_attributions (
            attribution_id, link_id, fingerprint, program_id, program_version,
            family_id, benefit_cycle_id, scope, referrer, recipient, recipient_key,
            document, state, hold_reason, reject_reason, claimed_at, expires_at, cycle_index
          ) VALUES (
            ${attribution.id}, ${attribution.linkId}, ${fingerprint},
            ${attribution.programId}, ${attribution.programVersion},
            ${attribution.familyId}, ${attribution.benefitCycleId},
            ${JSON.stringify(attribution.scope)}::jsonb,
            ${JSON.stringify(attribution.referrer)}::jsonb,
            ${attribution.recipient ? JSON.stringify(attribution.recipient) : null}::jsonb,
            ${key},
            ${JSON.stringify(attribution)}::jsonb, ${attribution.state},
            ${attribution.holdReason ?? null}, ${attribution.rejectReason ?? null},
            ${attribution.claimedAt}, ${attribution.expiresAt}, ${attribution.cycleIndex}
          )
          ON CONFLICT (attribution_id) DO NOTHING
          RETURNING attribution_id
        `);
        if (inserted.rows.length > 0) {
          return { created: true, attribution: reviveAttribution(attribution) };
        }
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ReferralDuplicateClaimProblem(attribution.recipient?.id ?? attribution.id);
        }
        throw error;
      }
      const existing = await this.executor.execute(sql`
        SELECT document, fingerprint FROM croco_referral_attributions
        WHERE attribution_id = ${attribution.id}
      `);
      const row = existing.rows[0];
      if (!row) {
        throw new ReferralDuplicateClaimProblem(attribution.recipient?.id ?? attribution.id);
      }
      if (row.fingerprint !== fingerprint) {
        throw new ReferralDuplicateClaimProblem(attribution.recipient?.id ?? attribution.id);
      }
      return { created: false, attribution: reviveAttribution(row.document) };
    });
  }

  async compareAndSetAttribution(
    attributionId: string,
    expected: readonly ReferralAttributionState[],
    next: ReferralAttribution,
  ): Promise<ReferralAttribution> {
    return run("transition referral attribution", async () => {
      const current = await this.getAttribution(attributionId);
      if (!current) throw new ReferralAttributionNotFoundProblem(attributionId);
      if (!expected.includes(current.state)) {
        throw new ReferralAttributionStateConflictProblem(
          attributionId,
          current.state,
          `expected one of ${expected.join(", ")}`,
        );
      }
      const updated: ReferralAttribution = { ...next };
      const expectedList = sql.join(
        [...expected].map((state) => sql`${state}`),
        sql`, `,
      );
      const moved = await this.executor.execute(sql`
        UPDATE croco_referral_attributions
        SET document = ${JSON.stringify(updated)}::jsonb, state = ${updated.state},
            hold_reason = ${updated.holdReason ?? null},
            reject_reason = ${updated.rejectReason ?? null},
            updated_at = ${updated.updatedAt}
        WHERE attribution_id = ${attributionId} AND state IN (${expectedList})
        RETURNING attribution_id
      `);
      if (moved.rows.length === 0) {
        const latest = await this.getAttribution(attributionId);
        throw new ReferralAttributionStateConflictProblem(
          attributionId,
          latest?.state ?? current.state,
          `expected one of ${expected.join(", ")}`,
        );
      }
      return reviveAttribution(updated);
    });
  }

  async getBenefitIntent(intentId: string): Promise<ReferralBenefitIntent | null> {
    return run("read referral benefit intent", async () => {
      const result = await this.executor.execute(sql`
        SELECT document FROM croco_referral_benefit_intents WHERE intent_id = ${intentId}
      `);
      const row = result.rows[0];
      return row ? reviveIntent(row.document) : null;
    });
  }

  async getBenefitIntentByLogicalKey(logicalKey: string): Promise<ReferralBenefitIntent | null> {
    return run("read referral benefit intent", async () => {
      const result = await this.executor.execute(sql`
        SELECT document FROM croco_referral_benefit_intents WHERE logical_key = ${logicalKey}
      `);
      const row = result.rows[0];
      return row ? reviveIntent(row.document) : null;
    });
  }

  async listBenefitIntentsForAttribution(
    attributionId: string,
  ): Promise<readonly ReferralBenefitIntent[]> {
    return run("list attribution benefit intents", async () => {
      const result = await this.executor.execute(sql`
        SELECT document FROM croco_referral_benefit_intents
        WHERE attribution_id = ${attributionId}
        ORDER BY side
      `);
      return result.rows.map((row) => reviveIntent(row.document));
    });
  }

  async saveBenefitIntent(
    intent: ReferralBenefitIntent,
  ): Promise<{ readonly created: boolean; readonly intent: ReferralBenefitIntent }> {
    return run("save referral benefit intent", async () => {
      const inserted = await this.executor.execute(sql`
        INSERT INTO croco_referral_benefit_intents (
          intent_id, attribution_id, side, logical_key, idempotency_key,
          subject, document, status
        ) VALUES (
          ${intent.id}, ${intent.attributionId}, ${intent.side},
          ${intent.logicalKey}, ${intent.idempotencyKey},
          ${JSON.stringify(intent.subject)}::jsonb,
          ${JSON.stringify(intent)}::jsonb, ${intent.status}
        )
        ON CONFLICT (logical_key) DO NOTHING
        RETURNING intent_id
      `);
      if (inserted.rows.length > 0) return { created: true, intent: reviveIntent(intent) };
      const existing = await this.executor.execute(sql`
        SELECT document FROM croco_referral_benefit_intents
        WHERE logical_key = ${intent.logicalKey}
      `);
      const row = existing.rows[0];
      if (!row) {
        throw new ReferralDuplicateClaimProblem(intent.logicalKey);
      }
      return { created: false, intent: reviveIntent(row.document) };
    });
  }

  async compareAndSetBenefitIntent(
    intentId: string,
    expected: readonly ReferralBenefitIntentStatus[],
    patch: {
      readonly status: ReferralBenefitIntentStatus;
      readonly receipt?: string;
      readonly reason?: string;
      readonly accountRef?: string;
    },
    now: Date,
  ): Promise<ReferralBenefitIntent> {
    return run("transition referral benefit intent", async () => {
      const current = await this.getBenefitIntent(intentId);
      if (!current) throw new ReferralAttributionNotFoundProblem(intentId);
      if (!expected.includes(current.status)) {
        throw new ReferralAttributionStateConflictProblem(
          intentId,
          current.status,
          `expected one of ${expected.join(", ")}`,
        );
      }
      const updated: ReferralBenefitIntent = {
        ...current,
        status: patch.status,
        receipt: patch.receipt ?? current.receipt,
        reason: patch.reason,
        accountRef: patch.accountRef ?? current.accountRef,
        updatedAt: new Date(now.getTime()),
      };
      const expectedList = sql.join(
        [...expected].map((status) => sql`${status}`),
        sql`, `,
      );
      const moved = await this.executor.execute(sql`
        UPDATE croco_referral_benefit_intents
        SET document = ${JSON.stringify(updated)}::jsonb, status = ${updated.status},
            updated_at = ${updated.updatedAt}
        WHERE intent_id = ${intentId} AND status IN (${expectedList})
        RETURNING intent_id
      `);
      if (moved.rows.length === 0) {
        const latest = await this.getBenefitIntent(intentId);
        throw new ReferralAttributionStateConflictProblem(
          intentId,
          latest?.status ?? current.status,
          `expected one of ${expected.join(", ")}`,
        );
      }
      return reviveIntent(updated);
    });
  }

  async addBudgetReservation(programId: string, version: number, amount: string): Promise<void> {
    await run("reserve referral budget", async () => {
      const moved = await this.executor.execute(sql`
        UPDATE croco_referral_programs
        SET budget_reserved = budget_reserved + ${amount}::numeric
        WHERE program_id = ${programId}
          AND version = ${version}
          AND budget_reserved + ${amount}::numeric <= budget_total
        RETURNING budget_reserved
      `);
      if (moved.rows.length > 0) return;
      const existing = await this.executor.execute(sql`
        SELECT budget_total, budget_reserved FROM croco_referral_programs
        WHERE program_id = ${programId} AND version = ${version}
      `);
      const row = existing.rows[0];
      if (!row) throw new ReferralProgramNotFoundProblem(programId, version);
      const next = addReferralAmounts(String(row.budget_reserved), amount);
      if (compareReferralAmounts(next, String(row.budget_total)) > 0) {
        throw new ReferralBudgetExhaustedProblem(programId, version);
      }
      throw new ReferralPersistenceProblem(
        "reserve referral budget",
        new Error("budget reservation lost a concurrent update"),
      );
    });
  }

  async releaseBudgetReservation(
    programId: string,
    version: number,
    amount: string,
  ): Promise<void> {
    await run("release referral budget", async () => {
      const existing = await this.executor.execute(sql`
        SELECT budget_reserved FROM croco_referral_programs
        WHERE program_id = ${programId} AND version = ${version}
        FOR UPDATE
      `);
      const row = existing.rows[0];
      if (!row) throw new ReferralProgramNotFoundProblem(programId, version);
      const reserved = String(row.budget_reserved);
      const next =
        compareReferralAmounts(amount, reserved) >= 0
          ? ZERO_REFERRAL_AMOUNT
          : subtractReferralAmounts(reserved, amount);
      await this.executor.execute(sql`
        UPDATE croco_referral_programs
        SET budget_reserved = ${next}::numeric
        WHERE program_id = ${programId} AND version = ${version}
      `);
    });
  }

  async readBudgetReserved(programId: string, version: number): Promise<string> {
    return run("read referral budget", async () => {
      const result = await this.executor.execute(sql`
        SELECT budget_reserved FROM croco_referral_programs
        WHERE program_id = ${programId} AND version = ${version}
      `);
      const row = result.rows[0];
      if (!row) throw new ReferralProgramNotFoundProblem(programId, version);
      return String(row.budget_reserved);
    });
  }

  async countSubjectReceipts(
    familyId: string,
    benefitCycleId: string,
    subject: ReferralSubject,
    states: readonly ReferralAttributionState[],
  ): Promise<number> {
    return run("count referral receipts", async () => {
      const stateList = sql.join(
        [...states].map((state) => sql`${state}`),
        sql`, `,
      );
      const subjectJson = JSON.stringify(subject);
      const result = await this.executor.execute(sql`
        SELECT COUNT(*) AS total FROM croco_referral_attributions
        WHERE family_id = ${familyId}
          AND benefit_cycle_id = ${benefitCycleId}
          AND (referrer = ${subjectJson}::jsonb OR recipient = ${subjectJson}::jsonb)
          AND state IN (${stateList})
      `);
      return Number(result.rows[0]?.total ?? 0);
    });
  }

  async listAttributions(filter: ListAttributionsFilter): Promise<readonly ReferralAttribution[]> {
    return run("list referral attributions", () => listAttributionsWith(this.executor, filter));
  }

  async listLinks(filter: ListReferralLinksFilter): Promise<readonly ReferralLink[]> {
    return run("list referral links", async () => {
      const limit = assertLimit(filter.limit, 100);
      const programId: string | null = filter.programId ?? null;
      const familyId: string | null = filter.familyId ?? null;
      const cycleId: string | null = filter.benefitCycleId ?? null;
      const referrerJson: string | null = filter.referrer ? JSON.stringify(filter.referrer) : null;
      const result = await this.executor.execute(sql`
        SELECT document FROM croco_referral_links
        WHERE (${programId}::text IS NULL OR program_id = ${programId})
          AND (${familyId}::text IS NULL OR family_id = ${familyId})
          AND (${cycleId}::text IS NULL OR benefit_cycle_id = ${cycleId})
          AND (${referrerJson}::jsonb IS NULL OR referrer = ${referrerJson}::jsonb)
        ORDER BY created_at, link_id
        LIMIT ${limit}
      `);
      return result.rows.map((row) => reviveLink(row.document));
    });
  }

  async countClicksForProgram(programId: string): Promise<number> {
    return run("count referral clicks", async () => {
      const result = await this.executor.execute(sql`
        SELECT COUNT(*) AS total FROM croco_referral_clicks
        WHERE link_id IN (SELECT link_id FROM croco_referral_links WHERE program_id = ${programId})
      `);
      return Number(result.rows[0]?.total ?? 0);
    });
  }

  async listBenefitIntents(
    filter: ListBenefitIntentsFilter,
  ): Promise<readonly ReferralBenefitIntent[]> {
    return run("list referral benefit intents", () =>
      listBenefitIntentsWith(this.executor, filter),
    );
  }

  async countClicks(linkId: string): Promise<number> {
    return run("count referral clicks", async () => {
      const result = await this.executor.execute(sql`
        SELECT COUNT(*) AS total FROM croco_referral_clicks WHERE link_id = ${linkId}
      `);
      return Number(result.rows[0]?.total ?? 0);
    });
  }

  async recordAudit(entry: ReferralAuditEntry): Promise<void> {
    await run("record referral audit", () =>
      this.executor.execute(sql`
        INSERT INTO croco_referral_audit (audit_id, target_kind, target_id, action, document)
        VALUES (${entry.auditId}, ${entry.targetKind}, ${entry.targetId}, ${entry.action}, ${JSON.stringify(entry)}::jsonb)
        ON CONFLICT (audit_id) DO NOTHING
      `),
    );
  }
}
