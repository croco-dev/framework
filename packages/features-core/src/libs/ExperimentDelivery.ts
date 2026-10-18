import { randomUUID } from "node:crypto";
import {
  assertExperimentOwnership,
  experimentHash,
  experimentKey,
  ExperimentProblem,
} from "./Experiment";
import type {
  ExperimentAssignment,
  ExperimentExposure,
  ExperimentInput,
  ExperimentTarget,
} from "./Experiment";
import type { ExperimentAssignmentResult } from "./ExperimentRuntime";

/** Only verified server identities belong here. Never construct this from browser body fields. */
export type ExperimentDeliveryIdentity = Pick<ExperimentInput, "scope" | "subject" | "actor">;
export type ExperimentRenderRegion = Readonly<{
  id: string;
  target: ExperimentTarget;
  policyRevision: string;
}>;
/** Browser-safe render data: no subject, traits, source snapshot, provider metadata or handler. */
export type ExperimentRenderDecision = Readonly<{
  region: string;
  deliveryId: string;
  policyRevision: string;
  experimentRevision: string;
  status: "assigned" | "fallback";
  variant?: string;
  value?: string | boolean | number;
  receipt?: string;
  phase: "speculative" | "admitted";
  validUntil: string;
}>;
export type ExperimentDeliveryReceipt = Readonly<{
  decision: ExperimentRenderDecision;
  assignment: ExperimentAssignment;
}>;
/** Private receipt persistence. Implementations must preserve token uniqueness and immutable decisions. */
export interface ExperimentDeliveryStore {
  create(token: string, receipt: ExperimentDeliveryReceipt): Promise<void>;
  read(token: string): Promise<ExperimentDeliveryReceipt | undefined>;
}
/** Local reference sink only; replicas/restarts require an application-owned shared receipt store. */
export class InMemoryExperimentDeliveryStore implements ExperimentDeliveryStore {
  private readonly receipts = new Map<string, ExperimentDeliveryReceipt>();
  async create(token: string, receipt: ExperimentDeliveryReceipt): Promise<void> {
    if (this.receipts.has(token))
      throw new ExperimentProblem("conflict", "Delivery receipt already exists");
    this.receipts.set(token, structuredClone(receipt));
  }
  async read(token: string): Promise<ExperimentDeliveryReceipt | undefined> {
    const receipt = this.receipts.get(token);
    return receipt ? structuredClone(receipt) : undefined;
  }
}
/** An application assignment reader or the real ExperimentRuntime; no allocator lives in this bridge. */
export interface ExperimentDeliveryReader {
  assign(input: ExperimentInput): Promise<ExperimentAssignmentResult>;
  admitDisplay(
    input: ExperimentInput & { readonly assignmentId: string },
  ): Promise<ExperimentAssignmentResult>;
  recordExposure(
    input: ExperimentInput & {
      readonly assignmentId: string;
      readonly deliveryInstanceId: string;
      readonly occurredAt: string;
      readonly kind: "display";
    },
  ): Promise<ExperimentExposure>;
}
export type ExperimentDeliveryInspection = Readonly<{
  stage: "decision" | "exposure";
  region: string;
  status: "assigned" | "fallback";
  reason: string;
  elapsedMs: number;
  phase: "speculative" | "admitted";
}>;
export type ExperimentDeliveryOptions = Readonly<{
  regions: readonly ExperimentRenderRegion[];
  reader: ExperimentDeliveryReader;
  store: ExperimentDeliveryStore;
  clock?: { now(): Date };
  ttlMs: number;
  /** Hard bound for external readers; a timed out read can never create a receipt. */
  evaluationTimeoutMs: number;
  inspect?(event: ExperimentDeliveryInspection): void;
}>;

export class ExperimentDeliveryBridge {
  private inspectionFailures = 0;
  /** Synchronous inspector sink failures remain observable without changing business/render outcomes. */
  getInspectionFailureCount(): number {
    return this.inspectionFailures;
  }
  private readonly regions: ReadonlyMap<string, ExperimentRenderRegion>;
  private readonly clock: { now(): Date };
  constructor(private readonly options: ExperimentDeliveryOptions) {
    if (
      ![options.ttlMs, options.evaluationTimeoutMs].every((v) => Number.isSafeInteger(v) && v > 0)
    )
      throw new ExperimentProblem(
        "invalid",
        "Delivery TTL and evaluation bound must be positive milliseconds",
      );
    const regions = options.regions.map((region) => structuredClone(region));
    if (
      new Set(regions.map((r) => r.id)).size !== regions.length ||
      regions.some((r) => !r.id.trim() || !r.policyRevision.trim())
    )
      throw new ExperimentProblem(
        "invalid",
        "Render regions require unique ids and policy revisions",
      );
    this.regions = new Map(regions.map((r) => [r.id, r]));
    this.clock = options.clock ?? { now: () => new Date() };
  }

