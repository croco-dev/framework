import {
  assertReferralSubject,
  registerReferralProgram,
  sameReferralSubject,
} from "./ReferralProgram";
import { attributionFingerprint } from "./ReferralStore";
import type { ReferralStore, ReferralTx } from "./ReferralStore";
import {
  InvalidReferralProgramProblem,
  ReferralAttributionNotFoundProblem,
  ReferralAttributionStateConflictProblem,
  ReferralBenefitFailedProblem,
  ReferralBudgetExhaustedProblem,
  ReferralDuplicateClaimProblem,
  ReferralExistingCustomerProblem,
  ReferralLinkExpiredProblem,
  ReferralLinkNotFoundProblem,
  ReferralLinkRevokedProblem,
  ReferralProgramNotFoundProblem,
  ReferralQualificationRejectedProblem,
  ReferralSelfReferralProblem,
  ReferralSubjectLimitReachedProblem,
  ReferralTenantMismatchProblem,
} from "./problems";
import type {
  ClaimReferralAttributionInput,
  CreateReferralLinkInput,
  CreateReferralLinkResult,
  FulfillReferralBenefitsInput,
  ListAttributionsFilter,
  ListBenefitIntentsFilter,
  QualifyReferralAttributionInput,
  ReferralAttribution,
  ReferralAuditEntry,
  ReferralBenefitIntent,
  ReferralBenefitIntentStatus,
  ReferralBenefitSide,
  ReferralFunnelCounts,
  ReferralFulfillmentPort,
  ReferralLink,
  ReferralNoveltyHook,
  ReferralProgramDefinition,
  ReferralQualificationHook,
  RegisterReferralProgramInput,
  ReferralSubject,
} from "./types";

const COUNTED_RECEIPT_STATES: readonly ReferralAttribution["state"][] = [
  "qualified",
  "benefits-pending",
  "benefits-partial",
  "fulfilled",
  "indeterminate",
];

const CONFIRMED_CHAIN_STATES: readonly ReferralAttribution["state"][] = [
  "qualified",
  "benefits-pending",
  "benefits-partial",
  "fulfilled",
];

const TERMINAL_BENEFIT_STATES: readonly ReferralBenefitIntentStatus[] = [
  "granted",
  "skipped",
  "canceled",
  "returned",
];

const DEFAULT_LINK_TTL_MS = 90 * 24 * 60 * 60 * 1000;

function defaultNoveltyHook(): ReferralNoveltyHook {
  return () => ({ novelty: "unknown", reason: "no novelty source is configured" });
}

function defaultQualificationHook(): ReferralQualificationHook {
  return () => ({ qualified: false, reason: "no qualification source is configured" });
}

export function referralBenefitIdempotencyKey(
  attributionId: string,
  side: ReferralBenefitSide,
): string {
  return `referral-benefit:${attributionId}:${side}`;
}

export type ReferralTokenHooks = {
  readonly generateToken: () => string;
  readonly hashToken: (token: string) => string;
};

export type ReferralServiceOptions = {
  readonly store: ReferralStore;
  /** Server-only token hooks; raw tokens never persist and never log. */
  readonly tokens: ReferralTokenHooks;
  /** Authoritative signup novelty source owned by the app. */
  readonly novelty?: ReferralNoveltyHook;
  /** Authoritative qualifying-action source owned by the app. */
  readonly qualification?: ReferralQualificationHook;
  /** Benefit boundary; per-side deterministic idempotency, partial success allowed. */
  readonly fulfillment: ReferralFulfillmentPort;
  readonly clock?: () => Date;
  readonly idGenerator?: () => string;
  readonly linkTtlMs?: number;
};

export type ClaimReferralResult = {
  readonly attribution: ReferralAttribution;
  /** False when the same attribution id replayed an identical claim. */
  readonly created: boolean;
  /** True when this claim won the first-valid race; false when held as duplicate. */
  readonly firstValid: boolean;
};

export class ReferralService {
  private readonly store: ReferralStore;
  private readonly tokens: ReferralTokenHooks;
  private readonly novelty: ReferralNoveltyHook;
  private readonly qualification: ReferralQualificationHook;
  private readonly fulfillment: ReferralFulfillmentPort;
  private readonly clock: () => Date;
  private readonly idGenerator: () => string;
  private readonly linkTtlMs: number;

  constructor(options: ReferralServiceOptions) {
    this.store = options.store;
    this.tokens = options.tokens;
    this.novelty = options.novelty ?? defaultNoveltyHook();
    this.qualification = options.qualification ?? defaultQualificationHook();
    this.fulfillment = options.fulfillment;
    this.clock = options.clock ?? (() => new Date());
    this.idGenerator = options.idGenerator ?? (() => globalThis.crypto.randomUUID());
    const linkTtlMs = options.linkTtlMs ?? DEFAULT_LINK_TTL_MS;
    if (
      !Number.isInteger(linkTtlMs) ||
      linkTtlMs < 60_000 ||
      linkTtlMs > 365 * 24 * 60 * 60 * 1000
    ) {
      throw new InvalidReferralProgramProblem(
        "linkTtlMs must be an integer between 60000 and 31536000000",
      );
    }
    this.linkTtlMs = linkTtlMs;
  }

  async registerProgram(
    input: RegisterReferralProgramInput,
  ): Promise<{ readonly program: ReferralProgramDefinition; readonly created: boolean }> {
    const program = registerReferralProgram(input, this.now());
    const { created } = await this.store.transact(async (tx) => {
      const result = await tx.saveProgram(program);
      await tx.recordAudit(this.audit("program", program.id, "program.registered", program, input));
      return result;
    });
    return { program, created };
  }

