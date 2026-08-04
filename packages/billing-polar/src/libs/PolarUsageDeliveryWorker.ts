import type { UsageBillingGateway } from "@croco/billing-core";
import type { BillableUsageClaim, BillableUsageJournal } from "@croco/metering-core";
import { Problem } from "@croco/problems-core";
import {
  PolarRetryableUpstreamProblem,
  PolarValidationProblem,
} from "./problems/PolarBillingProblems";

const MIN_SAFE_LEASE_DURATION_MS = 30_000;

export type PolarUsageDeliveryWorkerOptions = {
  readonly ownerId: string;
  readonly leaseDurationMs: number;
  readonly maxBatchSize?: number;
  readonly retryBaseDelayMs?: number;
  readonly retryMaxDelayMs?: number;
};

export type PolarUsageDeliveryRunResult = {
  readonly accepted: number;
  readonly retryableFailed: number;
  readonly terminalFailed: number;
};

/**
 * Pulls a bounded number of durable usage claims and sends each one through the usage capability. Provider calls are
 * deliberately outside MeteringService.record(), preserving local request latency and journal replay semantics.
 */
export class PolarUsageDeliveryWorker {
  private readonly maxBatchSize: number;
  private readonly retryBaseDelayMs: number;
  private readonly retryMaxDelayMs: number;

  constructor(
    private readonly journal: BillableUsageJournal,
    private readonly usageGateway: UsageBillingGateway,
    private readonly options: PolarUsageDeliveryWorkerOptions,
  ) {
    requirePositiveInteger(options.leaseDurationMs, "leaseDurationMs");
    if (options.leaseDurationMs < MIN_SAFE_LEASE_DURATION_MS) {
      throw validationProblem(
        `Polar usage delivery leaseDurationMs must be at least ${MIN_SAFE_LEASE_DURATION_MS}`,
      );
    }
    this.maxBatchSize = options.maxBatchSize ?? 25;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 1_000;
    this.retryMaxDelayMs = options.retryMaxDelayMs ?? 60_000;
    requirePositiveInteger(this.maxBatchSize, "maxBatchSize");
    requirePositiveInteger(this.retryBaseDelayMs, "retryBaseDelayMs");
    requirePositiveInteger(this.retryMaxDelayMs, "retryMaxDelayMs");
    if (!options.ownerId.trim()) {
      throw validationProblem("Polar usage delivery ownerId must be non-empty");
    }
  }

  async deliverNextBatch(now = new Date()): Promise<PolarUsageDeliveryRunResult> {
    let accepted = 0;
    let retryableFailed = 0;
    let terminalFailed = 0;

    for (let index = 0; index < this.maxBatchSize; index += 1) {
      const claim = await this.journal.claimNext({
        ownerId: this.options.ownerId,
        leaseDurationMs: this.options.leaseDurationMs,
        now,
      });
      if (!claim) break;

      const receipt = await this.ingestClaim(claim);
      if (receipt !== "accepted" && receipt.status === "retryable-failed") {
        await this.journal.markRetryableFailed(
          claim,
          receipt.failure,
          new Date(now.getTime() + this.retryDelay(claim.retryCount)),
          now,
        );
        retryableFailed += 1;
        continue;
      }
      if (receipt !== "accepted" && receipt.status === "terminal-failed") {
        await this.journal.markTerminalFailed(claim, receipt.failure, now);
        terminalFailed += 1;
        continue;
      }

      await this.journal.markAccepted(claim, now);
      accepted += 1;
    }
    return { accepted, retryableFailed, terminalFailed };
  }

  private async ingestClaim(claim: BillableUsageClaim): Promise<
    | "accepted"
    | {
        readonly failure: { readonly code: string; readonly message: string };
        readonly status: "retryable-failed";
      }
    | {
        readonly failure: { readonly code: string; readonly message: string };
        readonly status: "terminal-failed";
      }
  > {
    try {
      const receipt = await this.usageGateway.ingest([
        {
          billingAccountId: claim.event.tenantId,
          dimensions: claim.event.dimensions,
          eventId: claim.event.eventId,
          meterId: claim.event.meterId,
          occurredAt: claim.createdAt,
          value: claim.event.value,
        },
      ]);
      const eventReceipt = receipt.receipts[0];
      if (
        receipt.receipts.length !== 1 ||
        !eventReceipt ||
        eventReceipt.eventId !== claim.event.eventId
      ) {
        throw validationProblem("Usage gateway returned a non-deterministic receipt");
      }
      return "accepted";
    } catch (error) {
      return {
        status: isRetryable(error) ? "retryable-failed" : "terminal-failed",
        failure: toFailure(error),
      };
    }
  }

  private retryDelay(retryCount: number): number {
    return Math.min(this.retryBaseDelayMs * 2 ** retryCount, this.retryMaxDelayMs);
  }
}

function isRetryable(error: unknown): boolean {
  return error instanceof PolarRetryableUpstreamProblem;
}

function toFailure(error: unknown): { readonly code: string; readonly message: string } {
  if (error instanceof Problem) {
    return { code: error.code, message: error.code };
  }
  return {
    code: "billing-polar/usage-delivery-failed",
    message: "Polar usage delivery failed without a recoverable provider diagnosis",
  };
}

function requirePositiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw validationProblem(`Polar usage delivery ${name} must be a positive integer`);
  }
}

function validationProblem(detail: string): PolarValidationProblem {
  return new PolarValidationProblem(
    { operation: "usage.delivery.configuration", provider: "polar" },
    detail,
  );
}
