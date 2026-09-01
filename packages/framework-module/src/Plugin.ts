import type { RuntimePlatform } from "@croco/framework-context";
import type { ModuleOptions, ModuleProviderDefinition } from "./types";

export type CrocoPluginMaturity = "alpha" | "beta" | "production" | "deprecated";

export type CrocoPluginCapability = {
  readonly id: string;
  readonly kind: "single" | "multi";
};

export type CrocoPluginConfigurationRequirement = {
  readonly key: string;
  readonly required: boolean;
  readonly sensitive?: boolean;
  readonly description?: string;
};

export type CrocoPluginVerificationReference = {
  readonly command: string;
  readonly reference: string;
};

export type CrocoPluginMetadata = {
  readonly name: string;
  readonly packageName: string;
  readonly maturity: CrocoPluginMaturity;
  readonly providedContracts: readonly string[];
  readonly capabilities: readonly CrocoPluginCapability[];
  readonly runtimeCompatibility: readonly RuntimePlatform[];
  readonly configuration: readonly CrocoPluginConfigurationRequirement[];
  readonly verification: readonly CrocoPluginVerificationReference[];
  readonly examples: readonly string[];
};

export type CrocoPlugin = {
  readonly kind: "croco.plugin";
  readonly metadata: CrocoPluginMetadata;
  readonly modules: readonly ModuleOptions[];
};

export type PluginFactory<TOptions> = (options: TOptions) => CrocoPlugin;

export type ApplicationProviderReplacement<T = unknown> = {
  readonly provider: ModuleProviderDefinition<T>;
  /** Exact module owners intentionally superseded by the application. */
  readonly replaces: readonly string[];
};

export type CrocoApplicationImport = ModuleOptions | CrocoPlugin;

export type CrocoApplicationDefinition = {
  readonly kind: "croco.application";
  readonly name: string;
  readonly imports: readonly CrocoApplicationImport[];
  readonly providerReplacements: readonly ApplicationProviderReplacement[];
};

export type DefineCrocoApplicationOptions = {
  readonly name?: string;
  readonly imports: readonly CrocoApplicationImport[];
  readonly providerReplacements?: readonly ApplicationProviderReplacement[];
};

export function defineCrocoPlugin(plugin: Omit<CrocoPlugin, "kind">): CrocoPlugin {
  return Object.freeze({
    kind: "croco.plugin" as const,
    metadata: freezePluginMetadata(plugin.metadata),
    modules: Object.freeze([...plugin.modules]),
  });
}

export function defineCrocoApplication(
  options: DefineCrocoApplicationOptions,
): CrocoApplicationDefinition {
  return Object.freeze({
    kind: "croco.application" as const,
    name: options.name ?? "application",
    imports: Object.freeze([...options.imports]),
    providerReplacements: Object.freeze(
      (options.providerReplacements ?? []).map((replacement) =>
        Object.freeze({
          provider: Object.freeze({ ...replacement.provider }),
          replaces: Object.freeze([...replacement.replaces]),
        }),
      ),
    ),
  });
}

export function isCrocoApplicationDefinition(value: unknown): value is CrocoApplicationDefinition {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    value.kind === "croco.application"
  );
}

export function resolveApplicationModules(
  application: CrocoApplicationDefinition,
): readonly ModuleOptions[] {
  return application.imports.flatMap((entry) => (isCrocoPlugin(entry) ? entry.modules : [entry]));
}

export function resolveApplicationPlugins(
  application: CrocoApplicationDefinition,
): readonly CrocoPlugin[] {
  return application.imports.filter(isCrocoPlugin);
}

function isCrocoPlugin(value: CrocoApplicationImport): value is CrocoPlugin {
  return "kind" in value && value.kind === "croco.plugin";
}

function freezePluginMetadata(metadata: CrocoPluginMetadata): CrocoPluginMetadata {
  return Object.freeze({
    ...metadata,
    providedContracts: Object.freeze([...metadata.providedContracts]),
    capabilities: Object.freeze(
      metadata.capabilities.map((capability) => Object.freeze({ ...capability })),
    ),
    runtimeCompatibility: Object.freeze([...metadata.runtimeCompatibility]),
    configuration: Object.freeze(
      metadata.configuration.map((requirement) => Object.freeze({ ...requirement })),
    ),
    verification: Object.freeze(
      metadata.verification.map((reference) => Object.freeze({ ...reference })),
    ),
    examples: Object.freeze([...metadata.examples]),
  });
}