  /**
   * Creates a shareable link. The raw token is returned once for sharing and
   * never persisted: only its SHA-256 hash is stored. The hash alone resolves
   * claims, so logs and rows never carry the raw token.
   */
  async createReferralLink(input: CreateReferralLinkInput): Promise<CreateReferralLinkResult> {
    assertReferralSubject(input.referrer);
    const now = input.now ?? this.now();
    const program = await this.loadProgram(input.programId, input.programVersion);
    this.assertProgramWindow(program, now);
    const ttl = input.linkTtlMs ?? this.linkTtlMs;
    if (!Number.isInteger(ttl) || ttl < 60_000 || ttl > 365 * 24 * 60 * 60 * 1000) {
      throw new InvalidReferralProgramProblem(
        "linkTtlMs must be an integer between 60000 and 31536000000",
      );
    }
    const token = input.token ?? this.tokens.generateToken();
    if (token.trim().length === 0) {
      throw new InvalidReferralProgramProblem("token must not be blank");
    }
    const tokenHash = input.tokenHash ?? this.tokens.hashToken(token);
    if (!/^[0-9a-f]{64}$/.test(tokenHash)) {
      throw new InvalidReferralProgramProblem("tokenHash must be a sha256 hex digest");
    }
    const link: ReferralLink = {
      id: input.linkId ?? this.idGenerator(),
      tokenHash,
      programId: program.id,
      programVersion: program.version,
      familyId: program.familyId,
      benefitCycleId: program.benefitCycleId,
      referrer: { ...input.referrer },
      createdAt: new Date(now.getTime()),
      expiresAt: new Date(now.getTime() + ttl),
    };
    if (link.id.trim().length === 0) {
      throw new InvalidReferralProgramProblem("linkId must not be blank");
    }
    const stored = await this.store.transact(async (tx) => {
      const saved = await tx.saveLink(link);
      await tx.recordAudit(
        this.audit("link", link.id, "link.created", program, {
          actorId: input.referrer.id,
          reason: `share program ${program.id} v${program.version}`,
          idempotencyKey: `link:${link.id}`,
        }),
      );
      return saved.link;
    });
    return { link: stored, token };
  }

  async revokeLink(input: {
    readonly linkId: string;
    readonly actorId: string;
    readonly reason: string;
    readonly now?: Date;
  }): Promise<ReferralLink> {
    if (input.actorId.trim().length === 0) {
      throw new InvalidReferralProgramProblem("actorId must not be blank");
    }
    if (input.reason.trim().length === 0) {
      throw new InvalidReferralProgramProblem("reason must not be blank");
    }
    const now = input.now ?? this.now();
    return this.store.transact(async (tx) => {
      const stored = await tx.getLink(input.linkId);
      if (!stored) throw new ReferralLinkNotFoundProblem();
      if (stored.revokedAt !== undefined) return stored;
      const program = await tx.getProgram(stored.programId, stored.programVersion);
      if (!program)
        throw new ReferralProgramNotFoundProblem(stored.programId, stored.programVersion);
      const revoked = await tx.revokeLink(stored.id, new Date(now.getTime()));
      await tx.recordAudit(
        this.audit("link", stored.id, "link.revoked", program, {
          actorId: input.actorId,
          reason: input.reason,
          idempotencyKey: `revoke:${stored.id}:${now.getTime()}`,
        }),
      );
      return revoked;
    });
  }

  /** Records a share-intent click; clicks never imply acquisition or success. */
  async recordClick(input: { readonly linkId: string; readonly now?: Date }): Promise<void> {
    const now = input.now ?? this.now();
    await this.store.transact(async (tx) => {
      const stored = await tx.getLink(input.linkId);
      if (!stored) throw new ReferralLinkNotFoundProblem();
      await tx.recordClick(stored.id, new Date(now.getTime()));
    });
  }

