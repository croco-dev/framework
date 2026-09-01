import {
  compareDesktopContractHandshakes,
  compileDesktopContractGraph,
  desktop,
} from "@croco/protocols-desktop";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  generateDesktopMainRegistrationMetadata,
  generateDesktopPreloadBridges,
  generateDesktopRendererClients,
  stringifyDesktopMainRegistrationMetadata,
} from "../index";

describe("DesktopMainRegistrationMetadata", () => {
  it("generates byte-stable main registration and output metadata", () => {
    const graph = createGraph(false);
    const first = generateDesktopMainRegistrationMetadata(graph);
    const repeated = generateDesktopMainRegistrationMetadata(graph);
    const reordered = generateDesktopMainRegistrationMetadata({
      ...graph,
      commands: [...graph.commands].reverse(),
      contracts: [...graph.contracts].reverse(),
      events: [...graph.events].reverse(),
      windows: [...graph.windows].reverse(),
    });

    expect(repeated).toEqual(first);
    expect(reordered).toEqual(first);
    expect(stringifyDesktopMainRegistrationMetadata(repeated)).toBe(
      stringifyDesktopMainRegistrationMetadata(first),
    );
    expect(stringifyDesktopMainRegistrationMetadata(reordered)).toBe(
      stringifyDesktopMainRegistrationMetadata(first),
    );
    expect(first.version).toBe("croco.desktop-main-registration.v1");
    expect(first.handshake).toEqual({
      version: "croco.desktop-contract-handshake.v1",
      graphVersion: "croco.desktop-contract-graph.v1",
      semanticHash: graph.semanticHash,
    });
    expect(first.commands.map(({ id }) => id)).toEqual(["project.open", "system.status"]);
    expect(first.events.map(({ id }) => id)).toEqual(["project.changed"]);
    expect(first.windows.map(({ id }) => id)).toEqual(["login", "main", "settings"]);
    expect(first.preloads.map(({ windowId }) => windowId)).toEqual(["main", "settings"]);
    expect(first.outputs).toEqual([
      { kind: "contract-graph", relativePath: "desktop-contract-graph.json" },
      { kind: "main-registration", relativePath: "desktop-main-registration.json" },
      expect.objectContaining({
        kind: "preload-bridge",
        windowId: "main",
        publicExport: "installDesktopPreloadBridge",
      }),
      expect.objectContaining({ kind: "preload-bridge", windowId: "settings" }),
      expect.objectContaining({
        kind: "renderer-client",
        windowId: "main",
        publicExport: "desktop",
      }),
      expect.objectContaining({ kind: "renderer-client", windowId: "settings" }),
    ]);
  });

  it("embeds one versioned semantic identity in main, preload, and renderer artifacts", () => {
    const graph = createGraph(false);
    const main = generateDesktopMainRegistrationMetadata(graph);
    const preloads = generateDesktopPreloadBridges(graph);
    const renderers = generateDesktopRendererClients(graph);

    for (const artifact of [...preloads, ...renderers]) {
      expect(artifact.metadata.handshake).toEqual(main.handshake);
      expect(artifact.source).toContain("export const desktopContractMetadata");
      expect(artifact.source).toContain(JSON.stringify(graph.semanticHash));
      expect(artifact.source).toContain(JSON.stringify(artifact.windowId));
    }
    expect(preloads[0]?.metadata.surface).toBe("preload");
    expect(renderers[0]?.metadata.surface).toBe("renderer");
    expect(preloads[0]?.metadata).not.toEqual(renderers[0]?.metadata);
  });

  it("detects stale renderer and preload identities before command execution", () => {
    const current = createGraph(false);
    const stale = createGraph(true);
    const expected = generateDesktopMainRegistrationMetadata(current).handshake;
    const stalePreload = generateDesktopPreloadBridges(stale)[0]?.metadata.handshake;
    const staleRenderer = generateDesktopRendererClients(stale)[0]?.metadata.handshake;

    expect(stalePreload).toBeDefined();
    expect(staleRenderer).toBeDefined();
    if (!stalePreload || !staleRenderer) {
      throw new Error("Stale generated surface metadata is missing");
    }
    expect(compareDesktopContractHandshakes(expected, stalePreload)).toEqual({
      compatible: false,
      code: "DESKTOP_SEMANTIC_HASH_MISMATCH",
    });
    expect(compareDesktopContractHandshakes(expected, staleRenderer)).toEqual({
      compatible: false,
      code: "DESKTOP_SEMANTIC_HASH_MISMATCH",
    });
  });

  it("rejects semantic graph changes that retain a stale hash", () => {
    const graph = createGraph(false);
    const command = graph.commands[0];
    if (!command) {
      throw new Error("Fixture command is missing");
    }
    const forged = {
      ...graph,
      commands: graph.commands.map((candidate) =>
        candidate.id === command.id
          ? {
              ...candidate,
              output: { ...candidate.output, descriptor: { kind: "number" } as const },
            }
          : candidate,
      ),
    };

    for (const generate of [
      generateDesktopMainRegistrationMetadata,
      generateDesktopPreloadBridges,
      generateDesktopRendererClients,
    ]) {
      expect(() => generate(forged)).toThrow(/semantic hash mismatch/);
    }
  });

  it("uses unique traversal-safe relative output paths for portable window IDs", () => {
    const empty = desktop.window.local();
    const graph = compileDesktopContractGraph(
      desktop.app({
        contracts: {},
        windows: {
          "a/b": empty,
          "a\\b": empty,
          "C:": empty,
          CON: empty,
          유니코드: empty,
        },
      }),
    );
    const metadata = generateDesktopMainRegistrationMetadata(graph);
    const surfaceOutputs = metadata.outputs.filter(
      (output) => output.kind === "preload-bridge" || output.kind === "renderer-client",
    );
    const paths = surfaceOutputs.map(({ relativePath }) => relativePath);

    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toHaveLength(10);
    for (const path of paths) {
      expect(path).toMatch(/^(preload|renderer)\/window-[0-9a-f]+\.generated\.ts$/);
      expect(path).not.toContain("..");
      expect(path).not.toContain("\\");
      expect(path.startsWith("/")).toBe(false);
    }
  });

  it("omits source evidence, timestamps, and handwritten module paths from main metadata", () => {
    const graph = compileDesktopContractGraph(createApp(false), {
      sourceLocations: {
        app: { path: "/private/checkout/apps/editor/desktop.ts", line: 10 },
        "window:main": { path: "C:\\private\\checkout\\windows.ts", line: 20 },
      },
    });
    const serialized = stringifyDesktopMainRegistrationMetadata(
      generateDesktopMainRegistrationMetadata(graph),
    );

    expect(serialized).not.toContain("sourceLocation");
    expect(serialized).not.toContain("/private/checkout");
    expect(serialized).not.toContain("C:\\\\private");
    expect(serialized).not.toContain("timestamp");
    expect(serialized).not.toContain("handlerPath");
    expect(serialized).not.toContain("electron");
  });
});

function createGraph(stale: boolean) {
  return compileDesktopContractGraph(createApp(stale));
}

function createApp(stale: boolean) {
  const project = desktop.contract({
    commands: {
      open: desktop.mutation({
        input: z.object({ path: z.string() }),
        output: z.object({ opened: z.boolean() }),
      }),
    },
    events: {
      changed: desktop.event({ payload: z.object({ path: z.string() }) }),
    },
  });
  const system = desktop.contract({
    commands: {
      status: desktop.query({ input: z.object({}), output: z.object({ ready: z.boolean() }) }),
    },
  });

  return desktop.app({
    contracts: { project, system },
    windows: {
      main: desktop.window.local({
        expose: stale ? [project.commands.open, system.commands.status] : [project.commands.open],
        receive: [project.events.changed],
      }),
      settings: desktop.window.local({ expose: [system.commands.status] }),
      login: desktop.window.remote({
        initialUrl: "https://login.example.com",
        allowedOrigins: ["https://login.example.com"],
      }),
    },
  });
}
