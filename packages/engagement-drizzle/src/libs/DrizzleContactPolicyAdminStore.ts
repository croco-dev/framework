import {
  ContactPolicyConflictProblem,
  ContactPolicyInvalidProblem,
  EngagementPersistenceProblem,
  assertContactPolicyScope,
  validateContactPolicyConfig,
  type ContactPolicyConfig,
  type ContactPolicyDecision,
  type ContactPolicyScope,
  type ContactPolicyTopic,
} from "@croco/engagement-core";
import { Problem } from "@croco/problems-core";
import { and, desc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  engagementContactPolicyAudit,
  engagementContactPolicySettings,
  engagementDispatches,
} from "./schema";

export type ContactPolicySettingsTarget = Readonly<{ scope: ContactPolicyScope; subject: string }>;
export type ContactPolicySettingsSnapshot = Readonly<{
  revision: number;
  config: ContactPolicyConfig;
  topics: readonly ContactPolicyTopic[];
}>;
export type SaveContactPolicySettings = Readonly<{
  target: ContactPolicySettingsTarget;
  policy: ContactPolicySettingsSnapshot;
  edit: Readonly<{
    limits: Readonly<Record<string, number>>;
    quietHours?: ContactPolicyConfig["quietHours"] | null;
    priorities: Readonly<Record<string, number>>;
    expectedRevision: number;
    reason: string;
    idempotencyKey: string;
  }>;
  expectedRevision: number;
  actorId: string;
  reason: string;
  idempotencyKey: string;
}>;
const settingsSchema = {
  engagementContactPolicyAudit,
  engagementContactPolicySettings,
};
export type DrizzleContactPolicyAdminClient = NodePgDatabase<typeof settingsSchema>;

/** Durable settings and edit audit, structurally compatible with the administrative contract. */
export class DrizzleContactPolicyAdminStore {
  constructor(private readonly db: DrizzleContactPolicyAdminClient) {}

  async load(target: ContactPolicySettingsTarget) {
    key(target);
    return this.persist(target, async () => {
      const policy = await this.loadPolicy(target.scope);
      if (policy === undefined) return undefined;
      const dispatches = await this.db
        .select()
        .from(engagementDispatches)
        .where(
          and(
            eq(engagementDispatches.tenantId, target.scope.tenantId),
            eq(engagementDispatches.recipientId, target.subject),
            sql`${engagementDispatches.outcome} ->> 'kind' = 'suppressed'`,
            sql`${engagementDispatches.outcome} -> 'contactPolicy' ->> 'app' = ${target.scope.app}`,
            sql`${engagementDispatches.outcome} -> 'contactPolicy' ->> 'environment' = ${target.scope.environment}`,
          ),
        )
        .orderBy(desc(engagementDispatches.updatedAt), desc(engagementDispatches.id))
        .limit(101);
      const recentSuppressions = dispatches.slice(0, 100).map((dispatch) => {
        const evidence =
          dispatch.outcome.kind === "suppressed" ? dispatch.outcome.contactPolicy : undefined;
        if (!evidence || !isReason(evidence.reason))
          throw new ContactPolicyInvalidProblem("Stored contact policy decision is invalid");
        return {
          logicalSendId: JSON.stringify([
            dispatch.messageId,
            dispatch.semanticKey,
            dispatch.channel,
          ]),
          ...(evidence.campaignId === undefined ? {} : { campaignId: evidence.campaignId }),
          occurredAt: dispatch.updatedAt,
          decision: {
            allowed: false,
            reason: evidence.reason,
            blockingRuleId: evidence.blockingRuleId,
            ...(evidence.blockingCampaignIds === undefined
              ? {}
              : { blockingCampaignIds: [...evidence.blockingCampaignIds] }),
            ...(evidence.nextEligibleAt === undefined
              ? {}
              : { nextEligibleAt: new Date(evidence.nextEligibleAt) }),
          },
        };
      });
      return {
        policy,
        recentSuppressions,
        historyComplete: dispatches.length <= 100,
      };
    });
  }