  /**
   * Claims attribution for a recipient presenting a raw link token. The first
   * valid claim for a recipient inside a program family wins; later claims
   * are held as duplicates without merging or stealing the attribution.
   * Self-referral, expired or revoked links, other-tenant links, existing
   * customers, and unknown novelty are rejected or held with distinct
   * problems — never silently treated as success.
   */
  async claimAttribution(input: ClaimReferralAttributionInput): Promise<ClaimReferralResult> {
    assertReferralSubject(input.recipient);
    const now = input.now ?? this.now();
    const tokenHash = this.tokens.hashToken(input.token);
    return this.store.transact(async (tx) => {
      const link = await tx.getLinkByTokenHash(tokenHash);
      if (!link) throw new ReferralLinkNotFoundProblem();
      if (link.revokedAt !== undefined) throw new ReferralLinkRevokedProblem(link.id);
      if (link.expiresAt.getTime() <= now.getTime()) {
        throw new ReferralLinkExpiredProblem(link.id);
      }
      const program = await tx.getProgram(link.programId, link.programVersion);
      if (!program) throw new ReferralProgramNotFoundProblem(link.programId, link.programVersion);
      this.assertProgramWindow(program, now);
      if (sameReferralSubject(link.referrer, input.recipient)) {
        throw new ReferralSelfReferralProblem();
      }
      if (
        link.referrer.tenantId !== input.recipient.tenantId ||
        link.referrer.appId !== input.recipient.appId ||
        link.referrer.environment !== input.recipient.environment
      ) {
        throw new ReferralTenantMismatchProblem(link.id);
      }
      const first = await tx.getFirstAttributionForRecipient(program.familyId, input.recipient);
      if (first) {
        const held = await this.holdDuplicateClaim(tx, program, first, input, now);
        return { attribution: held, created: false, firstValid: false };
      }
      const verdict = await this.novelty({
        recipient: input.recipient,
        attribution: {
          id: input.attributionId ?? "",
          programId: program.id,
          programVersion: program.version,
        },
        now,
      });
      if (verdict.novelty === "existing") {
        throw new ReferralExistingCustomerProblem(input.recipient.id, verdict.reason);
      }
      const candidate: ReferralAttribution = {
        id: input.attributionId ?? this.idGenerator(),
        linkId: link.id,
        programId: program.id,
        programVersion: program.version,
        familyId: program.familyId,
        benefitCycleId: program.benefitCycleId,
        scope: {
          appId: input.recipient.appId,
          environment: input.recipient.environment,
          tenantId: input.recipient.tenantId,
        },
        referrer: { ...link.referrer },
        recipient: { ...input.recipient },
        claimedAt: new Date(now.getTime()),
        expiresAt: new Date(now.getTime() + program.conversionWindowMs),
        state: verdict.novelty === "unknown" ? "held" : "claimed",
        holdReason: verdict.novelty === "unknown" ? "unknown-novelty" : undefined,
        cycleIndex: await this.nextCycleIndex(tx, program.familyId, link.referrer),
        createdAt: new Date(now.getTime()),
        updatedAt: new Date(now.getTime()),
      };
      if (candidate.id.trim().length === 0) {
        throw new InvalidReferralProgramProblem("attributionId must not be blank");
      }
      const fingerprint = attributionFingerprint(candidate);
      const saved = await tx.saveAttribution(candidate, fingerprint);
      if (!saved.created) {
        return { attribution: saved.attribution, created: false, firstValid: true };
      }
      await this.reserveAttributionBudget(tx, program, candidate);
      await tx.recordAudit(
        this.audit("attribution", candidate.id, "attribution.claimed", program, {
          actorId: input.recipient.id,
          reason: `claim link ${link.id}`,
          idempotencyKey: `claim:${candidate.id}`,
        }),
      );
      if (verdict.novelty === "unknown") {
        await tx.recordAudit(
          this.audit("attribution", candidate.id, "attribution.held", program, {
            actorId: "system",
            reason: verdict.reason,
            idempotencyKey: `hold:${candidate.id}`,
          }),
        );
      }
      return { attribution: saved.attribution, created: true, firstValid: true };
    });
  }

  /**
   * Qualifies a claimed attribution against the authoritative server source.
   * Held attributions with resolved novelty may qualify; expired conversion
   * windows and rejected qualifications keep distinct states and problems.
   */
  async qualifyAttribution(input: QualifyReferralAttributionInput): Promise<ReferralAttribution> {
    assertReferralSubject(input.recipient);
    const now = input.now ?? this.now();
    return this.store.transact(async (tx) => {
      const stored = await tx.getAttribution(input.attributionId);
      if (!stored) throw new ReferralAttributionNotFoundProblem(input.attributionId);
      if (!stored.recipient || !sameReferralSubject(stored.recipient, input.recipient)) {
        throw new ReferralAttributionStateConflictProblem(
          stored.id,
          stored.state,
          "only the attributed recipient can qualify this attribution",
        );
      }
      if (stored.state === "qualified" || stored.state === "benefits-pending") return stored;
      if (stored.state !== "claimed" && stored.state !== "held") {
        throw new ReferralAttributionStateConflictProblem(
          stored.id,
          stored.state,
          "only claimed or held attributions can qualify",
        );
      }
      if (stored.expiresAt.getTime() <= now.getTime()) {
        const expired: ReferralAttribution = {
          ...stored,
          state: "expired",
          holdReason: undefined,
          updatedAt: new Date(now.getTime()),
        };
        const program = await this.programFor(tx, stored);
        await tx.compareAndSetAttribution(stored.id, [stored.state], expired);
        await tx.releaseBudgetReservation(
          stored.programId,
          stored.programVersion,
          program.budgetPerAttribution,
        );
        await tx.recordAudit(
          this.audit("attribution", stored.id, "attribution.expired", program, {
            actorId: "system",
            reason: "conversion window lapsed before qualification",
            idempotencyKey: `expire:${stored.id}`,
          }),
        );
        return expired;
      }
      const verdict = await this.qualification({
        recipient: input.recipient,
        attribution: stored,
        now,
      });
      const program = await this.programFor(tx, stored);
      if (!verdict.qualified) {
        const rejected: ReferralAttribution = {
          ...stored,
          state: "rejected",
          holdReason: undefined,
          rejectReason: "existing-customer",
          updatedAt: new Date(now.getTime()),
        };
        await tx.compareAndSetAttribution(stored.id, [stored.state], rejected);
        await tx.releaseBudgetReservation(
          stored.programId,
          stored.programVersion,
          program.budgetPerAttribution,
        );
        await tx.recordAudit(
          this.audit("attribution", stored.id, "attribution.rejected", program, {
            actorId: "system",
            reason: verdict.reason,
            idempotencyKey: `reject:${stored.id}`,
          }),
        );
        throw new ReferralQualificationRejectedProblem(stored.id, verdict.reason);
      }
      const qualified: ReferralAttribution = {
        ...stored,
        state: "qualified",
        holdReason: undefined,
        qualification: {
          sourceEventId: verdict.sourceEventId,
          qualifyingAction: verdict.qualifyingAction,
          qualifiedAt: new Date(now.getTime()),
          eligibleReason: verdict.eligibleReason,
        },
        updatedAt: new Date(now.getTime()),
      };
      await tx.compareAndSetAttribution(stored.id, [stored.state], qualified);
      await tx.recordAudit(
        this.audit("attribution", stored.id, "attribution.qualified", program, {
          actorId: input.recipient.id,
          reason: verdict.eligibleReason,
          idempotencyKey: `qualify:${stored.id}:${verdict.sourceEventId}`,
        }),
      );
      await this.ensureBenefitIntents(tx, program, qualified, now);
      const pending: ReferralAttribution = {
        ...qualified,
        state: "benefits-pending",
        updatedAt: new Date(now.getTime()),
      };
      await tx.compareAndSetAttribution(stored.id, ["qualified"], pending);
      return pending;
    });
  }

