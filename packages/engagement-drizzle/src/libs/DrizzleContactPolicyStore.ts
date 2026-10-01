import {
  ContactPolicyInvalidProblem,
  EngagementPersistenceProblem,
  type ContactPolicyReservation,
  type ContactPolicyScope,
  type ContactPolicyStore,
  type ContactPolicyTransaction,
} from "@croco/engagement-core";
import { Problem } from "@croco/problems-core";
import { and, asc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { engagementContactPolicyBuckets, engagementContactPolicyReservations } from "./schema";

const contactPolicySchema = { engagementContactPolicyBuckets, engagementContactPolicyReservations };
export type DrizzleContactPolicyClient = NodePgDatabase<typeof contactPolicySchema>;

/** Serializes budget evaluation and ledger updates across PostgreSQL connections. */
export class DrizzleContactPolicyStore implements ContactPolicyStore {
  constructor(private readonly db: DrizzleContactPolicyClient) {}

  async read(
    scope: ContactPolicyScope,
    subject: string,
  ): Promise<readonly ContactPolicyReservation[]> {
    const scopeKey = contactPolicyScopeKey(scope, subject);
    return persist("read-contact-policy", scope, async () => {
      const rows = await this.db
        .select()
        .from(engagementContactPolicyReservations)
        .where(
          and(
            eq(engagementContactPolicyReservations.scopeKey, scopeKey),
            eq(engagementContactPolicyReservations.subject, subject),
          ),
        )
        .orderBy(
          asc(engagementContactPolicyReservations.createdAt),
          asc(engagementContactPolicyReservations.logicalSendId),
        );
      return rows.map((row) => mapReservation(scope, row));
    });
  }

  async transact<T>(
    scope: ContactPolicyScope,
    subject: string,
    operation: (transaction: ContactPolicyTransaction) => Promise<T>,
  ): Promise<T> {
    const scopeKey = contactPolicyScopeKey(scope, subject);
    return persist("transact-contact-policy", scope, () =>
      this.db.transaction(async (tx) => {
        await tx
          .insert(engagementContactPolicyBuckets)
          .values({ scopeKey, subject })
          .onConflictDoNothing();
        await tx
          .select()
          .from(engagementContactPolicyBuckets)
          .where(
            and(
              eq(engagementContactPolicyBuckets.scopeKey, scopeKey),
              eq(engagementContactPolicyBuckets.subject, subject),
            ),
          )
          .for("update");
        const rows = await tx
          .select()
          .from(engagementContactPolicyReservations)
          .where(
            and(
              eq(engagementContactPolicyReservations.scopeKey, scopeKey),
              eq(engagementContactPolicyReservations.subject, subject),
            ),
          )
          .orderBy(
            asc(engagementContactPolicyReservations.createdAt),
            asc(engagementContactPolicyReservations.logicalSendId),
          );
        const pending = new Map<string, ContactPolicyReservation>();
        const result = await operation({
          reservations: rows.map((row) => mapReservation(scope, row)),
          save: (reservation) => {
            if (
              contactPolicyScopeKey(reservation.scope, reservation.subject) !== scopeKey ||
              reservation.subject !== subject
            ) {
              throw new ContactPolicyInvalidProblem(
                "Reservation does not belong to the locked contact policy subject",
              );
            }
            pending.set(reservation.logicalSendId, structuredClone(reservation));
          },
        });
        for (const reservation of pending.values()) {
          const { scope: _scope, ...value } = reservation;
          await tx
            .insert(engagementContactPolicyReservations)
            .values({ ...value, scopeKey, executionIds: [...value.executionIds] })
            .onConflictDoUpdate({
              target: [
                engagementContactPolicyReservations.scopeKey,
                engagementContactPolicyReservations.subject,
                engagementContactPolicyReservations.logicalSendId,
              ],
              set: { ...value, executionIds: [...value.executionIds] },
            });
        }
        return result;
      }),
    );
  }
}

function contactPolicyScopeKey(scope: ContactPolicyScope, subject: string): string {
  if (
    [scope.app, scope.environment, scope.tenantId, subject].some(
      (value) => typeof value !== "string" || value.trim().length === 0,
    )
  ) {
    throw new ContactPolicyInvalidProblem(
      "Contact policy persistence requires app, environment, tenant and subject",
    );
  }
  return JSON.stringify([scope.app, scope.environment, scope.tenantId]);
}

function mapReservation(
  scope: ContactPolicyScope,
  row: typeof engagementContactPolicyReservations.$inferSelect,
): ContactPolicyReservation {
  const { scopeKey: _scopeKey, campaignId, reconciliation, ...reservation } = row;
  return {
    ...reservation,
    ...(campaignId === null ? {} : { campaignId }),
    ...(reconciliation === null ? {} : { reconciliation }),
    scope: { ...scope },
  };
}

async function persist<T>(
  operation: string,
  scope: ContactPolicyScope,
  action: () => Promise<T>,
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof Problem) throw error;
    throw new EngagementPersistenceProblem(
      operation,
      scope.tenantId,
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}
