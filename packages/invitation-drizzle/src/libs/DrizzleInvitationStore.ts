import { Component, Inject, Token } from "@croco/framework-context";
import {
  DuplicateInvitationProblem,
  type EmailInvitationCreation,
  type EmailInvitationCreationInput,
  type Invitation,
  type InvitationCreationPhaseStatus,
  InvitationIdempotencyConflictProblem,
  type InvitationStatus,
  type InvitationStatusTransitionMeta,
  InvitationRateLimitUnavailableProblem,
  InvitationStore,
  type RateLimitConfig,
} from "@croco/invitation-core";
// Runtime value required for constructor metadata.
// oxlint-disable-next-line typescript/consistent-type-imports
import type { TxManager } from "@croco/tx-core";
import type { DrizzleDb } from "@croco/tx-drizzle";
import { and, count, desc, eq, gt, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  INVITATION_TOKEN_CIPHER,
  type InvitationTokenCipher,
  InvitationTokenCipherProblem,
} from "./InvitationTokenCipher";
import { invitationEmailCreationIntents, invitations } from "./schema";

type DrizzleInvitationClient = DrizzleDb & NodePgDatabase<Record<string, never>>;

const DATABASE_MILLISECONDS = sql`(extract(epoch from clock_timestamp()) * 1000)::double precision`;

interface InvitationRow {
  id: string;
  tenantId: string;
  inviterId: string;
  email: string | null;
  tokenHash: string;
  type: "email" | "link";
  role: "owner" | "admin" | "member" | "viewer";
  status: "creating" | "pending" | "accepted" | "expired" | "revoked" | "declined";
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

interface EmailInvitationCreationRow {
  invitationId: string;
  tenantId: string;
  idempotencyKey: string;
  requestFingerprint: string;
  tokenCiphertext: string;
  notificationIdempotencyKey: string;
  notificationStatus: InvitationCreationPhaseStatus;
  notificationClaimId: string | null;
  notificationClaimExpiresAt: Date | null;
  eventStatus: InvitationCreationPhaseStatus;
  eventClaimId: string | null;
  eventClaimExpiresAt: Date | null;
  eventId: string;
  eventOccurredAt: Date;
  createdAt: Date;
}

/**
 * 초대 저장소용 Drizzle 클라이언트 주입 토큰입니다.
 */
export const DRIZZLE_INVITATION_TOKEN = new Token<DrizzleInvitationClient>(
  "DRIZZLE_INVITATION_TOKEN",
);

/**
 * 초대 저장소에서 사용하는 Drizzle 클라이언트 타입입니다.
 */
export type { DrizzleInvitationClient };

/**
 * 초대 엔터티를 Drizzle로 저장하고 조회하는 구현체입니다.
 */
@Component()
export class DrizzleInvitationStore extends InvitationStore {
  private readonly tokenCipher: InvitationTokenCipher;

  /**
   * Drizzle 클라이언트와 트랜잭션 매니저를 받아 저장소를 초기화합니다.
   */
  constructor(
    @Inject(DRIZZLE_INVITATION_TOKEN) private readonly db: DrizzleInvitationClient,
    private readonly txManager: TxManager<DrizzleInvitationClient>,
    @Inject(INVITATION_TOKEN_CIPHER) tokenCipher?: InvitationTokenCipher,
  ) {
    super();
    this.tokenCipher =
      tokenCipher ??
      ({
        encrypt(): never {
          throw new InvitationTokenCipherProblem("configure", "missing");
        },
        decrypt(): never {
          throw new InvitationTokenCipherProblem("configure", "missing");
        },
      } satisfies InvitationTokenCipher);
  }

  override async currentTime(): Promise<Date> {
    return this.readDatabaseTime(this.txManager.getClient() ?? this.db);
  }

  /**
   * 초대 ID로 초대를 조회합니다.
   */
  async findById(id: string): Promise<Invitation | null> {
    const client = this.txManager.getClient() ?? this.db;

    const result = (await client
      .select()
      .from(invitations)
      .where(eq(invitations.id, id))
      .limit(1)) as InvitationRow[];
    if (result.length === 0) {
      return null;
    }

    return this.mapToInvitation(result[0]);
  }