  /**
   * Fulfills both benefit sides with deterministic per-side idempotency keys.
   * One side may succeed while the other fails or stays unknown; the
   * attribution records `benefits-partial` without re-paying the completed
   * side on retry. Unknown outcomes keep the budget locked for `reconcile`.
   */
  async fulfillBenefits(input: FulfillReferralBenefitsInput): Promise<ReferralAttribution> {
    const now = input.now ?? this.now();
    const stored = await this.store.getAttribution(input.attributionId);
    if (!stored) throw new ReferralAttributionNotFoundProblem(input.attributionId);
    if (stored.state === "fulfilled") return stored;
    if (stored.state === "indeterminate")
      return this.reconcileBenefits({ attributionId: stored.id, now });
    if (
      stored.state !== "qualified" &&
      stored.state !== "benefits-pending" &&
      stored.state !== "benefits-partial"
    ) {
      throw new ReferralAttributionStateConflictProblem(
        stored.id,
        stored.state,
        "only qualified attributions can fulfill benefits",
      );
    }
    const program = await this.programForStore(stored);
    await this.store.transact(async (tx) => {
      await this.ensureBenefitIntents(tx, program, stored, now);
      if (stored.state === "qualified") {
        await tx.compareAndSetAttribution(stored.id, ["qualified"], {
          ...stored,
          state: "benefits-pending",
          updatedAt: new Date(now.getTime()),
        });
      }
    });
    for (const side of ["referrer", "recipient"] as const) {
      await this.fulfillBenefitSide(stored.id, side, now);
    }
    const refreshed = await this.store.getAttribution(stored.id);
    if (!refreshed) throw new ReferralAttributionNotFoundProblem(stored.id);
    return refreshed;
  }

  /**
   * Reconciles benefit intents whose grant outcome is unclear. A visible grant
   * completes the side; otherwise `granting` sides safely retry the idempotent
   * grant, while `unknown` sides stay locked for an explicit operator decision.
   * Reconciliation never releases the budget or pays again on its own.
   */
  async reconcileBenefits(input: {
    readonly attributionId: string;
    readonly now?: Date;
  }): Promise<ReferralAttribution> {
    const now = input.now ?? this.now();
    const stored = await this.store.getAttribution(input.attributionId);
    if (!stored) throw new ReferralAttributionNotFoundProblem(input.attributionId);
    const intents = await this.store.transact((tx) =>
      tx.listBenefitIntentsForAttribution(stored.id),
    );
    for (const intent of intents) {
      if (intent.status !== "granting" && intent.status !== "unknown") continue;
      const observed = await this.fulfillment.check({
        idempotencyKey: intent.idempotencyKey,
        intent,
        subject: intent.subject,
      });
      if (observed) {
        await this.store.transact((tx) =>
          tx.compareAndSetBenefitIntent(
            intent.id,
            ["granting", "unknown"],
            { status: "granted", receipt: observed.grantRef, reason: undefined },
            now,
          ),
        );
      } else if (intent.status === "granting") {
        await this.fulfillBenefitSide(stored.id, intent.side, now);
      }
    }
    await this.refreshAttributionState(stored.id, now);
    const refreshed = await this.store.getAttribution(stored.id);
    if (!refreshed) throw new ReferralAttributionNotFoundProblem(stored.id);
    return refreshed;
  }

  /**
   * Operator adjustment for indeterminate attributions: explicitly complete
   * with a verified grant reference per side, or reject and release the locked
   * budget. Every decision preserves actor, reason, and an audit trail.
   */
  async resolveIndeterminateBenefits(input: {
    readonly attributionId: string;
    readonly decision: "fulfilled" | "rejected";
    readonly grantRefs?: Partial<Record<ReferralBenefitSide, string>>;
    readonly actorId: string;
    readonly reason: string;
    readonly idempotencyKey?: string;
    readonly now?: Date;
  }): Promise<ReferralAttribution> {
    if (input.actorId.trim().length === 0) {
      throw new InvalidReferralProgramProblem("actorId must not be blank");
    }
    if (input.reason.trim().length === 0) {
      throw new InvalidReferralProgramProblem("reason must not be blank");
    }
    const now = input.now ?? this.now();
    return this.store.transact(async (tx) => {
      const stored = await tx.getAttribution(input.attributionId);
      if (!stored) throw new ReferralAttributionNotFoundProblem(input.attributionId);
      if (stored.state !== "indeterminate") {
        throw new ReferralAttributionStateConflictProblem(
          stored.id,
          stored.state,
          "only indeterminate attributions accept an operator decision",
        );
      }
      const program = await this.programFor(tx, stored);
      if (input.decision === "rejected") {
        const rejected: ReferralAttribution = {
          ...stored,
          state: "rejected",
          updatedAt: new Date(now.getTime()),
        };
        await tx.compareAndSetAttribution(stored.id, ["indeterminate"], rejected);
        await tx.releaseBudgetReservation(
          stored.programId,
          stored.programVersion,
          program.budgetPerAttribution,
        );
        await tx.recordAudit(
          this.audit("attribution", stored.id, "attribution.rejected-by-operator", program, {
            actorId: input.actorId,
            reason: input.reason,
            idempotencyKey: input.idempotencyKey ?? `operator:${stored.id}:${now.getTime()}`,
          }),
        );
        return rejected;
      }
      for (const side of ["referrer", "recipient"] as const) {
        const grantRef = input.grantRefs?.[side];
        if (grantRef === undefined || grantRef.trim().length === 0) {
          throw new InvalidReferralProgramProblem(
            `resolving side '${side}' as fulfilled requires a grantRef`,
          );
        }
        const intent = await tx.getBenefitIntentByLogicalKey(
          referralBenefitIdempotencyKey(stored.id, side),
        );
        if (intent && (intent.status === "unknown" || intent.status === "granting")) {
          await tx.compareAndSetBenefitIntent(
            intent.id,
            ["unknown", "granting"],
            { status: "granted", receipt: grantRef, reason: undefined },
            now,
          );
        }
      }
      const fulfilled: ReferralAttribution = {
        ...stored,
        state: "fulfilled",
        updatedAt: new Date(now.getTime()),
      };
      await tx.compareAndSetAttribution(stored.id, ["indeterminate"], fulfilled);
      await tx.recordAudit(
        this.audit("attribution", stored.id, "attribution.fulfilled-by-operator", program, {
          actorId: input.actorId,
          reason: input.reason,
          idempotencyKey: input.idempotencyKey ?? `operator:${stored.id}:${now.getTime()}`,
        }),
      );
      return fulfilled;
    });
  }

