import { canonicalFactValue, FactHistoryProblem } from "@croco/analytics-core";
import type { FactHistoryService } from "@croco/analytics-core";
import {
  FactHistoryInputProblem,
  validateFactHistoryComparison,
  validateFactHistoryCorrection,
} from "@croco/admin-core/fact-history-validation";
import type {
  FactHistoryOperations,
  FactHistoryPoint,
  FactHistorySnapshot,
} from "./FactHistoryValidation";

export function createFactHistoryOperations(
  service: FactHistoryService,
  actor: string,
): FactHistoryOperations {
  if (!actor.trim()) throw new FactHistoryInputProblem("actor");
  return {
    async compare(request) {
      validateFactHistoryComparison(request);
      try {
        const revision = await service.getRevision(request);
        const [before, after, rows] = await Promise.all([
          service.readFactsAt(request),
          service.readFactsAt({
            ...request,
            effectiveAt: request.compareEffectiveAt,
            knownAt: request.compareKnownAt,
          }),
          service.readHistory({
            ...request,
            knownAt: new Date(
              Math.max(Date.parse(request.knownAt), Date.parse(request.compareKnownAt)),
            ).toISOString(),
            limit: 1000,
          }),
        ]);
        if (revision !== (await service.getRevision(request))) {
          throw new FactHistoryProblem(
            "revision-conflict",
            "History changed during comparison; compare again.",
          );
        }
        const point = (result: typeof before): FactHistoryPoint => ({
          status: result.status,
          ...(result.value === undefined ? {} : { value: canonicalFactValue(result.value) }),
          provenance: result.provenance.map((row) => row.id),
        });
        const snapshot: FactHistorySnapshot = {
          request,
          revision,
          before: point(before),
          after: point(after),
          rows: rows
            .slice(0, request.limit)
            .map((row) => ({ ...row, value: canonicalFactValue(row.value) })),
        };
        return {
          kind: rows.length === 0 ? "empty" : rows.length > request.limit ? "partial" : "ready",
          snapshot,
        };
      } catch (error) {
        if (error instanceof FactHistoryProblem && error.code === "analytics/fact-history/denied")
          return { kind: "denied", code: error.code };
        throw error;
      }
    },
    async correct(request) {
      validateFactHistoryCorrection(request);
      if (request.actor !== actor) throw new FactHistoryInputProblem("actor");
      const history = await service.readHistory({ ...request, limit: 1000 });
      const original = history.find((row) => row.id === request.rowId);
      if (!original) throw new FactHistoryInputProblem("rowId");
      const digest = await globalThis.crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(
          canonicalFactValue({
            rowId: request.rowId,
            value: request.value,
            validFrom: request.validFrom,
            reason: request.reason,
            source: request.source,
            actor,
            expectedRevision: request.expectedRevision,
            idempotencyKey: request.idempotencyKey,
          }),
        ),
      );
      const sourceFingerprint = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      const result = await service.appendFact({
        scope: request.scope,
        source: request.source,
        sourceEventId: request.idempotencyKey,
        sourceFingerprint,
        correction: {
          actor,
          reason: request.reason,
          expectedRevision: request.expectedRevision,
          idempotencyKey: request.idempotencyKey,
        },
        row: {
          subject: request.subject,
          definitionId: request.definitionId,
          definitionVersion: request.definitionVersion,
          projectionId: original.projectionId,
          projectionRowKey: original.projectionRowKey,
          materializationRevision: request.materializationRevision,
          value: request.value,
          validFrom: request.validFrom,
          ...(original.validTo ? { validTo: original.validTo } : {}),
          supersedes: original.id,
        },
      });
      return { revision: result.revision, auditId: request.idempotencyKey };
    },
  };
}
