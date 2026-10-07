import { CancellationConflictProblem, stableStringify } from "@croco/billing-core";
import { sql } from "drizzle-orm";
import { atomic, read, write } from "./Persistence";
import type { BillingDatabase } from "./Persistence";
import type {
  CancellationScope,
  CancellationSession,
  CancellationStore,
  ChoicePolicy,
  ChoicePolicyAudit,
} from "@croco/billing-core";

type PolicyAuditRecord = { policy: ChoicePolicy; audit: ChoicePolicyAudit };

/** Scoped cancellation sessions and atomic policy/audit writes in PostgreSQL. */
export class DrizzleCancellationStore implements CancellationStore {
  constructor(private readonly db: BillingDatabase) {}

  async createSession(session: CancellationSession): Promise<void> {
    const scope = namespace(session);
    await atomic(this.db, scope, async (tx) => {
      if (
        session.revision !== 0 ||
        session.state !== "open" ||
        (await read(tx, "croco_cancellation_sessions", scope, session.id))
      )
        throw new CancellationConflictProblem();
      await write(tx, "croco_cancellation_sessions", scope, session.id, session);
    });
  }
  async getSession(scope: CancellationScope, id: string): Promise<CancellationSession | undefined> {
    return read(this.db, "croco_cancellation_sessions", namespace(scope), id);
  }
  async saveSession(session: CancellationSession, expectedRevision: number): Promise<boolean> {
    const scope = namespace(session);
    return atomic(this.db, scope, async (tx) => {
      const current = await read<CancellationSession>(
        tx,
        "croco_cancellation_sessions",
        scope,
        session.id,
      );
      if (
        !current ||
        current.revision !== expectedRevision ||
        session.revision !== expectedRevision + 1
      )
        return false;
      const immutable = (value: CancellationSession) => ({
        subject: value.subject,
        subscriptionRef: value.subscriptionRef,
        subscriptionRevision: value.subscriptionRevision,
        quoteRef: value.quoteRef,
        policyVersion: value.policyVersion,
        snapshot: value.snapshot,
        choices: value.choices,
        keepAvailable: value.keepAvailable,
        createdAt: value.createdAt,
      });
      if (
        stableStringify(immutable(current)) !== stableStringify(immutable(session)) ||
        (current.state === "decided" &&
          (session.state !== "decided" ||
            stableStringify(current.decision) !== stableStringify(session.decision))) ||
        (current.commandReceipt &&
          current.commandReceipt.commandId !== session.commandReceipt?.commandId) ||
        (current.displayedAt && current.displayedAt !== session.displayedAt) ||
        stableStringify(current.evidence) !==
          stableStringify(session.evidence.slice(0, current.evidence.length))
      )
        throw new CancellationConflictProblem();
      await write(tx, "croco_cancellation_sessions", scope, session.id, session);
      return true;
    });
  }
  async getPolicy(scope: CancellationScope): Promise<ChoicePolicy | undefined> {
    return read(this.db, "croco_cancellation_policies", namespace(scope), "policy");
  }
  async savePolicy(policy: ChoicePolicy, audit: ChoicePolicyAudit): Promise<ChoicePolicy> {
    const scope = namespace(policy);
    return atomic(this.db, scope, async (tx) => {
      const existing = await read<PolicyAuditRecord>(
        tx,
        "croco_cancellation_policy_audits",
        scope,
        audit.idempotencyKey,
      );
      if (existing) {
        if (
          stableStringify(existing.policy) !== stableStringify(policy) ||
          existing.audit.actor !== audit.actor ||
          existing.audit.reason !== audit.reason ||
          existing.audit.expectedRevision !== audit.expectedRevision
        )
          throw new CancellationConflictProblem();
        return existing.policy;
      }
      const current = await read<ChoicePolicy>(tx, "croco_cancellation_policies", scope, "policy");
      if (
        (current?.version ?? 0) !== audit.expectedRevision ||
        policy.version !== audit.expectedRevision + 1
      )
        throw new CancellationConflictProblem();
      await write(tx, "croco_cancellation_policies", scope, "policy", policy);
      await write(tx, "croco_cancellation_policy_audits", scope, audit.idempotencyKey, {
        policy,
        audit,
      });
      return policy;
    });
  }
  async listSessions(scope: CancellationScope): Promise<readonly CancellationSession[]> {
    const result = await this.db.execute<{ data: CancellationSession }>(
      sql`select data from croco_cancellation_sessions where namespace = ${namespace(scope)} order by data->>'createdAt', id`,
    );
    return result.rows.map((row) => row.data);
  }
}
function namespace(scope: CancellationScope): string {
  return JSON.stringify([scope.appId, scope.environment, scope.tenantId]);
}
