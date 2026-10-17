import { AcquisitionProblem } from "@croco/analytics-core/acquisition";
import type {
  AcquisitionComparison,
  AcquisitionScope,
  AcquisitionService,
} from "@croco/analytics-core/acquisition";

export type AcquisitionInspectorState =
  | { readonly kind: "loading" | "empty" | "denied" | "error" | "partial" }
  | { readonly kind: "ready"; readonly comparison: AcquisitionComparison };
/** Authentication is supplied by the application's service policy; scope is server-bound. */
export function createAcquisitionOperations(service: AcquisitionService, scope: AcquisitionScope) {
  return {
    async compare(
      input: Omit<Parameters<AcquisitionService["compare"]>[0], "scope">,
    ): Promise<AcquisitionInspectorState> {
      try {
        const comparison = await service.compare({ ...input, scope });
        return comparison.touchpoints.length || comparison.declarations.length
          ? { kind: "ready", comparison }
          : { kind: "empty" };
      } catch (cause) {
        if (cause instanceof AcquisitionProblem && cause.code === "analytics/acquisition/denied")
          return { kind: "denied" };
        if (cause instanceof AcquisitionProblem && cause.code === "analytics/acquisition/limit")
          return { kind: "partial" };
        throw cause;
      }
    },
  };
}
