import type { KnownRuntimePlatform, RuntimeCapabilityName } from "./types";

/** Runtime-neutral requirements; secretRef contains a locator, never a credential. */
export type InfrastructureRequirement = {
  readonly id: string;
  readonly kind: "database" | "queue" | "storage" | "secret";
  readonly capabilities: readonly InfrastructureCapability[];
  readonly scope: string;
  readonly owner: string;
  readonly optional?: boolean;
  readonly secretRef?: string;
};

export type InfrastructureCapability = "connect" | "read" | "write" | "enqueue" | "dequeue";

export type InfrastructureRequirements = {
  readonly schemaVersion: "croco.infrastructure-requirements/v1";
  readonly runtime: KnownRuntimePlatform;
  readonly runtimeCapabilities: readonly RuntimeCapabilityName[];
  readonly resources: readonly InfrastructureRequirement[];
};

/** Declares application/plugin needs. Validation belongs to the selected infrastructure profile. */
export function defineInfrastructureRequirements(
  requirements: Omit<InfrastructureRequirements, "schemaVersion">,
): InfrastructureRequirements {
  return {
    schemaVersion: "croco.infrastructure-requirements/v1",
    runtime: requirements.runtime,
    runtimeCapabilities: [...requirements.runtimeCapabilities],
    resources: requirements.resources.map((resource) => ({
      id: resource.id,
      kind: resource.kind,
      capabilities: [...resource.capabilities],
      scope: resource.scope,
      owner: resource.owner,
      ...(resource.optional === undefined ? {} : { optional: resource.optional }),
      ...(resource.secretRef === undefined ? {} : { secretRef: resource.secretRef }),
    })),
  };
}