  /**
   * 토큰 해시로 초대를 조회합니다.
   */
  async findByTokenHash(tokenHash: string): Promise<Invitation | null> {
    const client = this.txManager.getClient() ?? this.db;

    const result = (await client
      .select()
      .from(invitations)
      .where(eq(invitations.tokenHash, tokenHash))
      .limit(1)) as InvitationRow[];
    if (result.length === 0) {
      return null;
    }

    return this.mapToInvitation(result[0]);
  }

  /**
   * 테넌트와 이메일 조합으로 초대를 조회합니다.
   */
  async findByTenantAndEmail(tenantId: string, email: string): Promise<Invitation | null> {
    const client = this.txManager.getClient() ?? this.db;

    const result = (await client
      .select()
      .from(invitations)
      .where(and(eq(invitations.tenantId, tenantId), eq(invitations.email, email)))
      .orderBy(
        desc(
          sql<number>`case when ${invitations.status} = 'pending' and ${invitations.expiresAt} > statement_timestamp() at time zone 'UTC' then 1 else 0 end`,
        ),
        desc(invitations.createdAt),
        desc(invitations.id),
      )
      .limit(1)) as InvitationRow[];

    if (result.length === 0) {
      return null;
    }

    return this.mapToInvitation(result[0]);
  }

  /**
   * 테넌트의 모든 초대를 조회합니다.
   */
  async findAllByTenant(tenantId: string): Promise<Invitation[]> {
    const client = this.txManager.getClient() ?? this.db;

    const result = (await client
      .select()
      .from(invitations)
      .where(eq(invitations.tenantId, tenantId))) as InvitationRow[];
    return result.map((row) => this.mapToInvitation(row));
  }

  /**
   * 초대를 upsert 방식으로 저장합니다.
   */
  async save(invitation: Invitation): Promise<Invitation> {
    const client = this.txManager.getClient() ?? this.db;

    const result = (await client
      .insert(invitations)
      .values({
        id: invitation.id,
        tenantId: invitation.tenantId,
        inviterId: invitation.inviterId,
        email: invitation.email,
        tokenHash: invitation.tokenHash,
        type: invitation.type,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        acceptedAt: invitation.acceptedAt,
        revokedAt: invitation.revokedAt,
        createdAt: invitation.createdAt,
      })
      .onConflictDoUpdate({
        target: [invitations.id],
        set: {
          tenantId: invitation.tenantId,
          inviterId: invitation.inviterId,
          email: invitation.email,
          tokenHash: invitation.tokenHash,
          type: invitation.type,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
          acceptedAt: invitation.acceptedAt,
          revokedAt: invitation.revokedAt,
          createdAt: invitation.createdAt,
        },
      })
      .returning()) as InvitationRow[];

    return this.mapToInvitation(result[0]);
  }

  async createEmailInvitation(
    input: EmailInvitationCreationInput,
  ): Promise<EmailInvitationCreation> {
    return this.txManager.run(() =>
      this.persistCreation(this.txManager.getClient() ?? this.db, input),
    );
  }

  override async createRateLimitedInvitation(
    input: EmailInvitationCreationInput,
    config: RateLimitConfig,
    expiresInDays: number,
  ): Promise<EmailInvitationCreation> {
    InvitationStore.assertRateLimitConfig(config);
    if (this.txManager.isInTransaction()) {
      throw new InvitationRateLimitUnavailableProblem("read-committed-transaction-required");
    }
    const { tenantId } = input.invitation;
    const outcome = await this.txManager.runWithOutcome(
      async () => {
        const client = this.txManager.getClient();
        if (!client || !("rollback" in client) || typeof client.rollback !== "function") {
          throw new InvitationRateLimitUnavailableProblem("read-committed-transaction-required");
        }
        // Waiting and counting are separate statements so the count sees the preceding commit.
        const lockScope = `croco:invitation-issuance:${tenantId}`;
        await client.execute(sql`select pg_advisory_xact_lock(hashtextextended(${lockScope}, 0))`);
        const { rows } = await client.execute<{ isolation: string; milliseconds: number }>(sql`
          select current_setting('transaction_isolation') as isolation,
            ${DATABASE_MILLISECONDS} as milliseconds
        `);
        const state = rows[0];
        if (state?.isolation !== "read committed") {
          throw new InvitationRateLimitUnavailableProblem("read-committed-transaction-required");
        }
        const issuedAt = this.databaseTime(state.milliseconds);
        return this.persistCreation(
          client,
          InvitationStore.dateCreation(input, issuedAt, expiresInDays),
          config,
        );
      },
      { options: { isolationLevel: "read committed" } },
    );
    return outcome.value;
  }

