import { randomUUID } from "node:crypto";
import {
  assertRewardPolicy,
  assertRewardScope,
  InvalidRewardPolicyProblem,
  RewardConflictProblem,
  RewardStore,
  RewardUnavailableProblem,
} from "@croco/gamification-core";
import type {
  PublishedRewardPolicy,
  RewardAccount,
  RewardGrant,
  RewardKey,
  RewardPublication,
  RewardScope,
  RewardSelection,
} from "@croco/gamification-core";
import { Problem } from "@croco/problems-core";
import { eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  rewardBadges,
  rewardFamilies,
  rewardGrants,
  rewardPoints,
  rewardPublications,
} from "./rewardSchema";
import { RewardPersistenceProblem } from "./problems";

export type DrizzleRewardClient = NodePgDatabase;
const scopeKey = (scope: RewardScope) => [scope.appId, scope.environmentId, scope.tenantId];
const familyKey = (scope: RewardScope, policyId: string) =>
  JSON.stringify([...scopeKey(scope), policyId]);
const accountKey = (scope: RewardScope, subject: string) =>
  JSON.stringify([...scopeKey(scope), subject]);
const grantKey = (key: RewardKey) =>
  JSON.stringify([...scopeKey(key.scope), key.policyId, key.subject, key.evidenceRef]);
