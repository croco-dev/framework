import { DomainEvent, restoreSerializedEventIdentity } from "@croco/events-core";
import type { EnrichmentReceipt } from "@croco/analytics-core/enrichment";

/** Observational candidate receipt only; never a reviewed label or campaign/benefit command. */
export class EnrichmentCandidateRecorded extends DomainEvent {
  static readonly eventName = "enrichment.candidate.recorded";
  readonly receipt: EnrichmentReceipt;
  constructor(receipt: EnrichmentReceipt) {
    super(receipt.candidate.receiptId);
    restoreSerializedEventIdentity(this, receipt.candidate.receiptId, receipt.candidate.occurredAt);
    this.receipt = receipt;
  }
}