  /** Evaluate only the regions the route declares. Prefetch creates no display admission/exposure. */
  async prepare(
    regionIds: readonly string[],
    identity: ExperimentDeliveryIdentity,
    phase: "speculative" | "admitted",
    signal?: AbortSignal,
  ): Promise<readonly ExperimentRenderDecision[]> {
    if (
      !["speculative", "admitted"].includes(phase) ||
      new Set(regionIds).size !== regionIds.length
    )
      throw new ExperimentProblem("invalid", "Invalid delivery phase or duplicate region");
    const regions = regionIds.map((id) => {
      const region = this.regions.get(id);
      if (!region) throw new ExperimentProblem("invalid", "Render region is not registered");
      if (experimentHash(region.target.scope) !== experimentHash(identity.scope))
        throw new ExperimentProblem("forbidden", "Render region scope mismatch");
      return region;
    });
    const deliveryId = randomUUID();
    const results: {
      decision: ExperimentRenderDecision;
      reason: string;
      elapsedMs: number;
    }[] = [];
    for (const region of regions) {
      const started = performance.now();
      let reason = "assigned";
      const base = {
        region: region.id,
        deliveryId,
        policyRevision: region.policyRevision,
        experimentRevision: region.target.experimentRevision,
        phase,
        validUntil: new Date(this.clock.now().getTime() + this.options.ttlMs).toISOString(),
      };
      let decision: ExperimentRenderDecision = { ...base, status: "fallback" };
      try {
        if (signal?.aborted) throw new ExperimentProblem("unavailable", "Delivery aborted");
        const input = { ...region.target, ...identity };
        const result = await this.bounded(() => this.options.reader.assign(input), signal);
        if (result.status !== "assigned") reason = result.reason;
        else {
          assertExperimentOwnership(result.assignment, identity.scope, identity.subject);
          if (
            experimentHash(result.assignment.scope) !== experimentHash(region.target.scope) ||
            result.assignment.experimentId !== region.target.experimentId ||
            result.assignment.experimentRevision !== region.target.experimentRevision
          )
            throw new ExperimentProblem("conflict", "Assignment target mismatch");
          let admitted: ExperimentAssignmentResult = result;
          if (phase === "admitted")
            admitted = await this.bounded(
              () =>
                this.options.reader.admitDisplay({ ...input, assignmentId: result.assignment.id }),
              signal,
            );
          if (admitted.status !== "assigned") reason = admitted.reason;
          else {
            if (experimentHash(admitted.assignment) !== experimentHash(result.assignment))
              throw new ExperimentProblem("conflict", "Admission changed frozen assignment");
            if (signal?.aborted || Date.parse(base.validUntil) <= this.clock.now().getTime())
              throw new ExperimentProblem("unavailable", "Delivery expired or aborted");
            const token = randomUUID();
            decision = Object.freeze({
              ...base,
              status: "assigned",
              variant: result.assignment.variant,
              value: result.assignment.value,
              receipt: token,
            });
            await this.options.store.create(token, {
              decision,
              assignment: result.assignment,
            });
            if (signal?.aborted || Date.parse(base.validUntil) <= this.clock.now().getTime())
              throw new ExperimentProblem(
                "unavailable",
                "Delivery expired or aborted during persistence",
              );
          }
        }
      } catch {
        reason = signal?.aborted ? "aborted" : "reader_or_receipt_unavailable";
        decision = { ...base, status: "fallback" };
      }
      results.push({ decision, reason, elapsedMs: performance.now() - started });
    }
    // Later regions may await readers/persistence after an earlier decision was prepared.
    // Only expose decisions valid for the completed delivery envelope.
    const now = this.clock.now().getTime();
    return Object.freeze(
      results.map(({ decision, reason, elapsedMs }) => {
        if (signal?.aborted || Date.parse(decision.validUntil) <= now) {
          reason = signal?.aborted ? "aborted" : "expired";
          decision = {
            ...decision,
            status: "fallback",
            receipt: undefined,
            variant: undefined,
            value: undefined,
          };
        }
        this.inspect({
          stage: "decision",
          region: decision.region,
          status: decision.status,
          reason,
          elapsedMs,
          phase,
        });
        return Object.freeze(decision);
      }),
    );
  }