  async loadPolicy(scope: ContactPolicyScope): Promise<ContactPolicySettingsSnapshot | undefined> {
    assertContactPolicyScope(scope);
    const scopeKey = JSON.stringify([scope.app, scope.environment, scope.tenantId]);
    return this.persist({ scope, subject: "" }, async () => {
      const [row] = await this.db
        .select()
        .from(engagementContactPolicySettings)
        .where(eq(engagementContactPolicySettings.scopeKey, scopeKey));
      return row === undefined
        ? undefined
        : { revision: row.revision, config: row.config, topics: row.topics };
    });
  }

  async save(input: SaveContactPolicySettings): Promise<ContactPolicySettingsSnapshot> {
    const scopeKey = key(input.target);
    validateContactPolicyConfig(input.policy.config);
    if (
      !Number.isSafeInteger(input.expectedRevision) ||
      input.expectedRevision < 0 ||
      input.policy.revision !== input.expectedRevision + 1 ||
      !input.actorId.trim() ||
      !input.reason.trim() ||
      !input.idempotencyKey.trim()
    ) {
      throw new ContactPolicyInvalidProblem(
        "Policy edits require the next revision, actor, reason and idempotency key",
      );
    }
    const fingerprint = JSON.stringify(
      canonical({
        edit: input.edit,
        expectedRevision: input.expectedRevision,
        actorId: input.actorId,
        reason: input.reason,
      }),
    );
    return this.persist(input.target, () =>
      this.db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${"contact-policy-settings:" + scopeKey}, 0))`,
        );
        const [priorEdit] = await tx
          .select()
          .from(engagementContactPolicyAudit)
          .where(
            and(
              eq(engagementContactPolicyAudit.scopeKey, scopeKey),
              eq(engagementContactPolicyAudit.idempotencyKey, input.idempotencyKey),
            ),
          );
        if (priorEdit !== undefined) {
          if (priorEdit.fingerprint !== fingerprint)
            throw new ContactPolicyConflictProblem(
              "Policy edit idempotency key has a different payload",
            );
          return priorEdit.policy;
        }
        const [current] = await tx
          .select()
          .from(engagementContactPolicySettings)
          .where(and(eq(engagementContactPolicySettings.scopeKey, scopeKey)));
        if ((current?.revision ?? 0) !== input.expectedRevision)
          throw new ContactPolicyConflictProblem("Policy revision changed");
        const values = {
          revision: input.policy.revision,
          config: input.policy.config,
          topics: [...input.policy.topics],
        };
        await tx
          .insert(engagementContactPolicySettings)
          .values({ scopeKey, ...values })
          .onConflictDoUpdate({
            target: [engagementContactPolicySettings.scopeKey],
            set: values,
          });
        await tx.insert(engagementContactPolicyAudit).values({
          scopeKey,
          idempotencyKey: input.idempotencyKey,
          fingerprint,
          policy: input.policy,
          actorId: input.actorId,
          reason: input.reason,
          recordedAt: new Date(),
        });
        return structuredClone(input.policy);
      }),
    );
  }

  private async persist<T>(
    target: ContactPolicySettingsTarget,
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Problem) throw error;
      throw new EngagementPersistenceProblem(
        "contact-policy-settings",
        target.scope.tenantId,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }
}

function key(target: ContactPolicySettingsTarget): string {
  assertContactPolicyScope(target.scope);
  if (!target.subject.trim())
    throw new ContactPolicyInvalidProblem("Policy settings require a subject");
  return JSON.stringify([target.scope.app, target.scope.environment, target.scope.tenantId]);
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === "object" && value !== null)
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([name, item]) => [name, canonical(item)]),
    );
  return value;
}

function isReason(reason: string): reason is ContactPolicyDecision["reason"] {
  return ["allowed", "limit", "spacing", "quiet-hours", "released", "unknown"].includes(reason);
}
