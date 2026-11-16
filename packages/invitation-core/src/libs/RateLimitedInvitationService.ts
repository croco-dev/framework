import { randomUUID } from "node:crypto";
import { Component } from "@croco/framework-context";
import type {
  CreateEmailInvitationInput,
  CreateLinkInvitationInput,
  InvitationManager,
} from "./InvitationManager";
import { InvitationStore } from "./InvitationStore";
import { BatchSizeExceededProblem } from "./problems/BatchInviteProblems";
import {
  InvalidInvitationExpiryDurationProblem,
  InvitationCreationFailedProblem,
  InvitationIdempotencyConflictProblem,
} from "./problems/InvitationProblems";
import {
  DuplicateInvitationProblem,
  InvitationRateLimitExceededProblem,
  InvitationRateLimitUnavailableProblem,
} from "./problems/RateLimitProblems";
import type { BatchInviteOptions, BatchInviteResult, RateLimitConfig } from "./types";

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxInvitesPerHour: 100,
  maxInvitesPerDay: 1000,
};

function batchErrorMessage(error: unknown): string {
  if (error instanceof DuplicateInvitationProblem) {
    return "Invitation already pending";
  }
  if (
    error instanceof InvalidInvitationExpiryDurationProblem ||
    error instanceof InvitationCreationFailedProblem ||
    error instanceof InvitationIdempotencyConflictProblem ||
    error instanceof InvitationRateLimitExceededProblem ||
    error instanceof InvitationRateLimitUnavailableProblem
  ) {
    return error.message;
  }
  return "Invitation creation could not be confirmed";
}

@Component()
export class RateLimitedInvitationService {
  constructor(
    private readonly manager: InvitationManager,
    private readonly store: InvitationStore,
    private readonly config: RateLimitConfig = DEFAULT_RATE_LIMIT,
  ) {}

  /** Inspect current usage without reserving capacity. */
  async checkRateLimit(tenantId: string): Promise<void> {
    return InvitationStore.checkIssuanceRateLimit(this.store, tenantId, this.config);
  }

  async createEmailInvitationWithRateLimit(input: CreateEmailInvitationInput): Promise<string> {
    return this.manager.createEmailInvitationWithRateLimit(input, this.config);
  }

  async createLinkInvitationWithRateLimit(input: CreateLinkInvitationInput): Promise<string> {
    return this.manager.createLinkInvitationWithRateLimit(input, this.config);
  }

  async batchInvite(
    tenantId: string,
    emails: string[],
    options: BatchInviteOptions = {},
  ): Promise<BatchInviteResult> {
    const maxBatchSize = options.maxBatchSize ?? 50;
    if (emails.length > maxBatchSize) {
      throw new BatchSizeExceededProblem(maxBatchSize);
    }

    const result: BatchInviteResult = { successful: [], failed: [] };
    for (const email of emails) {
      const normalizedEmail = email.trim().toLowerCase();
      try {
        const token = await this.createEmailInvitationWithRateLimit({
          idempotencyKey: `${options.idempotencyKey ?? randomUUID()}:${normalizedEmail}`,
          tenantId,
          inviterId: "system",
          email: normalizedEmail,
          role: "member",
          expiresInDays: options.expiresInDays,
        });
        result.successful.push({ email: normalizedEmail, token });
      } catch (error) {
        result.failed.push({
          email: normalizedEmail,
          error: batchErrorMessage(error),
        });
      }
    }
    return result;
  }
}