  /** Private request envelope for HTML/Flight. Render callbacks must use only the supplied frozen decisions. */
  async render(
    regionIds: readonly string[],
    identity: ExperimentDeliveryIdentity,
    request: Request,
    render: (decisions: readonly ExperimentRenderDecision[]) => Promise<Response>,
    phase: "speculative" | "admitted" = "admitted",
  ): Promise<Response> {
    const decisions = await this.prepare(regionIds, identity, phase, request.signal);
    const response = await render(decisions);
    const headers = new Headers(response.headers);
    headers.set("cache-control", "private, no-store");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  /** Consume prefetch at the current authenticated scope; never choose another variant. */
  async admit(
    token: string,
    identity: ExperimentDeliveryIdentity,
    signal?: AbortSignal,
  ): Promise<ExperimentRenderDecision> {
    const receipt = await this.owned(token, identity);
    const original = receipt.decision;
    const region = this.regions.get(original.region);
    if (
      !region ||
      region.policyRevision !== original.policyRevision ||
      experimentKey(region.target) !== experimentKey(receipt.assignment)
    )
      throw new ExperimentProblem("unavailable", "Delivery policy revision is unavailable");
    if (signal?.aborted || Date.parse(original.validUntil) <= this.clock.now().getTime())
      return Object.freeze({
        ...original,
        status: "fallback",
        receipt: undefined,
        variant: undefined,
        value: undefined,
      });
    const result = await this.bounded(
      () =>
        this.options.reader.admitDisplay({
          ...receipt.assignment,
          ...identity,
          assignmentId: receipt.assignment.id,
        }),
      signal,
    );
    if (result.status !== "assigned")
      return Object.freeze({
        ...original,
        status: "fallback",
        receipt: undefined,
        variant: undefined,
        value: undefined,
      });
    if (experimentHash(result.assignment) !== experimentHash(receipt.assignment))
      throw new ExperimentProblem("conflict", "Admission changed frozen assignment");
    if (signal?.aborted || Date.parse(original.validUntil) <= this.clock.now().getTime())
      return Object.freeze({
        ...original,
        status: "fallback",
        receipt: undefined,
        variant: undefined,
        value: undefined,
      });
    // New opaque receipt proves this delivery was admitted. Speculative tokens remain unreportable.
    const admittedToken = randomUUID();
    const decision = Object.freeze({
      ...original,
      phase: "admitted" as const,
      receipt: admittedToken,
    });
    await this.options.store.create(admittedToken, {
      ...receipt,
      decision,
    });
    if (signal?.aborted || Date.parse(original.validUntil) <= this.clock.now().getTime())
      return Object.freeze({
        ...original,
        status: "fallback",
        receipt: undefined,
        variant: undefined,
        value: undefined,
      });
    return decision;
  }

  /** Historical reports resolve the original assignment, even after pause, expiry or publication rollback. */
  async expose(
    token: string,
    identity: ExperimentDeliveryIdentity,
    displayInstanceId: string,
    occurredAt: string,
  ): Promise<ExperimentExposure> {
    const receipt = await this.owned(token, identity);
    if (receipt.decision.phase !== "admitted")
      throw new ExperimentProblem("forbidden", "Speculative delivery was not admitted");
    if (
      typeof displayInstanceId !== "string" ||
      !displayInstanceId.trim() ||
      displayInstanceId.length > 200
    )
      throw new ExperimentProblem("invalid", "Display instance identity is required");
    const started = performance.now();
    try {
      const exposure = await this.options.reader.recordExposure({
        ...receipt.assignment,
        ...identity,
        assignmentId: receipt.assignment.id,
        deliveryInstanceId: JSON.stringify([
          receipt.decision.deliveryId,
          receipt.decision.region,
          displayInstanceId,
        ]),
        occurredAt,
        kind: "display",
      });
      this.inspect({
        stage: "exposure",
        region: receipt.decision.region,
        status: "assigned",
        reason: "display_recorded",
        elapsedMs: performance.now() - started,
        phase: "admitted",
      });
      return exposure;
    } catch (error) {
      this.inspect({
        stage: "exposure",
        region: receipt.decision.region,
        status: "assigned",
        reason: "display_recording_failed",
        elapsedMs: performance.now() - started,
        phase: "admitted",
      });
      throw error;
    }
  }
  private async owned(
    token: string,
    identity: ExperimentDeliveryIdentity,
  ): Promise<ExperimentDeliveryReceipt> {
    const receipt = typeof token === "string" ? await this.options.store.read(token) : undefined;
    if (!receipt) throw new ExperimentProblem("forbidden", "Unknown delivery receipt");
    assertExperimentOwnership(receipt.assignment, identity.scope, identity.subject);
    return receipt;
  }
  private inspect(event: ExperimentDeliveryInspection): void {
    try {
      this.options.inspect?.(Object.freeze(event));
    } catch {
      this.inspectionFailures += 1;
    }
  }
  private async bounded<T>(read: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;
    const stopped = new Promise<never>((_, reject) => {
      onAbort = () => reject(new ExperimentProblem("unavailable", "Delivery read aborted"));
      if (signal?.aborted) onAbort();
      else signal?.addEventListener("abort", onAbort, { once: true });
      timer = setTimeout(
        () => reject(new ExperimentProblem("unavailable", "Delivery reader deadline exceeded")),
        this.options.evaluationTimeoutMs,
      );
    });
    try {
      return await Promise.race([read(), stopped]);
    } finally {
      clearTimeout(timer);
      if (onAbort) signal?.removeEventListener("abort", onAbort);
    }
  }
}

/** Public fragment projection deliberately excludes private delivery and receipt identities. */
export function experimentRegionFragment(decision: ExperimentRenderDecision): Readonly<{
  key: string;
  region: string;
  status: "assigned" | "fallback";
  variant?: string;
  value?: string | boolean | number;
}> {
  const content = {
    region: decision.region,
    status: decision.status,
    variant: decision.variant,
    value: decision.value,
  };
  return Object.freeze({
    ...content,
    key: experimentHash([content, decision.policyRevision, decision.experimentRevision]),
  });
}