  private async persistCreation(
    client: DrizzleInvitationClient,
    input: EmailInvitationCreationInput,
    rateLimit?: RateLimitConfig,
  ): Promise<EmailInvitationCreation> {
    const { tenantId, email } = input.invitation;
    const existing = await this.findEmailInvitationCreationWithClient(
      client,
      tenantId,
      input.idempotencyKey,
      undefined,
      rateLimit === undefined ? undefined : input.createdAt,
    );

    const now =
      existing && !rateLimit
        ? (await this.readDatabaseTime(client)).getTime()
        : input.createdAt.getTime();
    const live = existing && existing.invitation.expiresAt.getTime() > now;
    if (existing && (live || !rateLimit)) {
      this.assertCreationFingerprint(existing, input);
      if (live) {
        return existing;
      }
    }

    if (rateLimit) {
      await InvitationStore.checkIssuanceRateLimit(this, tenantId, rateLimit, now);
      if (email !== null) {
        const duplicates = await client
          .select({ id: invitations.id })
          .from(invitations)
          .where(
            and(
              eq(invitations.tenantId, tenantId),
              eq(invitations.email, email),
              eq(invitations.status, "pending"),
              gt(invitations.expiresAt, input.createdAt),
            ),
          )
          .limit(1);
        if (duplicates.length !== 0) {
          throw new DuplicateInvitationProblem(tenantId, email);
        }
      }
      await this.deleteExpiredCreations(client, input.createdAt, tenantId);
    } else if (existing) {
      await client
        .update(invitations)
        .set({ status: "expired" })
        .where(
          and(
            eq(invitations.id, existing.invitation.id),
            eq(invitations.tenantId, existing.invitation.tenantId),
            inArray(invitations.status, ["creating", "pending"]),
          ),
        );
      await client
        .delete(invitationEmailCreationIntents)
        .where(
          and(
            eq(invitationEmailCreationIntents.tenantId, input.invitation.tenantId),
            eq(invitationEmailCreationIntents.idempotencyKey, input.idempotencyKey),
            eq(invitationEmailCreationIntents.invitationId, existing.invitation.id),
          ),
        );
    }

    const inserted = (await client
      .insert(invitationEmailCreationIntents)
      .values({
        invitationId: input.invitation.id,
        tenantId: input.invitation.tenantId,
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: input.requestFingerprint,
        tokenCiphertext: this.tokenCipher.encrypt(input.token, {
          tenantId: input.invitation.tenantId,
          invitationId: input.invitation.id,
          idempotencyKey: input.idempotencyKey,
        }),
        notificationIdempotencyKey: input.notificationIdempotencyKey,
        notificationStatus: input.notificationStatus,
        notificationClaimId: input.notificationClaimId,
        notificationClaimExpiresAt: input.notificationClaimExpiresAt,
        eventStatus: input.eventStatus,
        eventClaimId: input.eventClaimId,
        eventClaimExpiresAt: input.eventClaimExpiresAt,
        eventId: input.eventId,
        eventOccurredAt: input.eventOccurredAt,
        createdAt: input.createdAt,
      })
      .onConflictDoNothing({
        target: [
          invitationEmailCreationIntents.tenantId,
          invitationEmailCreationIntents.idempotencyKey,
        ],
      })
      .returning()) as EmailInvitationCreationRow[];

    if (inserted.length === 0) {
      const concurrent = await this.findEmailInvitationCreationWithClient(
        client,
        input.invitation.tenantId,
        input.idempotencyKey,
      );
      if (!concurrent) {
        throw new InvitationIdempotencyConflictProblem(input.idempotencyKey);
      }
      this.assertCreationFingerprint(concurrent, input);
      return concurrent;
    }

    await this.save(input.invitation);
    return this.mapToEmailInvitationCreation(inserted[0], input.invitation);
  }