function required(value: string): void {
  if (typeof value !== "string" || !value.trim() || value.length > 200)
    throw new InvalidRewardPolicyProblem("Reward identifiers must be nonempty.");
}
function validateKey(key: RewardKey): void {
  assertRewardScope(key.scope);
  [key.policyId, key.policyVersion, key.subject, key.evidenceRef].forEach(required);
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

function assertSelection(
  publication: PublishedRewardPolicy,
  depleted: boolean,
  selection: RewardSelection,
): void {
  const policy = publication.policy;
  const bucket = selection.receipt.bucket;
  const weighted = !depleted && policy.mode === "weighted";
  if (
    weighted &&
    (!Number.isInteger(bucket) ||
      bucket === null ||
      bucket < 0 ||
      bucket >= policy.rewardEntries.length ||
      (policy.weights?.[bucket] ?? 0) <= 0)
  ) {
    throw new InvalidRewardPolicyProblem(
      "Selection must identify a published positive-weight bucket.",
    );
  }
  const expectedEntry = depleted
    ? policy.fallback.kind === "fixed"
      ? policy.fallback.entry
      : null
    : policy.rewardEntries[weighted && bucket !== null ? bucket : 0];
  const expected: RewardSelection = {
    entry: expectedEntry,
    receipt: {
      policyVersion: policy.version,
      revision: publication.revision,
      mode: policy.mode,
      weights: policy.weights ?? [],
      bucket: weighted ? bucket : null,
      fallback: depleted,
      fallbackPolicy: policy.fallback,
    },
  };
  if (canonical(selection) !== canonical(expected))
    throw new InvalidRewardPolicyProblem("Selection must match the published entry and receipt.");
}

export class DrizzleRewardStore extends RewardStore {
  constructor(private readonly db: DrizzleRewardClient) {
    super();
  }
  private async persist<T>(operation: string, action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (cause) {
      if (cause instanceof Problem) throw cause;
      throw new RewardPersistenceProblem(operation, cause instanceof Error ? cause : undefined);
    }
  }
  async publish(publication: RewardPublication): Promise<PublishedRewardPolicy> {
    assertRewardScope(publication.scope);
    assertRewardPolicy(publication.policy);
    [publication.actorId, publication.reason, publication.idempotencyKey].forEach(required);
    if (!Number.isSafeInteger(publication.expectedRevision) || publication.expectedRevision < 0)
      throw new InvalidRewardPolicyProblem("Expected revision must be a nonnegative safe integer.");
    const familyId = familyKey(publication.scope, publication.policy.id);
    const id = JSON.stringify([familyId, publication.idempotencyKey]);
    const fingerprint = canonical(publication);
    return this.persist("publish", () =>
      this.db.transaction(async (tx) => {
        await tx.insert(rewardFamilies).values({ id: familyId }).onConflictDoNothing();
        const [family] = await tx
          .select()
          .from(rewardFamilies)
          .where(eq(rewardFamilies.id, familyId))
          .for("update");
        if (!family) throw new RewardUnavailableProblem("Policy family is missing.");
        const publications = await tx
          .select()
          .from(rewardPublications)
          .where(eq(rewardPublications.familyId, familyId));
        const replay = publications.find((row) => row.id === id);
        if (replay) {
          if (replay.fingerprint !== fingerprint)
            throw new RewardConflictProblem(
              "Publication idempotency key was reused with different input.",
            );
          return replay.publication;
        }
        if (
          publications.some((row) => row.publication.policy.version === publication.policy.version)
        )
          throw new RewardConflictProblem("Published policy versions are immutable.");
        if ((family.publication?.revision ?? 0) !== publication.expectedRevision)
          throw new RewardConflictProblem("Publication revision is stale.");
        if (
          publication.policy.cap < family.consumed ||
          (publication.policy.fallback.kind === "fixed" &&
            publication.policy.fallback.cap < family.fallbackConsumed)
        )
          throw new RewardConflictProblem("Policy cap cannot be less than prior reservations.");
        const result = { ...publication, revision: publication.expectedRevision + 1 };
        await tx
          .insert(rewardPublications)
          .values({ id, familyId, fingerprint, publication: result });
        await tx
          .update(rewardFamilies)
          .set({ publication: result })
          .where(eq(rewardFamilies.id, familyId));
        return result;
      }),
    );
  }
  async getPolicy(scope: RewardScope, policyId: string): Promise<PublishedRewardPolicy | null> {
    assertRewardScope(scope);
    required(policyId);
    return this.persist("get-policy", async () => {
      const [family] = await this.db
        .select()
        .from(rewardFamilies)
        .where(eq(rewardFamilies.id, familyKey(scope, policyId)));
      return family?.publication ?? null;
    });
  }
  async reserve(
    key: RewardKey,
    select: (publication: PublishedRewardPolicy, depleted: boolean) => RewardSelection,
  ): Promise<RewardGrant> {
    validateKey(key);
    const familyId = familyKey(key.scope, key.policyId);
    const id = grantKey(key);
    return this.persist("reserve", () =>
      this.db.transaction(async (tx) => {
        const [family] = await tx
          .select()
          .from(rewardFamilies)
          .where(eq(rewardFamilies.id, familyId))
          .for("update");
        const [prior] = await tx.select().from(rewardGrants).where(eq(rewardGrants.id, id));
        if (prior) return prior.grant;
        const publication = family?.publication;
        if (!family || !publication)
          throw new RewardUnavailableProblem("Reward policy is not published.");
        if (publication.policy.version !== key.policyVersion)
          throw new RewardConflictProblem("Requested reward policy version is stale.");
        const time = await tx.execute<{ now: string }>(sql`select clock_timestamp()::text as now`);
        const now = new Date(time.rows[0]?.now ?? Number.NaN);
        if (!Number.isFinite(now.getTime()))
          throw new RewardUnavailableProblem("Database clock is unavailable.");
        if (
          now.getTime() < Date.parse(publication.policy.effectiveFrom) ||
          now.getTime() >= Date.parse(publication.policy.effectiveUntil)
        )
          throw new RewardUnavailableProblem("Reward policy is outside its effective window.");
        const depleted = family.consumed >= publication.policy.cap;
        let selection = select(publication, depleted);
        assertSelection(publication, depleted, selection);
        if (depleted) {
          const fallback = publication.policy.fallback;
          const available = fallback.kind === "fixed" && family.fallbackConsumed < fallback.cap;
          selection = {
            ...selection,
            entry: available ? fallback.entry : null,
            receipt: { ...selection.receipt, fallback: true },
          };
          if (available)
            await tx
              .update(rewardFamilies)
              .set({ fallbackConsumed: family.fallbackConsumed + 1 })
              .where(eq(rewardFamilies.id, familyId));
        } else {
          await tx
            .update(rewardFamilies)
            .set({ consumed: family.consumed + 1 })
            .where(eq(rewardFamilies.id, familyId));
        }
        const grant: RewardGrant = {
          ...key,
          id: randomUUID(),
          selection,
          state: "reserved",
          rejection: null,
          createdAt: now.toISOString(),
        };
        await tx
          .insert(rewardGrants)
          .values({ id, familyId, accountId: accountKey(key.scope, key.subject), grant });
        return grant;
      }),
    );
  }
  async settle(key: RewardKey): Promise<RewardGrant> {
    validateKey(key);
    const id = grantKey(key);
    return this.persist("settle", () =>
      this.db.transaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(rewardGrants)
          .where(eq(rewardGrants.id, id))
          .for("update");
        if (!row) throw new RewardUnavailableProblem("Reward reservation is missing.");
        if (row.grant.state !== "reserved") return row.grant;
        const entry = row.grant.selection.entry;
        let rejection: RewardGrant["rejection"] = entry ? null : "no-reward";
        if (entry?.kind === "points")
          await tx.insert(rewardPoints).values({
            grantId: id,
            accountId: row.accountId,
            entry: {
              grantId: row.grant.id,
              unit: entry.unit,
              amount: entry.amount,
              createdAt: row.grant.createdAt,
            },
          });
        if (entry?.kind === "badge") {
          const inserted = await tx
            .insert(rewardBadges)
            .values({
              id: JSON.stringify([row.accountId, entry.badgeId]),
              grantId: id,
              accountId: row.accountId,
              ownership: {
                badgeId: entry.badgeId,
                title: entry.title,
                grantId: row.grant.id,
                createdAt: row.grant.createdAt,
              },
            })
            .onConflictDoNothing()
            .returning();
          if (inserted.length === 0) rejection = "badge-owned";
        }
        const grant: RewardGrant = {
          ...row.grant,
          state: rejection ? "rejected" : "granted",
          rejection,
        };
        await tx.update(rewardGrants).set({ grant }).where(eq(rewardGrants.id, id));
        return grant;
      }),
    );
  }
  async getAccount(scope: RewardScope, subject: string): Promise<RewardAccount> {
    assertRewardScope(scope);
    required(subject);
    const id = accountKey(scope, subject);
    return this.persist("get-account", () =>
      this.db.transaction(
        async (tx) => {
          const points = await tx.select().from(rewardPoints).where(eq(rewardPoints.accountId, id));
          const badges = await tx.select().from(rewardBadges).where(eq(rewardBadges.accountId, id));
          const grants = await tx.select().from(rewardGrants).where(eq(rewardGrants.accountId, id));
          return {
            points: points.map((row) => row.entry),
            badges: badges.map((row) => row.ownership),
            grants: grants.map((row) => row.grant),
          };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      ),
    );
  }
}