  /** Lists pending attributions so restarts can resume qualification and benefits. */
  async recoverPendingAttributions(input?: {
    readonly limit?: number;
  }): Promise<readonly ReferralAttribution[]> {
    return this.store.listAttributions({
      states: [
        "claimed",
        "held",
        "qualified",
        "benefits-pending",
        "benefits-partial",
        "indeterminate",
      ],
      limit: input?.limit ?? 100,
    });
  }

  /** Funnel counts keep share intent separate from confirmed acquisition and payout. */
  async funnelCounts(input: {
    readonly programId: string;
    readonly familyId?: string;
  }): Promise<ReferralFunnelCounts> {
    const attributions = await this.store.listAttributions({
      programId: input.programId,
      familyId: input.familyId,
      limit: 1000,
    });
    const clicks = await this.clicksForProgram(input.programId);
    return {
      clicks,
      claims: attributions.filter((entry) => entry.state !== "held").length,
      signups: attributions.filter(
        (entry) =>
          entry.state === "qualified" ||
          entry.state === "benefits-pending" ||
          entry.state === "benefits-partial" ||
          entry.state === "fulfilled",
      ).length,
      qualified: attributions.filter(
        (entry) =>
          entry.state === "qualified" ||
          entry.state === "benefits-pending" ||
          entry.state === "benefits-partial" ||
          entry.state === "fulfilled",
      ).length,
      fulfilled: attributions.filter((entry) => entry.state === "fulfilled").length,
    };
  }

  async getAttribution(attributionId: string): Promise<ReferralAttribution | null> {
    return this.store.getAttribution(attributionId);
  }

  async listAttributions(filter: ListAttributionsFilter): Promise<readonly ReferralAttribution[]> {
    return this.store.listAttributions(filter);
  }

  async listBenefitIntents(
    filter: ListBenefitIntentsFilter,
  ): Promise<readonly ReferralBenefitIntent[]> {
    return this.store.listBenefitIntents(filter);
  }

  /**
   * Cancels a pending benefit side before any grant completed. Granted or
   * already terminal sides never cancel; an explicit policy reversal owns
   * completed grants instead.
   */
  async cancelBenefitSide(input: {
    readonly attributionId: string;
    readonly side: ReferralBenefitSide;
    readonly actorId: string;
    readonly reason: string;
    readonly policy: string;
    readonly now?: Date;
  }): Promise<ReferralAttribution> {
    if (input.actorId.trim().length === 0) {
      throw new InvalidReferralProgramProblem("actorId must not be blank");
    }
    if (input.reason.trim().length === 0) {
      throw new InvalidReferralProgramProblem("reason must not be blank");
    }
    if (input.policy.trim().length === 0) {
      throw new InvalidReferralProgramProblem("policy must not be blank");
    }
    const now = input.now ?? this.now();
    await this.store.transact(async (tx) => {
      const stored = await tx.getAttribution(input.attributionId);
      if (!stored) throw new ReferralAttributionNotFoundProblem(input.attributionId);
      const intent = await tx.getBenefitIntentByLogicalKey(
        referralBenefitIdempotencyKey(stored.id, input.side),
      );
      if (!intent) {
        throw new ReferralBenefitFailedProblem(stored.id, input.side, "benefit intent is missing");
      }
      if (intent.status !== "pending") {
        throw new ReferralAttributionStateConflictProblem(
          intent.id,
          intent.status,
          `only pending benefit intents can cancel (policy ${input.policy})`,
        );
      }
      const program = await this.programFor(tx, stored);
      await tx.compareAndSetBenefitIntent(
        intent.id,
        ["pending"],
        { status: "canceled", reason: `${input.policy}: ${input.reason}` },
        now,
      );
      await tx.recordAudit(
        this.audit("benefit", intent.id, "benefit.canceled", program, {
          actorId: input.actorId,
          reason: `${input.policy}: ${input.reason}`,
          idempotencyKey: `cancel:${intent.id}:${now.getTime()}`,
        }),
      );
    });
    await this.refreshAttributionState(input.attributionId, now);
    const refreshed = await this.store.getAttribution(input.attributionId);
    if (!refreshed) throw new ReferralAttributionNotFoundProblem(input.attributionId);
    return refreshed;
  }