  async claimEmailInvitationNotification(
    tenantId: string,
    idempotencyKey: string,
    claimId: string,
    claimExpiresAt: Date,
    expectedInvitationId?: string,
  ): Promise<EmailInvitationCreation | null> {
    return this.claimEmailInvitationCreationPhase(
      tenantId,
      idempotencyKey,
      "notificationStatus",
      "notificationClaimId",
      "notificationClaimExpiresAt",
      claimId,
      claimExpiresAt,
      expectedInvitationId,
    );
  }

  async claimEmailInvitationEvent(
    tenantId: string,
    idempotencyKey: string,
    claimId: string,
    claimExpiresAt: Date,
    expectedInvitationId?: string,
  ): Promise<EmailInvitationCreation | null> {
    return this.claimEmailInvitationCreationPhase(
      tenantId,
      idempotencyKey,
      "eventStatus",
      "eventClaimId",
      "eventClaimExpiresAt",
      claimId,
      claimExpiresAt,
      expectedInvitationId,
    );
  }

  async completeEmailInvitationNotification(
    tenantId: string,
    idempotencyKey: string,
    claimId: string,
  ): Promise<EmailInvitationCreation | null> {
    return this.completeEmailInvitationCreationPhase(
      tenantId,
      idempotencyKey,
      "notificationStatus",
      "notificationClaimId",
      "notificationClaimExpiresAt",
      claimId,
    );
  }

  async completeEmailInvitationEvent(
    tenantId: string,
    idempotencyKey: string,
    claimId: string,
  ): Promise<EmailInvitationCreation | null> {
    return this.completeEmailInvitationCreationPhase(
      tenantId,
      idempotencyKey,
      "eventStatus",
      "eventClaimId",
      "eventClaimExpiresAt",
      claimId,
    );
  }

  async releaseEmailInvitationNotification(
    tenantId: string,
    idempotencyKey: string,
    claimId: string,
  ): Promise<void> {
    await this.releaseEmailInvitationCreationPhase(
      tenantId,
      idempotencyKey,
      "notificationStatus",
      "notificationClaimId",
      "notificationClaimExpiresAt",
      claimId,
    );
  }

  async releaseEmailInvitationEvent(
    tenantId: string,
    idempotencyKey: string,
    claimId: string,
  ): Promise<void> {
    await this.releaseEmailInvitationCreationPhase(
      tenantId,
      idempotencyKey,
      "eventStatus",
      "eventClaimId",
      "eventClaimExpiresAt",
      claimId,
    );
  }

  async activateEmailInvitation(
    tenantId: string,
    idempotencyKey: string,
    expectedInvitationId?: string,
  ): Promise<EmailInvitationCreation | null> {
    return this.txManager.run(async () => {
      const client = this.txManager.getClient() ?? this.db;
      const creation = await this.findEmailInvitationCreationWithClient(
        client,
        tenantId,
        idempotencyKey,
        expectedInvitationId,
      );
      if (
        !creation ||
        creation.notificationStatus !== "completed" ||
        creation.eventStatus !== "completed"
      ) {
        return creation;
      }

      await client
        .update(invitations)
        .set({ status: "pending" })
        .where(
          and(
            eq(invitations.id, creation.invitation.id),
            eq(invitations.tenantId, tenantId),
            eq(invitations.status, "creating"),
          ),
        );
      return this.findEmailInvitationCreationWithClient(
        client,
        tenantId,
        idempotencyKey,
        expectedInvitationId,
      );
    });
  }

  async deleteExpiredEmailInvitationCreations(now: Date): Promise<number> {
    return this.txManager.run(() =>
      this.deleteExpiredCreations(this.txManager.getClient() ?? this.db, now),
    );
  }

