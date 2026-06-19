import type {
  KnownRuntimePlatform,
  RuntimeCapabilities,
  RuntimeCapabilityName,
  RuntimePlatform,
} from "./types";

export const RUNTIME_PLATFORMS = [
  "node",
  "lambda",
  "cloudflare-workers",
] as const satisfies readonly KnownRuntimePlatform[];

export const RUNTIME_CAPABILITY_NAMES = [
  "env",
  "filesystem",
  "logger",
  "nodeApi",
  "requestLifecycle",
  "trace",
  "waitUntil",
  "flush",
  "shutdown",
] as const satisfies readonly RuntimeCapabilityName[];

export const RUNTIME_CAPABILITY_SUPPORT = {
  node: {
    env: true,
    filesystem: true,
    logger: true,
    nodeApi: true,
    requestLifecycle: true,
    trace: true,
    waitUntil: false,
    flush: false,
    shutdown: false,
  },
  lambda: {
    env: true,
    filesystem: true,
    logger: true,
    nodeApi: true,
    requestLifecycle: true,
    trace: true,
    waitUntil: true,
    flush: true,
    shutdown: false,
  },
  "cloudflare-workers": {
    env: true,
    filesystem: false,
    logger: true,
    nodeApi: false,
    requestLifecycle: true,
    trace: true,
    waitUntil: true,
    flush: false,
    shutdown: false,
  },
} as const satisfies Record<KnownRuntimePlatform, RuntimeCapabilities>;

export type RuntimeCapabilitySupport = RuntimeCapabilities;

export type RuntimeCapabilitySupportMatrix = typeof RUNTIME_CAPABILITY_SUPPORT;

export type RuntimeCapabilitySupportForPlatform<TPlatform extends RuntimePlatform> =
  TPlatform extends KnownRuntimePlatform
    ? RuntimeCapabilitySupportMatrix[TPlatform]
    : RuntimeCapabilitySupport;

export type RuntimeCapabilitiesForPlatform<TPlatform extends RuntimePlatform> =
  TPlatform extends RuntimePlatform
    ? {
        readonly [TCapability in RuntimeCapabilityName]: RuntimeCapabilitySupportForPlatform<TPlatform>[TCapability] extends false
          ? false
          : boolean;
      }
    : never;

export type RuntimeCapabilityOverridesFor<TPlatform extends RuntimePlatform> = Partial<
  RuntimeCapabilitiesForPlatform<TPlatform>
>;

export type SupportedRuntimeCapabilityName<TPlatform extends RuntimePlatform> = {
  readonly [TCapability in RuntimeCapabilityName]: RuntimeCapabilitySupportForPlatform<TPlatform>[TCapability] extends false
    ? never
    : TCapability;
}[RuntimeCapabilityName];

export type UnsupportedRuntimeCapabilityName<TPlatform extends RuntimePlatform> = Exclude<
  RuntimeCapabilityName,
  SupportedRuntimeCapabilityName<TPlatform>
>;

export function isKnownRuntimePlatform(
  platform: RuntimePlatform,
): platform is KnownRuntimePlatform {
  return RUNTIME_PLATFORMS.includes(platform as KnownRuntimePlatform);
}

export function getRuntimeCapabilitySupport<TPlatform extends KnownRuntimePlatform>(
  platform: TPlatform,
): RuntimeCapabilitiesForPlatform<TPlatform> {
  return RUNTIME_CAPABILITY_SUPPORT[
    platform
  ] as unknown as RuntimeCapabilitiesForPlatform<TPlatform>;
}

export function isRuntimeCapabilitySupported(
  platform: RuntimePlatform,
  capability: RuntimeCapabilityName,
  capabilitySupport?: RuntimeCapabilitySupport,
): boolean {
  const support = isKnownRuntimePlatform(platform)
    ? RUNTIME_CAPABILITY_SUPPORT[platform]
    : capabilitySupport;

  return support?.[capability] ?? false;
}