  /**
   * Returns a completed benefit through an explicit compensating fulfillment
   * reversal. The reversal posts a new ledger entry keyed by the return
   * idempotency key; the original grant receipt stays on the intent while the
   * policy and the return receipt record why value moved back. Other
   * subjects' confirmed benefits are never touched implicitly.
   */
  async returnBenefitSide(input: {
    readonly attributionId: string;
    readonly side: ReferralBenefitSide;
    readonly policy: string;
    readonly returnIdempotencyKey?: string;
    readonly actorId: string;
    readonly reason: string;
    readonly now?: Date;
  }): Promise<ReferralAttribution> {
    if (input.policy.trim().length === 0) {
      throw new InvalidReferralProgramProblem("policy must not be blank");
    }
    if (
      input.returnIdempotencyKey !== undefined &&
      input.returnIdempotencyKey.trim().length === 0
    ) {
      throw new InvalidReferralProgramProblem("returnIdempotencyKey must not be blank");
    }
    if (input.actorId.trim().length === 0) {
      throw new InvalidReferralProgramProblem("actorId must not be blank");
    }
    if (input.reason.trim().length === 0) {
      throw new InvalidReferralProgramProblem("reason must not be blank");
    }
    const now = input.now ?? this.now();
    const snapshot = await this.store.transact(async (tx) => {
      const stored = await tx.getAttribution(input.attributionId);
      if (!stored) throw new ReferralAttributionNotFoundProblem(input.attributionId);
      const intent = await tx.getBenefitIntentByLogicalKey(
        referralBenefitIdempotencyKey(stored.id, input.side),
      );
      if (!intent) {
        throw new ReferralBenefitFailedProblem(stored.id, input.side, "benefit intent is missing");
      }
      if (intent.status !== "granted") {
        throw new ReferralAttributionStateConflictProblem(
          intent.id,
          intent.status,
          `only granted benefit intents can return (policy ${input.policy})`,
        );
      }
      return { intent };
    });
    const reverse = this.fulfillment.reverse;
    if (!reverse) {
      throw new ReferralBenefitFailedProblem(
        input.attributionId,
        input.side,
        "fulfillment does not support benefit return",
      );
    }
    const returnKey = input.returnIdempotencyKey ?? `return:${snapshot.intent.idempotencyKey}`;
    let returnRef: string;
    try {
      const result = await reverse.call(this.fulfillment, {
        returnIdempotencyKey: returnKey,
        intent: snapshot.intent,
        subject: snapshot.intent.subject,
        attributionId: input.attributionId,
        policy: input.policy,
        reason: input.reason,
      });
      if ("error" in result) {
        throw new ReferralBenefitFailedProblem(input.attributionId, input.side, result.error);
      }
      returnRef = result.returnRef;
    } catch (error) {
      if (error instanceof ReferralBenefitFailedProblem) throw error;
      throw new ReferralBenefitFailedProblem(
        input.attributionId,
        input.side,
        error instanceof Error ? error.message : String(error),
      );
    }
    if (returnRef.trim().length === 0) {
      throw new ReferralBenefitFailedProblem(
        input.attributionId,
        input.side,
        "fulfillment returned an empty return receipt",
      );
    }
    await this.store.transact(async (tx) => {
      const stored = await tx.getAttribution(input.attributionId);
      if (!stored) throw new ReferralAttributionNotFoundProblem(input.attributionId);
      const program = await this.programFor(tx, stored);
      await tx.compareAndSetBenefitIntent(
        snapshot.intent.id,
        ["granted"],
        {
          status: "returned",
          reason: `${input.policy}: ${input.reason} (return ${returnRef})`,
        },
        now,
      );
      await tx.recordAudit(
        this.audit("benefit", snapshot.intent.id, "benefit.returned", program, {
          actorId: input.actorId,
          reason: `${input.policy}: ${input.reason} (return ${returnRef})`,
          idempotencyKey: returnKey,
        }),
      );
    });
    await this.refreshAttributionState(input.attributionId, now);
    const refreshed = await this.store.getAttribution(input.attributionId);
    if (!refreshed) throw new ReferralAttributionNotFoundProblem(input.attributionId);
    return refreshed;
  }

  private now(): Date {
    const now = this.clock();
    if (Number.isNaN(now.getTime())) {
      throw new InvalidReferralProgramProblem("clock returned an invalid date");
    }
    return new Date(now.getTime());
  }

  private async loadProgram(
    programId: string,
    version?: number,
  ): Promise<ReferralProgramDefinition> {
    if (programId.trim().length === 0) {
      throw new InvalidReferralProgramProblem("programId must not be blank");
    }
    if (version === undefined) {
      const latest = await this.store.latestProgramVersion(programId);
      if (latest === null) throw new ReferralProgramNotFoundProblem(programId);
      const program = await this.store.getProgram(programId, latest);
      if (!program) throw new ReferralProgramNotFoundProblem(programId, latest);
      return program;
    }
    const program = await this.store.getProgram(programId, version);
    if (!program) throw new ReferralProgramNotFoundProblem(programId, version);
    return program;
  }

  private async programFor(
    tx: ReferralTx,
    attribution: ReferralAttribution,
  ): Promise<ReferralProgramDefinition> {
    const program = await tx.getProgram(attribution.programId, attribution.programVersion);
    if (!program) {
      throw new ReferralProgramNotFoundProblem(attribution.programId, attribution.programVersion);
    }
    return program;
  }

  private async programForStore(
    attribution: ReferralAttribution,
  ): Promise<ReferralProgramDefinition> {
    const program = await this.store.getProgram(attribution.programId, attribution.programVersion);
    if (!program) {
      throw new ReferralProgramNotFoundProblem(attribution.programId, attribution.programVersion);
    }
    return program;
  }