  private async deleteExpiredCreations(
    client: DrizzleInvitationClient,
    cutoff: Date,
    tenantId?: string,
  ): Promise<number> {
    const expiredInvitationIds = client
      .select({ id: invitations.id })
      .from(invitations)
      .where(
        and(
          lte(invitations.expiresAt, cutoff),
          tenantId === undefined ? undefined : eq(invitations.tenantId, tenantId),
        ),
      );
    await client
      .update(invitations)
      .set({ status: "expired" })
      .where(
        and(
          inArray(invitations.id, expiredInvitationIds),
          inArray(invitations.status, ["creating", "pending"]),
        ),
      );
    const deleted = await client
      .delete(invitationEmailCreationIntents)
      .where(inArray(invitationEmailCreationIntents.invitationId, expiredInvitationIds))
      .returning({ invitationId: invitationEmailCreationIntents.invitationId });
    return deleted.length;
  }

  async findEmailInvitationCreation(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<EmailInvitationCreation | null> {
    const client = this.txManager.getClient() ?? this.db;
    return this.findEmailInvitationCreationWithClient(client, tenantId, idempotencyKey);
  }

  /**
   * 초대 상태를 변경하고 변경된 초대를 반환합니다.
   */
  async updateStatus(
    tenantId: string,
    id: string,
    status: InvitationStatus,
  ): Promise<Invitation | null> {
    const client = this.txManager.getClient() ?? this.db;
    const whereClause =
      status === "accepted"
        ? and(
            eq(invitations.tenantId, tenantId),
            eq(invitations.id, id),
            eq(invitations.status, "pending"),
          )
        : and(eq(invitations.tenantId, tenantId), eq(invitations.id, id));

    const result = (await client
      .update(invitations)
      .set({ status })
      .where(whereClause)
      .returning()) as InvitationRow[];

    if (result.length === 0) {
      return null;
    }

    return this.mapToInvitation(result[0]);
  }

  async compareAndSetStatus(
    tenantId: string,
    id: string,
    expected: InvitationStatus,
    desired: InvitationStatus,
    meta: InvitationStatusTransitionMeta = {},
  ): Promise<Invitation | null> {
    if (desired !== "accepted") {
      const revokedAt = desired === "revoked" ? (meta.revokedAt ?? new Date()) : meta.revokedAt;
      const client = this.txManager.getClient() ?? this.db;
      const result = (await client
        .update(invitations)
        .set({
          status: desired,
          acceptedAt: meta.acceptedAt,
          revokedAt,
        })
        .where(
          and(
            eq(invitations.tenantId, tenantId),
            eq(invitations.id, id),
            eq(invitations.status, expected),
          ),
        )
        .returning()) as InvitationRow[];

      if (result.length === 0) {
        return null;
      }

      return this.mapToInvitation(result[0]);
    }

    return this.txManager.run(async () => {
      const client = this.txManager.getClient() ?? this.db;
      const locked = await client
        .select({ id: invitations.id })
        .from(invitations)
        .where(
          and(
            eq(invitations.tenantId, tenantId),
            eq(invitations.id, id),
            eq(invitations.status, expected),
          ),
        )
        .for("update");
      if (locked.length === 0) {
        return null;
      }

      const databaseAcceptedAt = sql<Date>`statement_timestamp() AT TIME ZONE 'UTC'`;
      const acceptedAt = meta.acceptedAt
        ? sql<Date>`greatest(${meta.acceptedAt.toISOString()}::timestamptz AT TIME ZONE 'UTC', ${databaseAcceptedAt})`
        : databaseAcceptedAt;
      const result = (await client
        .update(invitations)
        .set({
          status: desired,
          acceptedAt,
        })
        .where(
          and(
            eq(invitations.tenantId, tenantId),
            eq(invitations.id, id),
            eq(invitations.status, expected),
            gt(invitations.expiresAt, acceptedAt),
          ),
        )
        .returning()) as InvitationRow[];

      if (result.length === 0) {
        return null;
      }

      return this.mapToInvitation(result[0]);
    });
  }

  /**
   * 일정 시점 이후 생성된 모든 상태의 초대 수를 반환합니다.
   */
  async countIssuedByTenant(tenantId: string, since: Date): Promise<number> {
    const client = this.txManager.getClient() ?? this.db;

    const result = (await client
      .select({ total: count() })
      .from(invitations)
      .where(and(eq(invitations.tenantId, tenantId), gte(invitations.createdAt, since)))) as {
      total: number;
    }[];

    return Number(result[0].total);
  }

  /**
   * 일정 시점 이후 생성된 대기 중 초대 수를 반환합니다.
   */
  async countPendingByTenant(tenantId: string, since: Date): Promise<number> {
    const client = this.txManager.getClient() ?? this.db;

    const result = (await client
      .select({ total: count() })
      .from(invitations)
      .where(
        and(
          eq(invitations.tenantId, tenantId),
          eq(invitations.status, "pending"),
          gte(invitations.createdAt, since),
        ),
      )) as { total: number }[];

    return Number(result[0]?.total ?? 0);
  }

  private mapToInvitation(row: InvitationRow): Invitation {
    return {
      id: row.id,
      tenantId: row.tenantId,
      inviterId: row.inviterId,
      email: row.email,
      tokenHash: row.tokenHash,
      type: row.type,
      role: row.role,
      status: row.status,
      expiresAt: row.expiresAt,
      acceptedAt: row.acceptedAt,
      revokedAt: row.revokedAt,
      createdAt: row.createdAt,
    };
  }

  private async findEmailInvitationCreationWithClient(
    client: DrizzleInvitationClient,
    tenantId: string,
    idempotencyKey: string,
    expectedInvitationId?: string,
    expiresAfter?: Date,
  ): Promise<EmailInvitationCreation | null> {
    const rows = (await client
      .select()
      .from(invitationEmailCreationIntents)
      .where(
        and(
          eq(invitationEmailCreationIntents.tenantId, tenantId),
          eq(invitationEmailCreationIntents.idempotencyKey, idempotencyKey),
          expectedInvitationId === undefined
            ? undefined
            : eq(invitationEmailCreationIntents.invitationId, expectedInvitationId),
        ),
      )
      .limit(1)) as EmailInvitationCreationRow[];
    const row = rows[0];
    if (!row) {
      return null;
    }

    const invitation = await this.findById(row.invitationId);
    if (!invitation || (expiresAfter && invitation.expiresAt <= expiresAfter)) {
      return null;
    }
    return this.mapToEmailInvitationCreation(row, invitation);
  }

  private async readDatabaseTime(client: DrizzleInvitationClient): Promise<Date> {
    const { rows } = await client.execute<{ milliseconds: number }>(
      sql`select ${DATABASE_MILLISECONDS} as milliseconds`,
    );
    return this.databaseTime(rows[0]?.milliseconds);
  }

  private databaseTime(milliseconds: number | undefined): Date {
    if (milliseconds === undefined || !Number.isFinite(milliseconds)) {
      throw new InvitationRateLimitUnavailableProblem("database-clock-unavailable");
    }
    return new Date(milliseconds);
  }

  private async completeEmailInvitationCreationPhase(
    tenantId: string,
    idempotencyKey: string,
    phase: "notificationStatus" | "eventStatus",
    claimField: "notificationClaimId" | "eventClaimId",
    expiryField: "notificationClaimExpiresAt" | "eventClaimExpiresAt",
    claimId: string,
  ): Promise<EmailInvitationCreation | null> {
    const client = this.txManager.getClient() ?? this.db;
    const column =
      phase === "notificationStatus"
        ? invitationEmailCreationIntents.notificationStatus
        : invitationEmailCreationIntents.eventStatus;
    const rows = (await client
      .update(invitationEmailCreationIntents)
      .set({
        [phase]: "completed",
        [claimField]: null,
        [expiryField]: null,
      })
      .where(
        and(
          eq(invitationEmailCreationIntents.tenantId, tenantId),
          eq(invitationEmailCreationIntents.idempotencyKey, idempotencyKey),
          eq(column, "processing"),
          eq(invitationEmailCreationIntents[claimField], claimId),
        ),
      )
      .returning()) as EmailInvitationCreationRow[];

    const row = rows[0];
    if (!row) {
      return null;
    }

    const invitation = await this.findById(row.invitationId);
    return invitation ? this.mapToEmailInvitationCreation(row, invitation) : null;
  }

  private async claimEmailInvitationCreationPhase(
    tenantId: string,
    idempotencyKey: string,
    phase: "notificationStatus" | "eventStatus",
    claimField: "notificationClaimId" | "eventClaimId",
    expiryField: "notificationClaimExpiresAt" | "eventClaimExpiresAt",
    claimId: string,
    claimExpiresAt: Date,
    expectedInvitationId?: string,
  ): Promise<EmailInvitationCreation | null> {
    const client = this.txManager.getClient() ?? this.db;
    const statusColumn = invitationEmailCreationIntents[phase];
    const expiryColumn = invitationEmailCreationIntents[expiryField];
    const rows = (await client
      .update(invitationEmailCreationIntents)
      .set({
        [phase]: "processing",
        [claimField]: claimId,
        [expiryField]: claimExpiresAt,
      })
      .where(
        and(
          eq(invitationEmailCreationIntents.tenantId, tenantId),
          eq(invitationEmailCreationIntents.idempotencyKey, idempotencyKey),
          expectedInvitationId === undefined
            ? undefined
            : eq(invitationEmailCreationIntents.invitationId, expectedInvitationId),
          or(
            eq(statusColumn, "pending"),
            and(
              eq(statusColumn, "processing"),
              or(
                isNull(expiryColumn),
                lte(expiryColumn, sql`statement_timestamp() AT TIME ZONE 'UTC'`),
              ),
            ),
          ),
        ),
      )
      .returning()) as EmailInvitationCreationRow[];
    const row = rows[0];
    if (!row) {
      return null;
    }
    const invitation = await this.findById(row.invitationId);
    return invitation ? this.mapToEmailInvitationCreation(row, invitation) : null;
  }

  private async releaseEmailInvitationCreationPhase(
    tenantId: string,
    idempotencyKey: string,
    phase: "notificationStatus" | "eventStatus",
    claimField: "notificationClaimId" | "eventClaimId",
    expiryField: "notificationClaimExpiresAt" | "eventClaimExpiresAt",
    claimId: string,
  ): Promise<void> {
    const client = this.txManager.getClient() ?? this.db;
    await client
      .update(invitationEmailCreationIntents)
      .set({
        [phase]: "pending",
        [claimField]: null,
        [expiryField]: null,
      })
      .where(
        and(
          eq(invitationEmailCreationIntents.tenantId, tenantId),
          eq(invitationEmailCreationIntents.idempotencyKey, idempotencyKey),
          eq(invitationEmailCreationIntents[phase], "processing"),
          eq(invitationEmailCreationIntents[claimField], claimId),
        ),
      );
  }

  private mapToEmailInvitationCreation(
    row: EmailInvitationCreationRow,
    invitation: Invitation,
  ): EmailInvitationCreation {
    return {
      invitation,
      token: this.tokenCipher.decrypt(row.tokenCiphertext, {
        tenantId: row.tenantId,
        invitationId: row.invitationId,
        idempotencyKey: row.idempotencyKey,
      }),
      idempotencyKey: row.idempotencyKey,
      requestFingerprint: row.requestFingerprint,
      notificationIdempotencyKey: row.notificationIdempotencyKey,
      notificationStatus: row.notificationStatus,
      notificationClaimId: row.notificationClaimId,
      notificationClaimExpiresAt: row.notificationClaimExpiresAt,
      eventStatus: row.eventStatus,
      eventClaimId: row.eventClaimId,
      eventClaimExpiresAt: row.eventClaimExpiresAt,
      eventId: row.eventId,
      eventOccurredAt: row.eventOccurredAt,
      createdAt: row.createdAt,
    };
  }

  private assertCreationFingerprint(
    existing: EmailInvitationCreation,
    input: EmailInvitationCreationInput,
  ): void {
    if (existing.requestFingerprint !== input.requestFingerprint) {
      throw new InvitationIdempotencyConflictProblem(input.idempotencyKey);
    }
  }
}
