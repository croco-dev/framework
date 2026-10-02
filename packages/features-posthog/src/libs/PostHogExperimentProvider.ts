import type {
  DetailedEvaluation,
  ExperimentDefinition,
  ExperimentEvaluationProvider,
  ExperimentSubject,
  ExperimentTarget,
} from "@croco/features-core";
import type { PostHogClient } from "@croco/integrations-posthog";

/** The installed SDK exposes flag values but cannot attest detailed evaluation or flag revision. */
export class PostHogExperimentProvider implements ExperimentEvaluationProvider {
  constructor(
    private readonly client: PostHogClient,
    private readonly flag: string,
  ) {}

  previewDetailed(
    input: Parameters<ExperimentEvaluationProvider["evaluateDetailed"]>[0],
  ): Promise<DetailedEvaluation> {
    return this.evaluateDetailed(input);
  }

  async evaluateDetailed(
    input: ExperimentTarget & {
      readonly subject: ExperimentSubject;
      readonly definition: ExperimentDefinition;
    },
  ): Promise<DetailedEvaluation> {
    const matchesUnit =
      input.subject.kind === input.definition.unit ||
      (input.definition.unit === "anonymous" &&
        input.definition.loginPolicy === "switch-unit" &&
        input.subject.kind === "user");
    if (
      !input.subject.id.trim() ||
      !matchesUnit ||
      (input.subject.kind === "tenant" && input.subject.id !== input.scope.tenantId)
    ) {
      return { status: "not_assigned", reason: "stable_identity_required" };
    }
    const sdk = this.client.getClient();
    const providerMetadata = {
      provider: "posthog",
      sdkVersion: sdk.getLibraryVersion(),
      flag: this.flag,
      applicationRevision: input.experimentRevision,
    };
    try {
      const value = await sdk.getFeatureFlag(
        this.flag,
        JSON.stringify([input.scope, input.subject.kind, input.subject.id]),
        {
          groups: input.scope.tenantId ? { tenant: input.scope.tenantId } : undefined,
          sendFeatureFlagEvents: false,
        },
      );
      if (value === undefined || value === null) {
        return { status: "unavailable", reason: "provider_value_unavailable", providerMetadata };
      }
      return {
        status: "unavailable",
        reason: "detailed_metadata_unavailable",
        providerMetadata: { ...providerMetadata, observedValue: JSON.stringify(value) },
      };
    } catch {
      return { status: "evaluation_failed", reason: "provider_request_failed", providerMetadata };
    }
  }
}
