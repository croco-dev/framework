import { sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { Problem, ProblemCategory } from "@croco/problems-core";
import {
  addOfferAmounts,
  compareOfferAmounts,
  stablePromotionFingerprint,
  subtractOfferAmounts,
  ZERO_OFFER_AMOUNT,
} from "@croco/promotions-core";
import {
  InvalidOfferPolicyProblem,
  OfferBudgetExhaustedProblem,
  OfferClaimNotFoundProblem,
  OfferClaimStateConflictProblem,
  OfferDuplicateClaimProblem,
  OfferPolicyConflictProblem,
  OfferPolicyNotFoundProblem,
} from "@croco/promotions-core";
import type {
  ListClaimsFilter,
  OfferAuditEntry,
  OfferClaim,
  OfferClaimState,
  OfferQuote,
  OfferSubject,
  PromotionStore,
  PromotionTx,
  RegisteredOfferPolicy,
} from "@croco/promotions-core";

export interface PromotionPgExecutor {
  execute(query: SQL): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface PromotionPgDatabase extends PromotionPgExecutor {
  transaction<T>(work: (tx: PromotionPgExecutor) => Promise<T>): Promise<T>;
}

/** Reports a PostgreSQL failure without leaking statement text or parameters. */
export class PromotionPersistenceProblem extends Problem {
  readonly code = "promotions-drizzle/persistence-failure";
  readonly category = ProblemCategory.InternalServerError;

  constructor(operation: string, cause: Error) {
    super(undefined, undefined, `Promotion persistence failed during '${operation}'.`, { cause });
  }
}

const CLAIM_STATES: readonly OfferClaimState[] = [
  "reserved",
  "fulfilling",
  "fulfilled",
  "expired",
  "rejected",
  "indeterminate",
];

function asDate(value: unknown, field: string): Date {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new PromotionPersistenceProblem(
      "read promotion document",
      new Error(`stored ${field} is not a valid timestamp`),
    );
  }
  return date;
}

function reviveBenefitDates(benefit: OfferClaim["benefit"]): OfferClaim["benefit"] {
  if (benefit.kind !== "trial-credits" || benefit.expiresAt === undefined) return benefit;
  return { ...benefit, expiresAt: asDate(benefit.expiresAt, "benefit.expiresAt") };
}

function revivePolicy(document: unknown): RegisteredOfferPolicy {
  const policy = document as RegisteredOfferPolicy;
  return {
    ...policy,
    benefit: reviveBenefitDates(policy.benefit),
    startsAt: asDate(policy.startsAt, "startsAt"),
    endsAt: asDate(policy.endsAt, "endsAt"),
    registeredAt: asDate(policy.registeredAt, "registeredAt"),
  };
}

function reviveQuote(document: unknown): OfferQuote {
  const quote = document as OfferQuote;
  return {
    ...quote,
    benefit: reviveBenefitDates(quote.benefit),
    expiresAt: asDate(quote.expiresAt, "expiresAt"),
    quotedAt: asDate(quote.quotedAt, "quotedAt"),
  };
}

function reviveClaim(document: unknown): OfferClaim {
  const claim = document as OfferClaim;
  if (!CLAIM_STATES.includes(claim.state)) {
    throw new PromotionPersistenceProblem(
      "read promotion document",
      new Error(`stored claim state '${String(claim.state)}' is not a known offer state`),
    );
  }
  return {
    ...claim,
    benefit: reviveBenefitDates(claim.benefit),
    createdAt: asDate(claim.createdAt, "createdAt"),
    updatedAt: asDate(claim.updatedAt, "updatedAt"),
  };
}

function assertLimit(limit: number | undefined, fallback: number): number {
  const resolved = limit ?? fallback;
  if (!Number.isInteger(resolved) || resolved < 1 || resolved > 1000) {
    throw new InvalidOfferPolicyProblem("list limit must be an integer between 1 and 1000");
  }
  return resolved;
}

async function run<T>(operation: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof Problem) throw error;
    throw new PromotionPersistenceProblem(
      operation,
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}

/** PostgreSQL adapter for a Drizzle node-postgres execute/transaction boundary. */
export class PostgresPromotionStore implements PromotionStore {
  constructor(private readonly database: PromotionPgDatabase) {}

  async transact<T>(work: (tx: PromotionTx) => Promise<T>): Promise<T> {
    return run("transact", () =>
      this.database.transaction((executor) => work(new PostgresPromotionTx(executor))),
    );
  }

  async getPolicy(policyId: string, version: number): Promise<RegisteredOfferPolicy | null> {
    return run("read promotion policy", async () => {
      const result = await this.database.execute(sql`
        SELECT document FROM croco_promotion_policies
        WHERE policy_id = ${policyId} AND version = ${version}
      `);
      const row = result.rows[0];
      return row ? revivePolicy(row.document) : null;
    });
  }

  async latestPolicyVersion(policyId: string): Promise<number | null> {
    return run("read promotion policy version", async () => {
      const result = await this.database.execute(sql`
        SELECT MAX(version) AS latest FROM croco_promotion_policies
        WHERE policy_id = ${policyId}
      `);
      const latest = result.rows[0]?.latest;
      if (typeof latest === "number") return latest;
      if (typeof latest === "string" && latest.trim().length > 0)
        return Number.parseInt(latest, 10);
      return null;
    });
  }

  async getQuote(quoteId: string): Promise<OfferQuote | null> {
    return run("read promotion quote", async () => {
      const result = await this.database.execute(sql`
        SELECT document FROM croco_promotion_quotes WHERE quote_id = ${quoteId}
      `);
      const row = result.rows[0];
      return row ? reviveQuote(row.document) : null;
    });
  }

  async getClaim(claimId: string): Promise<OfferClaim | null> {
    return run("read promotion claim", async () => {
      const result = await this.database.execute(sql`
        SELECT document FROM croco_promotion_claims WHERE claim_id = ${claimId}
      `);
      const row = result.rows[0];
      return row ? reviveClaim(row.document) : null;
    });
  }

  async getClaimByLogicalKey(logicalKey: string): Promise<OfferClaim | null> {
    return run("read promotion claim", async () => {
      const result = await this.database.execute(sql`
        SELECT document FROM croco_promotion_claims WHERE logical_key = ${logicalKey}
      `);
      const row = result.rows[0];
      return row ? reviveClaim(row.document) : null;
    });
  }

  async listClaims(filter: ListClaimsFilter): Promise<readonly OfferClaim[]> {
    return run("list promotion claims", () => listClaimsWith(this.database, filter));
  }
}

async function listClaimsWith(
  executor: PromotionPgExecutor,
  filter: ListClaimsFilter,
): Promise<readonly OfferClaim[]> {
  const limit = assertLimit(filter.limit, 100);
  const states = filter.states ?? [...CLAIM_STATES];
  const stateList = sql.join(
    states.map((state) => sql`${state}`),
    sql`, `,
  );
  const familyId: string | null = filter.familyId ?? null;
  const benefitCycleId: string | null = filter.benefitCycleId ?? null;
  const stackingGroup: string | null = filter.stackingGroup ?? null;
  const subjectJson: string | null = filter.subject ? JSON.stringify(filter.subject) : null;
  const result = await executor.execute(sql`
    SELECT document FROM croco_promotion_claims
    WHERE (${familyId}::text IS NULL OR family_id = ${familyId})
      AND (${benefitCycleId}::text IS NULL OR benefit_cycle_id = ${benefitCycleId})
      AND (${stackingGroup}::text IS NULL OR stacking_group = ${stackingGroup})
      AND state IN (${stateList})
      AND (${subjectJson}::jsonb IS NULL OR subject = ${subjectJson}::jsonb)
    ORDER BY created_at, claim_id
    LIMIT ${limit}
  `);
  return result.rows.map((row) => reviveClaim(row.document));
}

class PostgresPromotionTx implements PromotionTx {
  constructor(private readonly executor: PromotionPgExecutor) {}

  async getPolicy(policyId: string, version: number): Promise<RegisteredOfferPolicy | null> {
    return run("read promotion policy", async () => {
      const result = await this.executor.execute(sql`
        SELECT document FROM croco_promotion_policies
        WHERE policy_id = ${policyId} AND version = ${version}
      `);
      const row = result.rows[0];
      return row ? revivePolicy(row.document) : null;
    });
  }

  async latestPolicyVersion(policyId: string): Promise<number | null> {
    return run("read promotion policy version", async () => {
      const result = await this.executor.execute(sql`
        SELECT MAX(version) AS latest FROM croco_promotion_policies
        WHERE policy_id = ${policyId}
      `);
      const latest = result.rows[0]?.latest;
      if (typeof latest === "number") return latest;
      if (typeof latest === "string" && latest.trim().length > 0)
        return Number.parseInt(latest, 10);
      return null;
    });
  }

  async savePolicy(policy: RegisteredOfferPolicy): Promise<{ readonly created: boolean }> {
    return run("save promotion policy", async () => {
      const document = JSON.stringify(policy);
      const fingerprint = stablePromotionFingerprint(policy);
      const inserted = await this.executor.execute(sql`
        INSERT INTO croco_promotion_policies (
          policy_id, version, family_id, benefit_cycle_id, document, fingerprint,
          budget_total, budget_reserved, actor_id, reason, idempotency_key
        ) VALUES (
          ${policy.id}, ${policy.version}, ${policy.familyId}, ${policy.benefitCycleId},
          ${document}::jsonb, ${fingerprint}, ${policy.budget.total}, ${ZERO_OFFER_AMOUNT},
          ${policy.actorId}, ${policy.reason}, ${policy.idempotencyKey}
        )
        ON CONFLICT (policy_id, version) DO NOTHING
        RETURNING policy_id
      `);
      if (inserted.rows.length > 0) return { created: true };
      const existing = await this.executor.execute(sql`
        SELECT fingerprint FROM croco_promotion_policies
        WHERE policy_id = ${policy.id} AND version = ${policy.version}
      `);
      if (existing.rows[0]?.fingerprint !== fingerprint) {
        throw new OfferPolicyConflictProblem(policy.id, policy.version);
      }
      return { created: false };
    });
  }

  async getQuote(quoteId: string): Promise<OfferQuote | null> {
    return run("read promotion quote", async () => {
      const result = await this.executor.execute(sql`
        SELECT document FROM croco_promotion_quotes WHERE quote_id = ${quoteId}
      `);
      const row = result.rows[0];
      return row ? reviveQuote(row.document) : null;
    });
  }

  async saveQuote(quote: OfferQuote): Promise<void> {
    await run("save promotion quote", () =>
      this.executor.execute(sql`
        INSERT INTO croco_promotion_quotes (quote_id, policy_id, policy_version, document, expires_at)
        VALUES (${quote.id}, ${quote.policyId}, ${quote.policyVersion}, ${JSON.stringify(quote)}::jsonb, ${quote.expiresAt})
        ON CONFLICT (quote_id) DO NOTHING
      `),
    );
  }

  async getClaim(claimId: string): Promise<OfferClaim | null> {
    return run("read promotion claim", async () => {
      const result = await this.executor.execute(sql`
        SELECT document FROM croco_promotion_claims WHERE claim_id = ${claimId}
      `);
      const row = result.rows[0];
      return row ? reviveClaim(row.document) : null;
    });
  }

  async getClaimByLogicalKey(logicalKey: string): Promise<OfferClaim | null> {
    return run("read promotion claim", async () => {
      const result = await this.executor.execute(sql`
        SELECT document FROM croco_promotion_claims WHERE logical_key = ${logicalKey}
      `);
      const row = result.rows[0];
      return row ? reviveClaim(row.document) : null;
    });
  }

  async saveClaim(
    claim: OfferClaim,
    fingerprint: string,
  ): Promise<{ readonly created: boolean; readonly claim: OfferClaim }> {
    return run("save promotion claim", async () => {
      const inserted = await this.executor.execute(sql`
        INSERT INTO croco_promotion_claims (
          claim_id, quote_id, logical_key, fingerprint, family_id, benefit_cycle_id,
          subject, document, state, stacking_group, updated_at
        ) VALUES (
          ${claim.id}, ${claim.quoteId}, ${claim.logicalKey}, ${fingerprint},
          ${claim.familyId}, ${claim.benefitCycleId}, ${JSON.stringify(claim.subject)}::jsonb,
          ${JSON.stringify(claim)}::jsonb, ${claim.state}, ${claim.stackingGroup ?? null}, ${claim.updatedAt}
        )
        ON CONFLICT (logical_key) DO NOTHING
        RETURNING claim_id
      `);
      if (inserted.rows.length > 0) return { created: true, claim: reviveClaim(claim) };
      const existing = await this.executor.execute(sql`
        SELECT document, fingerprint FROM croco_promotion_claims
        WHERE logical_key = ${claim.logicalKey}
      `);
      const row = existing.rows[0];
      if (!row || row.fingerprint !== fingerprint) {
        throw new OfferDuplicateClaimProblem(claim.logicalKey);
      }
      return { created: false, claim: reviveClaim(row.document) };
    });
  }

  async compareAndSetClaimState(
    claimId: string,
    expected: readonly OfferClaimState[],
    next: OfferClaimState,
    patch: { readonly grantRef?: string } = {},
    now: Date = new Date(),
  ): Promise<OfferClaim> {
    return run("transition promotion claim", async () => {
      const current = await this.getClaim(claimId);
      if (!current) throw new OfferClaimNotFoundProblem(claimId);
      if (!expected.includes(current.state)) {
        throw new OfferClaimStateConflictProblem(
          claimId,
          current.state,
          `expected one of ${expected.join(", ")} to move to '${next}'`,
        );
      }
      const updated: OfferClaim = {
        ...current,
        state: next,
        grantRef: patch.grantRef ?? current.grantRef,
        updatedAt: new Date(now.getTime()),
      };
      const expectedList = sql.join(
        [...expected].map((state) => sql`${state}`),
        sql`, `,
      );
      const moved = await this.executor.execute(sql`
        UPDATE croco_promotion_claims
        SET document = ${JSON.stringify(updated)}::jsonb, state = ${next}, updated_at = ${updated.updatedAt}
        WHERE claim_id = ${claimId} AND state IN (${expectedList})
        RETURNING claim_id
      `);
      if (moved.rows.length === 0) {
        const latest = await this.getClaim(claimId);
        throw new OfferClaimStateConflictProblem(
          claimId,
          latest?.state ?? current.state,
          `expected one of ${expected.join(", ")} to move to '${next}'`,
        );
      }
      return updated;
    });
  }

  async addBudgetReservation(policyId: string, version: number, amount: string): Promise<void> {
    await run("reserve promotion budget", async () => {
      const moved = await this.executor.execute(sql`
        UPDATE croco_promotion_policies
        SET budget_reserved = budget_reserved + ${amount}::numeric
        WHERE policy_id = ${policyId}
          AND version = ${version}
          AND budget_reserved + ${amount}::numeric <= budget_total
        RETURNING budget_reserved
      `);
      if (moved.rows.length > 0) return;
      const existing = await this.executor.execute(sql`
        SELECT budget_total, budget_reserved FROM croco_promotion_policies
        WHERE policy_id = ${policyId} AND version = ${version}
      `);
      const row = existing.rows[0];
      if (!row) throw new OfferPolicyNotFoundProblem(policyId, version);
      const next = addOfferAmounts(String(row.budget_reserved), amount);
      if (compareOfferAmounts(next, String(row.budget_total)) > 0) {
        throw new OfferBudgetExhaustedProblem(policyId, version);
      }
      throw new PromotionPersistenceProblem(
        "reserve promotion budget",
        new Error("budget reservation lost a concurrent update"),
      );
    });
  }

  async releaseBudgetReservation(policyId: string, version: number, amount: string): Promise<void> {
    await run("release promotion budget", async () => {
      const existing = await this.executor.execute(sql`
        SELECT budget_reserved FROM croco_promotion_policies
        WHERE policy_id = ${policyId} AND version = ${version}
        FOR UPDATE
      `);
      const row = existing.rows[0];
      if (!row) throw new OfferPolicyNotFoundProblem(policyId, version);
      const reserved = String(row.budget_reserved);
      const next =
        compareOfferAmounts(amount, reserved) >= 0
          ? ZERO_OFFER_AMOUNT
          : subtractOfferAmounts(reserved, amount);
      await this.executor.execute(sql`
        UPDATE croco_promotion_policies
        SET budget_reserved = ${next}::numeric
        WHERE policy_id = ${policyId} AND version = ${version}
      `);
    });
  }

  async readBudgetReserved(policyId: string, version: number): Promise<string> {
    return run("read promotion budget", async () => {
      const result = await this.executor.execute(sql`
        SELECT budget_reserved FROM croco_promotion_policies
        WHERE policy_id = ${policyId} AND version = ${version}
      `);
      const row = result.rows[0];
      if (!row) throw new OfferPolicyNotFoundProblem(policyId, version);
      return String(row.budget_reserved);
    });
  }

  async countSubjectClaims(
    familyId: string,
    benefitCycleId: string,
    subject: OfferSubject,
    states: readonly OfferClaimState[],
  ): Promise<number> {
    return run("count promotion claims", async () => {
      const stateList = sql.join(
        [...states].map((state) => sql`${state}`),
        sql`, `,
      );
      const result = await this.executor.execute(sql`
        SELECT COUNT(*) AS total FROM croco_promotion_claims
        WHERE family_id = ${familyId}
          AND benefit_cycle_id = ${benefitCycleId}
          AND subject = ${JSON.stringify(subject)}::jsonb
          AND state IN (${stateList})
      `);
      return Number(result.rows[0]?.total ?? 0);
    });
  }

  async listClaims(filter: ListClaimsFilter): Promise<readonly OfferClaim[]> {
    return run("list promotion claims", () => listClaimsWith(this.executor, filter));
  }

  async recordAudit(entry: OfferAuditEntry): Promise<void> {
    await run("record promotion audit", () =>
      this.executor.execute(sql`
        INSERT INTO croco_promotion_audit (audit_id, target_kind, target_id, action, document)
        VALUES (${entry.auditId}, ${entry.targetKind}, ${entry.targetId}, ${entry.action}, ${JSON.stringify(entry)}::jsonb)
        ON CONFLICT (audit_id) DO NOTHING
      `),
    );
  }
}