  private assertProgramWindow(program: ReferralProgramDefinition, now: Date): void {
    if (now.getTime() < program.startsAt.getTime()) {
      throw new ReferralAttributionStateConflictProblem(
        program.id,
        "program-window",
        "the referral program has not started yet",
      );
    }
    if (now.getTime() >= program.endsAt.getTime()) {
      throw new ReferralAttributionStateConflictProblem(
        program.id,
        "program-window",
        "the referral program window already ended",
      );
    }
  }

  private async holdDuplicateClaim(
    tx: ReferralTx,
    program: ReferralProgramDefinition,
    first: ReferralAttribution,
    input: ClaimReferralAttributionInput,
    now: Date,
  ): Promise<ReferralAttribution> {
    const held: ReferralAttribution = {
      id: input.attributionId ?? this.idGenerator(),
      linkId: first.linkId,
      programId: program.id,
      programVersion: program.version,
      familyId: program.familyId,
      benefitCycleId: program.benefitCycleId,
      scope: {
        appId: input.recipient.appId,
        environment: input.recipient.environment,
        tenantId: input.recipient.tenantId,
      },
      referrer: { ...first.referrer },
      recipient: { ...input.recipient },
      claimedAt: new Date(now.getTime()),
      expiresAt: new Date(now.getTime() + program.conversionWindowMs),
      state: "held",
      holdReason: "duplicate-claim",
      cycleIndex: first.cycleIndex,
      createdAt: new Date(now.getTime()),
      updatedAt: new Date(now.getTime()),
    };
    if (held.id.trim().length === 0) {
      throw new InvalidReferralProgramProblem("attributionId must not be blank");
    }
    const fingerprint = attributionFingerprint(held);
    const saved = await tx.saveAttribution(held, fingerprint);
    if (saved.created) {
      await tx.recordAudit(
        this.audit("attribution", held.id, "attribution.held-duplicate", program, {
          actorId: input.recipient.id,
          reason: `first-valid attribution ${first.id} already holds this recipient`,
          idempotencyKey: `hold-duplicate:${held.id}`,
        }),
      );
      throw new ReferralDuplicateClaimProblem(input.recipient.id);
    }
    return saved.attribution;
  }

  private async nextCycleIndex(
    tx: ReferralTx,
    familyId: string,
    referrer: ReferralSubject,
  ): Promise<number> {
    const prior = await tx.listAttributionsForRecipient(familyId, referrer);
    const confirmed = prior.filter((entry) => CONFIRMED_CHAIN_STATES.includes(entry.state));
    if (confirmed.length === 0) return 1;
    return Math.max(...confirmed.map((entry) => entry.cycleIndex)) + 1;
  }

  private async clicksForProgram(programId: string): Promise<number> {
    return this.store.transact((tx) => tx.countClicksForProgram(programId));
  }

  private async reserveAttributionBudget(
    tx: ReferralTx,
    program: ReferralProgramDefinition,
    attribution: ReferralAttribution,
  ): Promise<void> {
    if (!attribution.recipient) return;
    for (const subject of [attribution.referrer, attribution.recipient]) {
      const counted = await tx.countSubjectReceipts(
        program.familyId,
        program.benefitCycleId,
        subject,
        COUNTED_RECEIPT_STATES,
      );
      if (counted >= program.perSubjectLimit) {
        throw new ReferralSubjectLimitReachedProblem(
          program.familyId,
          program.benefitCycleId,
          subject.id === attribution.referrer.id ? "referrer" : "recipient",
          program.perSubjectLimit,
        );
      }
    }
    try {
      await tx.addBudgetReservation(program.id, program.version, program.budgetPerAttribution);
    } catch (error) {
      if (error instanceof ReferralBudgetExhaustedProblem) throw error;
      throw new ReferralBudgetExhaustedProblem(program.id, program.version);
    }
  }

  private async ensureBenefitIntents(
    tx: ReferralTx,
    program: ReferralProgramDefinition,
    attribution: ReferralAttribution,
    now: Date,
  ): Promise<void> {
    if (!attribution.recipient) {
      throw new ReferralAttributionStateConflictProblem(
        attribution.id,
        attribution.state,
        "benefits require a known recipient",
      );
    }
    const sides: readonly {
      readonly side: ReferralBenefitSide;
      readonly subject: ReferralSubject;
    }[] = [
      { side: "referrer", subject: attribution.referrer },
      { side: "recipient", subject: attribution.recipient },
    ];
    for (const entry of sides) {
      const benefit =
        entry.side === "referrer" ? program.referrerBenefit : program.recipientBenefit;
      const intent: ReferralBenefitIntent = {
        id: `${attribution.id}:${entry.side}`,
        attributionId: attribution.id,
        side: entry.side,
        logicalKey: referralBenefitIdempotencyKey(attribution.id, entry.side),
        idempotencyKey: referralBenefitIdempotencyKey(attribution.id, entry.side),
        subject: { ...entry.subject },
        benefit,
        status: benefit.kind === "none" ? "skipped" : "pending",
        reason: benefit.kind === "none" ? "program tracks progress without a benefit" : undefined,
        createdAt: new Date(now.getTime()),
        updatedAt: new Date(now.getTime()),
      };
      await tx.saveBenefitIntent(intent);
    }
  }

