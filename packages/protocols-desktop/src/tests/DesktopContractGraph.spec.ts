import { describe, expect, it } from "vitest";
import { z } from "zod";
import { compileDesktopContractGraph, desktop, stringifyDesktopContractGraph } from "../index";
import type { DesktopContractGraphSourceLocations } from "../index";

const POSIX_SOURCES: DesktopContractGraphSourceLocations = {
  app: { path: "/home/runner/framework/apps/editor/src/desktop.ts", line: 10 },
  "contract:project": {
    path: "/home/runner/framework/packages/editor/src/project.contract.ts",
    line: 12,
  },
  "project.changed.payload": {
    path: "/home/runner/framework/packages/editor/src/project.contract.ts",
    line: 18,
  },
  "project.open.input": {
    path: "/home/runner/framework/packages/editor/src/project.contract.ts",
    line: 22,
  },
  "project.open.output": {
    path: "/home/runner/framework/packages/editor/src/project.contract.ts",
    line: 23,
  },
  "window:main": { path: "/home/runner/framework/apps/editor/src/windows.ts", line: 7 },
};

const WINDOWS_SOURCES: DesktopContractGraphSourceLocations = Object.fromEntries(
  Object.entries(POSIX_SOURCES).map(([id, source]) => [
    id,
    {
      ...source,
      path: source.path
        .replace("/home/runner/framework/", "C:\\work\\framework\\")
        .replace(/\//g, "\\"),
    },
  ]),
);

describe("DesktopContractGraph", () => {
  it("computes the declared SHA-256 semantic digest without runtime-specific imports", () => {
    const graph = compileDesktopContractGraph(desktop.app({ contracts: {}, windows: {} }));

    expect(graph.semanticHash).toBe(
      "sha256:1802f6861221422ba8cda7c6051562587540bbb21433f0e4f3c3b8674dcaa222",
    );
  });

  it("compiles every desktop definition into explicit deterministic graph records", () => {
    const app = createFixtureApp(false);
    const graph = compileDesktopContractGraph(app, {
      sourceLocations: POSIX_SOURCES,
      sourceRoot: "/home/runner/framework",
    });

    expect(graph.version).toBe("croco.desktop-contract-graph.v1");
    expect(graph.commands).toEqual([
      expect.objectContaining({
        id: "project.open",
        kind: "mutation",
        effects: [],
        problems: [],
        events: [],
        executionPolicy: { mode: "request-response" },
        input: expect.objectContaining({
          descriptor: { kind: "grant-reference", grantId: "project.selectedFile" },
        }),
      }),
      expect.objectContaining({ id: "system.status", kind: "query" }),
    ]);
    expect(graph.events).toEqual([
      expect.objectContaining({ id: "project.changed" }),
      expect.objectContaining({ id: "system.ready" }),
    ]);
    expect(graph.grants).toEqual([
      expect.objectContaining({
        id: "project.selectedFile",
        resource: "file",
        access: "read",
        scope: "exact",
        lifetime: "command",
      }),
    ]);
    expect(graph.windows).toEqual([
      expect.objectContaining({
        id: "login",
        trust: "remote",
        originPolicy: {
          mode: "remote-allowlist",
          initialUrl: "https://login.example.com",
          allowedOrigins: ["https://accounts.example.com", "https://login.example.com"],
        },
        exposedCommands: [],
        receivedEvents: [],
      }),
      expect.objectContaining({
        id: "main",
        trust: "local",
        originPolicy: { mode: "local-content" },
        exposedCommands: ["project.open", "system.status"],
        receivedEvents: ["project.changed", "system.ready"],
      }),
    ]);
    expect(graph.effects).toEqual([]);
    expect(graph.problems).toEqual([]);
    expect(graph.diagnostics).toEqual([]);
  });

  it("produces identical canonical output for declaration-order and platform-path fixtures", () => {
    const posix = compileDesktopContractGraph(createFixtureApp(false), {
      sourceLocations: POSIX_SOURCES,
      sourceRoot: "/home/runner/framework",
    });
    const windows = compileDesktopContractGraph(createFixtureApp(true), {
      sourceLocations: WINDOWS_SOURCES,
      sourceRoot: "C:\\work\\framework",
    });

    expect(windows).toEqual(posix);
    expect(windows.semanticHash).toBe(posix.semanticHash);
    expect(stringifyDesktopContractGraph(windows)).toBe(stringifyDesktopContractGraph(posix));
    expect(stringifyDesktopContractGraph(posix)).toMatchSnapshot();
  });

  it("excludes source evidence from the semantic hash while preserving normalized locations", () => {
    const first = compileDesktopContractGraph(createFixtureApp(false), {
      sourceLocations: POSIX_SOURCES,
      sourceRoot: "/home/runner/framework",
    });
    const moved = compileDesktopContractGraph(createFixtureApp(false), {
      sourceLocations: {
        ...POSIX_SOURCES,
        "project.open.output": {
          path: "/different/checkout/packages/editor/src/project.contract.ts",
          line: 999,
          column: 42,
        },
      },
      sourceRoot: "/different/checkout",
    });

    expect(moved.semanticHash).toBe(first.semanticHash);
    expect(moved.commands[0]?.output.sourceLocation).toEqual({
      path: "packages/editor/src/project.contract.ts",
      line: 999,
      column: 42,
    });
  });

  it("retains unsupported-schema diagnostics as graph data", () => {
    const invalid = desktop.contract({
      commands: {
        unsafe: desktop.query({ input: z.object({ value: z.unknown() }), output: z.string() }),
      },
    });
    const graph = compileDesktopContractGraph(desktop.app({ contracts: { invalid }, windows: {} }));

    expect(graph.commands[0]?.input.descriptor).toBeNull();
    expect(graph.diagnostics).toEqual([
      expect.objectContaining({
        severity: "error",
        code: "DESKTOP_WIRE_SCHEMA_UNSUPPORTED",
        contractMember: "invalid.unsafe.input",
        schemaPath: ["value"],
        recovery: expect.any(String),
      }),
    ]);
  });

  it("sorts global records by full stable ID across punctuation boundaries", () => {
    const zed = desktop.contract({
      commands: { z: desktop.query({ input: z.object({}), output: z.string() }) },
    });
    const dashed = desktop.contract({
      commands: { x: desktop.query({ input: z.object({}), output: z.string() }) },
    });
    const graph = compileDesktopContractGraph(
      desktop.app({ contracts: { a: zed, "a-": dashed }, windows: {} }),
    );

    expect(graph.commands.map((command) => command.id)).toEqual(["a-.x", "a.z"]);
  });

  it("reports reused grant definitions as ambiguous graph data", () => {
    const shared = desktop.grant.file({ access: "read", scope: "exact", lifetime: "command" });
    const project = desktop.contract({
      grants: { first: shared, second: shared },
      commands: { read: desktop.query({ input: shared, output: z.string() }) },
    });
    const graph = compileDesktopContractGraph(desktop.app({ contracts: { project }, windows: {} }));

    expect(graph.commands[0]?.input.descriptor).toBeNull();
    expect(graph.diagnostics).toEqual([
      expect.objectContaining({
        code: "DESKTOP_GRAPH_AMBIGUOUS_GRANT_REFERENCE",
        contractMember: "project.read.input",
      }),
    ]);
  });

  it("preserves distinct source paths outside an explicit source root", () => {
    const app = desktop.app({ contracts: {}, windows: {} });
    const first = compileDesktopContractGraph(app, {
      sourceLocations: { app: { path: "/checkout/tools/a/desktop.ts" } },
    });
    const second = compileDesktopContractGraph(app, {
      sourceLocations: { app: { path: "/checkout/tools/b/desktop.ts" } },
    });

    expect(first.app.sourceLocation?.path).toBe("/checkout/tools/a/desktop.ts");
    expect(second.app.sourceLocation?.path).toBe("/checkout/tools/b/desktop.ts");
    expect(second.semanticHash).toBe(first.semanticHash);
  });
});

function createFixtureApp(reverse: boolean) {
  const selectedFile = desktop.grant.file({
    access: "read",
    scope: "exact",
    lifetime: "command",
  });
  const project = desktop.contract({
    commands: {
      open: desktop.mutation({ input: selectedFile, output: z.object({ opened: z.boolean() }) }),
    },
    events: {
      changed: desktop.event({ payload: z.object({ path: z.string() }) }),
    },
    grants: { selectedFile },
  });
  const system = desktop.contract({
    commands: {
      status: desktop.query({ input: z.object({}), output: z.object({ ready: z.boolean() }) }),
    },
    events: {
      ready: desktop.event({ payload: z.object({ at: z.number() }) }),
    },
  });
  const local = desktop.window.local({
    expose: reverse
      ? [system.commands.status, project.commands.open]
      : [project.commands.open, system.commands.status],
    receive: reverse
      ? [system.events.ready, project.events.changed]
      : [project.events.changed, system.events.ready],
  });
  const remote = desktop.window.remote({
    initialUrl: "https://login.example.com",
    allowedOrigins: reverse
      ? ["https://login.example.com", "https://accounts.example.com"]
      : ["https://accounts.example.com", "https://login.example.com"],
  });

  return desktop.app({
    contracts: reverse ? { system, project } : { project, system },
    windows: reverse ? { main: local, login: remote } : { login: remote, main: local },
  });
}
