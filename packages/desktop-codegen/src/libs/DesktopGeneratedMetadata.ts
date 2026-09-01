import { createHash } from "node:crypto";

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
  return `${surface}/window-${hashWindowId(windowId)}.generated.ts`;
}

export function assertUniqueDesktopGeneratedSourcePaths(
  artifacts: readonly { readonly windowId: string; readonly relativePath: string }[],
  createProblem: (detail: string) => Error,
): void {
  const windowByPath = new Map<string, string>();
  for (const artifact of artifacts) {
    const existingWindowId = windowByPath.get(artifact.relativePath);
    if (existingWindowId !== undefined) {
      throw createProblem(
        `Generated desktop output path ${JSON.stringify(artifact.relativePath)} is shared by windows ${JSON.stringify(existingWindowId)} and ${JSON.stringify(artifact.windowId)}.`,
      );
    }
    windowByPath.set(artifact.relativePath, artifact.windowId);
  }
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

function hashWindowId(value: string): string {
  const codeUnits = Array.from({ length: value.length }, (_, index) =>
    value.charCodeAt(index).toString(16).padStart(4, "0"),
  ).join("");
  return createHash("sha256").update(codeUnits, "ascii").digest("hex");
}