  private async fulfillBenefitSide(
    attributionId: string,
    side: ReferralBenefitSide,
    now: Date,
  ): Promise<void> {
    const stored = await this.store.getAttribution(attributionId);
    if (!stored) throw new ReferralAttributionNotFoundProblem(attributionId);
    const program = await this.programForStore(stored);
    const ensured = await this.store.transact((tx) =>
      tx.getBenefitIntentByLogicalKey(referralBenefitIdempotencyKey(attributionId, side)),
    );
    if (!ensured) {
      await this.store.transact((tx) => this.ensureBenefitIntents(tx, program, stored, now));
    }
    const intent = await this.store.transact((tx) =>
      tx.getBenefitIntentByLogicalKey(referralBenefitIdempotencyKey(attributionId, side)),
    );
    if (!intent)
      throw new ReferralBenefitFailedProblem(attributionId, side, "benefit intent is missing");
    if (
      intent.status === "granted" ||
      intent.status === "skipped" ||
      intent.status === "canceled" ||
      intent.status === "returned"
    ) {
      await this.refreshAttributionState(attributionId, now);
      return;
    }
    if (intent.status === "unknown" || intent.status === "failed") {
      await this.refreshAttributionState(attributionId, now);
      return;
    }
    await this.store.transact((tx) =>
      tx.compareAndSetBenefitIntent(intent.id, ["pending"], { status: "granting" }, now),
    );
    let result: Awaited<ReturnType<ReferralFulfillmentPort["fulfill"]>>;
    try {
      result = await this.fulfillment.fulfill({
        idempotencyKey: intent.idempotencyKey,
        intent,
        attribution: stored,
        program,
        subject: intent.subject,
      });
    } catch (error) {
      await this.store.transact((tx) =>
        tx.compareAndSetBenefitIntent(
          intent.id,
          ["granting"],
          {
            status: "unknown",
            reason: error instanceof Error ? error.message : String(error),
          },
          now,
        ),
      );
      await this.refreshAttributionState(attributionId, now);
      throw error;
    }
    switch (result.outcome) {
      case "granted":
        await this.store.transact(async (tx) => {
          await tx.compareAndSetBenefitIntent(
            intent.id,
            ["granting"],
            { status: "granted", receipt: result.grantRef, reason: undefined },
            now,
          );
          await tx.recordAudit(
            this.audit("benefit", intent.id, "benefit.granted", program, {
              actorId: intent.subject.id,
              reason: `grant ${result.grantRef}`,
              idempotencyKey: intent.idempotencyKey,
            }),
          );
        });
        break;
      case "skipped":
        await this.store.transact((tx) =>
          tx.compareAndSetBenefitIntent(
            intent.id,
            ["granting"],
            { status: "skipped", reason: result.reason },
            now,
          ),
        );
        break;
      case "failed":
        await this.store.transact(async (tx) => {
          await tx.compareAndSetBenefitIntent(
            intent.id,
            ["granting"],
            { status: "failed", reason: result.reason },
            now,
          );
          await tx.recordAudit(
            this.audit("benefit", intent.id, "benefit.failed", program, {
              actorId: intent.subject.id,
              reason: result.reason,
              idempotencyKey: intent.idempotencyKey,
            }),
          );
        });
        break;
      case "unknown":
        await this.store.transact((tx) =>
          tx.compareAndSetBenefitIntent(
            intent.id,
            ["granting"],
            { status: "unknown", reason: result.reason },
            now,
          ),
        );
        break;
    }
    await this.refreshAttributionState(attributionId, now);
  }

  private async refreshAttributionState(attributionId: string, now: Date): Promise<void> {
    await this.store.transact(async (tx) => {
      const stored = await tx.getAttribution(attributionId);
      if (!stored) throw new ReferralAttributionNotFoundProblem(attributionId);
      const program = await this.programFor(tx, stored);
      const intents = await tx.listBenefitIntentsForAttribution(stored.id);
      if (intents.length === 0) return;
      const statuses = intents.map((intent) => intent.status);
      const terminal = (status: ReferralBenefitIntentStatus): boolean =>
        TERMINAL_BENEFIT_STATES.includes(status);
      let next: ReferralAttribution["state"] | null = null;
      if (statuses.every(terminal)) {
        next = "fulfilled";
      } else if (statuses.some((status) => status === "unknown")) {
        next = "indeterminate";
      } else if (
        statuses.some(
          (status) => status === "granted" || status === "skipped" || status === "returned",
        ) &&
        statuses.some(
          (status) =>
            status === "pending" ||
            status === "granting" ||
            status === "failed" ||
            status === "canceled",
        )
      ) {
        next = "benefits-partial";
      } else if (statuses.some((status) => status === "failed" || status === "canceled")) {
        next = "benefits-partial";
      } else if (stored.state === "qualified") {
        next = "benefits-pending";
      }
      if (!next || next === stored.state) return;
      const updated: ReferralAttribution = {
        ...stored,
        state: next,
        updatedAt: new Date(now.getTime()),
      };
      await tx.compareAndSetAttribution(stored.id, [stored.state], updated);
      await tx.recordAudit(
        this.audit("attribution", stored.id, `attribution.${next}`, program, {
          actorId: "system",
          reason: `benefit sides: ${statuses.join(",")}`,
          idempotencyKey: `attribution-state:${stored.id}:${next}:${now.getTime()}`,
        }),
      );
    });
  }

  private audit(
    targetKind: "program" | "link" | "attribution" | "benefit",
    targetId: string,
    action: string,
    program: ReferralProgramDefinition,
    evidence: {
      readonly actorId: string;
      readonly reason: string;
      readonly idempotencyKey: string;
    },
  ): ReferralAuditEntry {
    return {
      auditId: this.idGenerator(),
      targetKind,
      targetId,
      action,
      actorId: evidence.actorId,
      reason: evidence.reason,
      revision: `${program.id}@${program.version}`,
      idempotencyKey: evidence.idempotencyKey,
      recordedAt: this.now(),
    };
  }
}

export { DEFAULT_LINK_TTL_MS };
