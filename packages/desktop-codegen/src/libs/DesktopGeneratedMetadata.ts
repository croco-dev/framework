import type { DesktopContractGraphV1, DesktopContractHandshakeV1 } from "@croco/protocols-desktop";

export type DesktopGeneratedSurfaceMetadataVersion = "croco.desktop-generated-surface.v1";

export type DesktopGeneratedSurface = "preload" | "renderer";

export type DesktopGeneratedSurfaceMetadataV1 = {
  readonly version: DesktopGeneratedSurfaceMetadataVersion;
  readonly surface: DesktopGeneratedSurface;
  readonly windowId: string;
  readonly handshake: DesktopContractHandshakeV1;
};

export function createDesktopGeneratedSurfaceMetadata(
  graph: DesktopContractGraphV1,
  surface: DesktopGeneratedSurface,
  windowId: string,
): DesktopGeneratedSurfaceMetadataV1 {
  return {
    version: "croco.desktop-generated-surface.v1",
    surface,
    windowId,
    handshake: createDesktopContractHandshake(graph),
  };
}

export function createDesktopContractHandshake(
  graph: DesktopContractGraphV1,
): DesktopContractHandshakeV1 {
  return {
    version: "croco.desktop-contract-handshake.v1",
    graphVersion: graph.version,
    semanticHash: graph.semanticHash,
  };
}

export function createDesktopGeneratedSourcePath(
  surface: DesktopGeneratedSurface,
  windowId: string,
): string {
  return `${surface}/window-${encodeUtf8Hex(windowId)}.generated.ts`;
}

export function renderDesktopGeneratedSurfaceMetadata(
  metadata: DesktopGeneratedSurfaceMetadataV1,
): readonly string[] {
  return [
    "export const desktopContractMetadata = Object.freeze({",
    `  version: ${JSON.stringify(metadata.version)},`,
    `  surface: ${JSON.stringify(metadata.surface)},`,
    `  windowId: ${JSON.stringify(metadata.windowId)},`,
    "  handshake: Object.freeze({",
    `    version: ${JSON.stringify(metadata.handshake.version)},`,
    `    graphVersion: ${JSON.stringify(metadata.handshake.graphVersion)},`,
    `    semanticHash: ${JSON.stringify(metadata.handshake.semanticHash)},`,
    "  }),",
    "} as const);",
  ];
}

function encodeUtf8Hex(value: string): string {
  return [...new TextEncoder().encode(value)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
