import type {
  DesktopContractGraphCommand,
  DesktopContractGraphEvent,
  DesktopContractGraphV1,
  DesktopContractGraphWindow,
  DesktopContractHandshakeV1,
} from "@croco/protocols-desktop";
import { createDesktopContractHandshake } from "./DesktopGeneratedMetadata";
import { generateDesktopPreloadBridges } from "./generateDesktopPreloadBridges";
import { generateDesktopRendererClients } from "./generateDesktopRendererClients";

export type DesktopMainRegistrationMetadataVersion = "croco.desktop-main-registration.v1";

export type DesktopMainCommandRegistration = Pick<
  DesktopContractGraphCommand,
  "id" | "contractId" | "key" | "kind"
>;

export type DesktopMainEventRegistration = Pick<
  DesktopContractGraphEvent,
  "id" | "contractId" | "key"
>;

export type DesktopMainWindowRegistration = {
  readonly id: string;
  readonly trust: DesktopContractGraphWindow["trust"];
  readonly originPolicy: DesktopContractGraphWindow["originPolicy"];
  readonly exposedCommandIds: readonly string[];
  readonly receivedEventIds: readonly string[];
};

export type DesktopMainPreloadRegistration = {
  readonly windowId: string;
  readonly relativePath: string;
  readonly installerExport: "installDesktopPreloadBridge";
  readonly metadataExport: "desktopContractMetadata";
};

export type DesktopGeneratedOutputMetadata =
  | {
      readonly kind: "contract-graph";
      readonly relativePath: "desktop-contract-graph.json";
    }
  | {
      readonly kind: "main-registration";
      readonly relativePath: "desktop-main-registration.json";
    }
  | {
      readonly kind: "preload-bridge";
      readonly windowId: string;
      readonly relativePath: string;
      readonly publicExport: "installDesktopPreloadBridge";
      readonly metadataExport: "desktopContractMetadata";
    }
  | {
      readonly kind: "renderer-client";
      readonly windowId: string;
      readonly relativePath: string;
      readonly publicExport: "desktop";
      readonly metadataExport: "desktopContractMetadata";
    };

export type DesktopMainRegistrationMetadataV1 = {
  readonly version: DesktopMainRegistrationMetadataVersion;
  readonly handshake: DesktopContractHandshakeV1;
  readonly commands: readonly DesktopMainCommandRegistration[];
  readonly events: readonly DesktopMainEventRegistration[];
  readonly windows: readonly DesktopMainWindowRegistration[];
  readonly preloads: readonly DesktopMainPreloadRegistration[];
  readonly outputs: readonly DesktopGeneratedOutputMetadata[];
};

export function generateDesktopMainRegistrationMetadata(
  graph: DesktopContractGraphV1,
): DesktopMainRegistrationMetadataV1 {
  const preloadArtifacts = generateDesktopPreloadBridges(graph);
  const rendererArtifacts = generateDesktopRendererClients(graph);

  return {
    version: "croco.desktop-main-registration.v1",
    handshake: createDesktopContractHandshake(graph),
    commands: [...graph.commands].sort(compareById).map(({ id, contractId, key, kind }) => ({
      id,
      contractId,
      key,
      kind,
    })),
    events: [...graph.events].sort(compareById).map(({ id, contractId, key }) => ({
      id,
      contractId,
      key,
    })),
    windows: [...graph.windows].sort(compareById).map(toWindowRegistration),
    preloads: preloadArtifacts.map(({ windowId, relativePath }) => ({
      windowId,
      relativePath,
      installerExport: "installDesktopPreloadBridge",
      metadataExport: "desktopContractMetadata",
    })),
    outputs: [
      { kind: "contract-graph", relativePath: "desktop-contract-graph.json" },
      { kind: "main-registration", relativePath: "desktop-main-registration.json" },
      ...preloadArtifacts.map(({ windowId, relativePath }) => ({
        kind: "preload-bridge" as const,
        windowId,
        relativePath,
        publicExport: "installDesktopPreloadBridge" as const,
        metadataExport: "desktopContractMetadata" as const,
      })),
      ...rendererArtifacts.map(({ windowId, relativePath }) => ({
        kind: "renderer-client" as const,
        windowId,
        relativePath,
        publicExport: "desktop" as const,
        metadataExport: "desktopContractMetadata" as const,
      })),
    ],
  };
}

export function stringifyDesktopMainRegistrationMetadata(
  metadata: DesktopMainRegistrationMetadataV1,
): string {
  return `${JSON.stringify(metadata, null, 2)}\n`;
}

function toWindowRegistration(window: DesktopContractGraphWindow): DesktopMainWindowRegistration {
  return {
    id: window.id,
    trust: window.trust,
    originPolicy:
      window.originPolicy.mode === "remote-allowlist"
        ? {
            ...window.originPolicy,
            allowedOrigins: [...window.originPolicy.allowedOrigins].sort(compareCodeUnits),
          }
        : window.originPolicy,
    exposedCommandIds: [...window.exposedCommands].sort(compareCodeUnits),
    receivedEventIds: [...window.receivedEvents].sort(compareCodeUnits),
  };
}

function compareById(left: { readonly id: string }, right: { readonly id: string }): number {
  return compareCodeUnits(left.id, right.id);
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
