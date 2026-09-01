import { defineProblemRegistry, Problem, ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  compareDesktopContractHandshakes,
  compileDesktopContractGraph,
  computeDesktopContractSemanticHash,
  desktop,
  stringifyDesktopContractGraph,
} from "../index";
import type { DesktopContractGraphSourceLocations, DesktopContractHandshakeV1 } from "../index";

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
    expect(computeDesktopContractSemanticHash(graph)).toBe(graph.semanticHash);
  });

  it("covers schemas, Problems, effects, events, grants, and window exposure in the semantic hash", () => {
    const fixtureGraph = compileDesktopContractGraph(createFixtureApp(false));
    const { app, registry } = createProblemFixture();
    const problemGraph = compileDesktopContractGraph(app, { problemRegistries: [registry] });
    const command = fixtureGraph.commands[0];
    const window = fixtureGraph.windows.find((candidate) => candidate.id === "main");

    expect(command).toBeDefined();
    expect(window).toBeDefined();
    if (!command || !window) return;

    const changedHashes = [
      computeDesktopContractSemanticHash({
        ...fixtureGraph,
        commands: [
          { ...command, output: { ...command.output, descriptor: { kind: "string" } } },
          ...fixtureGraph.commands.slice(1),
        ],
      }),
      computeDesktopContractSemanticHash({ ...problemGraph, problems: [] }),
      computeDesktopContractSemanticHash({
        ...problemGraph,
        commands: problemGraph.commands.map((candidate) => ({ ...candidate, effects: [] })),
        effects: [],
      }),
      computeDesktopContractSemanticHash({ ...fixtureGraph, events: [] }),
      computeDesktopContractSemanticHash({ ...fixtureGraph, grants: [] }),
      computeDesktopContractSemanticHash({
        ...fixtureGraph,
        windows: fixtureGraph.windows.map((candidate) =>
          candidate.id === window.id ? { ...candidate, exposedCommands: [] } : candidate,
        ),
      }),
    ];

    expect(changedHashes).not.toContain(fixtureGraph.semanticHash);
    expect(changedHashes[1]).not.toBe(problemGraph.semanticHash);
    expect(changedHashes[2]).not.toBe(problemGraph.semanticHash);
  });

  it("excludes source locations and diagnostic prose from semantic hash recomputation", () => {
    const invalid = desktop.contract({
      commands: {
        unsafe: desktop.query({ input: z.unknown(), output: z.string() }),
      },
    });
    const graph = compileDesktopContractGraph(desktop.app({ contracts: { invalid }, windows: {} }));
    const changedEvidence = {
      ...graph,
      app: { ...graph.app, sourceLocation: { path: "/absolute/app.ts", line: 100 } },
      diagnostics: graph.diagnostics.map((diagnostic) => ({
        ...diagnostic,
        message: "different platform prose",
        recovery: "different recovery prose",
        sourceLocation: { path: "C:\\absolute\\contract.ts", line: 200 },
      })),
    };

    expect(computeDesktopContractSemanticHash(changedEvidence)).toBe(graph.semanticHash);
  });

  it("normalizes compiler-sorted inventories when recomputing semantic hashes", () => {
    const graph = compileDesktopContractGraph(createFixtureApp(false));
    const reordered = {
      ...graph,
      app: {
        ...graph.app,
        contractIds: [...graph.app.contractIds].reverse(),
        windowIds: [...graph.app.windowIds].reverse(),
      },
      contracts: [...graph.contracts].reverse().map((contract) => ({
        ...contract,
        commandIds: [...contract.commandIds].reverse(),
        eventIds: [...contract.eventIds].reverse(),
        grantIds: [...contract.grantIds].reverse(),
      })),
      commands: [...graph.commands].reverse().map((command) => ({
        ...command,
        effects: [...command.effects].reverse(),
        problems: [...command.problems].reverse(),
        events: [...command.events].reverse(),
      })),
      events: [...graph.events].reverse(),
      effects: [...graph.effects].reverse(),
      grants: [...graph.grants].reverse(),
      problems: [...graph.problems].reverse(),
      windows: [...graph.windows].reverse().map((candidate) => ({
        ...candidate,
        exposedCommands: [...candidate.exposedCommands].reverse(),
        receivedEvents: [...candidate.receivedEvents].reverse(),
      })),
      diagnostics: [...graph.diagnostics].reverse(),
    };

    expect(computeDesktopContractSemanticHash(reordered)).toBe(graph.semanticHash);
  });

  it("compares handshake metadata by handshake version, graph version, then semantic hash", () => {
    const expected: DesktopContractHandshakeV1 = {
      version: "croco.desktop-contract-handshake.v1",
      graphVersion: "croco.desktop-contract-graph.v1",
      semanticHash: "sha256:expected",
    };

    expect(compareDesktopContractHandshakes(expected, expected)).toEqual({ compatible: true });
    expect(
      compareDesktopContractHandshakes(expected, {
        ...expected,
        version: "croco.desktop-contract-handshake.v2",
      }),
    ).toMatchObject({ compatible: false, code: "DESKTOP_HANDSHAKE_VERSION_MISMATCH" });
    expect(
      compareDesktopContractHandshakes(expected, {
        ...expected,
        graphVersion: "croco.desktop-contract-graph.v2",
      }),
    ).toMatchObject({ compatible: false, code: "DESKTOP_GRAPH_VERSION_MISMATCH" });
    expect(
      compareDesktopContractHandshakes(expected, {
        ...expected,
        semanticHash: "sha256:actual",
      }),
    ).toMatchObject({ compatible: false, code: "DESKTOP_SEMANTIC_HASH_MISMATCH" });
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

  it("compiles command and effect Problems through supplied ProblemRegistry manifests", () => {
    class ProjectOpenProblem extends Problem {
      declare public readonly code: "EDITOR_PROJECT_OPEN_FAILED";
      declare public readonly category: ProblemCategory.Conflict;

      public constructor() {
        super("EDITOR_PROJECT_OPEN_FAILED", ProblemCategory.Conflict);
      }
    }
    class FilesystemUnavailableProblem extends Problem {
      declare public readonly code: "EDITOR_FILESYSTEM_UNAVAILABLE";
      declare public readonly category: ProblemCategory.InternalServerError;

      public constructor() {
        super("EDITOR_FILESYSTEM_UNAVAILABLE", ProblemCategory.InternalServerError);
      }
    }
    const projectOpenProblem = desktop.problem(ProjectOpenProblem, {
      code: "EDITOR_PROJECT_OPEN_FAILED",
      category: ProblemCategory.Conflict,
      extensions: z.object({ reason: z.string(), retryAfterMs: z.number().optional() }),
    });
    const filesystemUnavailableProblem = desktop.problem(FilesystemUnavailableProblem, {
      code: "EDITOR_FILESYSTEM_UNAVAILABLE",
      category: ProblemCategory.InternalServerError,
    });
    const filesystem = desktop.effect({
      namespace: "filesystem",
      access: "read",
      methods: { readText: desktop.effect.method<[reference: string], Promise<string>>() },
      problems: [filesystemUnavailableProblem],
    });
    const changed = desktop.event({ payload: z.object({ projectId: z.string() }) });
    const project = desktop.contract({
      commands: {
        open: desktop.mutation({
          input: z.object({ projectId: z.string() }),
          output: z.object({ opened: z.boolean() }),
          effects: [filesystem],
          events: ["changed"],
          problems: [projectOpenProblem],
        }),
      },
      events: { changed },
    });
    const registry = defineProblemRegistry({
      package: "@croco/editor",
      problems: {
        EDITOR_FILESYSTEM_UNAVAILABLE: {
          category: ProblemCategory.InternalServerError,
          retryable: true,
          public: false,
          redaction: "operator-only",
        },
        EDITOR_PROJECT_OPEN_FAILED: {
          category: ProblemCategory.Conflict,
          retryable: false,
          public: true,
          redaction: "safe",
        },
      },
    });

    const graph = compileDesktopContractGraph(
      desktop.app({ contracts: { project }, windows: {} }),
      { problemRegistries: [registry] },
    );

    expect(graph.commands[0]).toMatchObject({
      effects: [
        {
          namespace: "filesystem",
          access: "read",
          methods: ["readText"],
          grantIds: [],
        },
      ],
      events: ["project.changed"],
      problems: ["EDITOR_FILESYSTEM_UNAVAILABLE", "EDITOR_PROJECT_OPEN_FAILED"],
    });
    expect(graph.effects).toEqual(["filesystem"]);
    expect(graph.problems).toEqual([
      {
        code: "EDITOR_FILESYSTEM_UNAVAILABLE",
        category: ProblemCategory.InternalServerError,
        source: {
          package: "@croco/editor",
          retryable: true,
          retryability: "retryable",
          public: false,
          visibility: "private",
          redaction: "operator-only",
          cookbookPath: "/reference/problem-recovery-cookbook/#editor-filesystem-unavailable",
        },
      },
      {
        code: "EDITOR_PROJECT_OPEN_FAILED",
        category: ProblemCategory.Conflict,
        source: expect.objectContaining({ package: "@croco/editor" }),
        extensions: {
          kind: "object",
          unknownKeys: "reject",
          fields: [
            { name: "reason", required: true, schema: { kind: "string" } },
            {
              name: "retryAfterMs",
              required: false,
              schema: { kind: "optional", inner: { kind: "number" } },
            },
          ],
        },
      },
    ]);
    expect(graph.diagnostics).toEqual([]);
    const serialized = stringifyDesktopContractGraph(graph);
    expect(serialized).not.toContain("stack");
    expect(serialized).not.toContain("credential");
    expect(serialized).not.toContain("cause");
  });

  it("reports declared Problems missing from supplied registries", () => {
    const { app } = createProblemFixture();
    const graph = compileDesktopContractGraph(app);

    expect(graph.problems).toEqual([]);
    expect(graph.diagnostics).toEqual([
      expect.objectContaining({
        code: "DESKTOP_GRAPH_PROBLEM_REGISTRY_MISSING",
        contractMember: "project.open",
      }),
    ]);
  });

  it("reports invalid registries and incompatible duplicate Problem definitions", () => {
    const { app, registry } = createProblemFixture({ incompatibleDuplicate: true });
    const invalidRegistryGraph = compileDesktopContractGraph(app, {
      problemRegistries: [registry, registry],
    });
    expect(invalidRegistryGraph.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "DESKTOP_GRAPH_PROBLEM_REGISTRY_INVALID" }),
        expect.objectContaining({ code: "DESKTOP_GRAPH_PROBLEM_REGISTRY_MISSING" }),
      ]),
    );

    const incompatibleGraph = compileDesktopContractGraph(app, { problemRegistries: [registry] });
    expect(incompatibleGraph.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "DESKTOP_GRAPH_DUPLICATE_PROBLEM_CODE" }),
        expect.objectContaining({ code: "DESKTOP_GRAPH_PROBLEM_REGISTRY_MISMATCH" }),
      ]),
    );
    expect(incompatibleGraph.problems[0]).not.toHaveProperty("extensions");

    const reversed = createProblemFixture({
      incompatibleDuplicate: true,
      reverseDefinitions: true,
    });
    const reversedGraph = compileDesktopContractGraph(reversed.app, {
      problemRegistries: [reversed.registry],
    });
    expect(stringifyDesktopContractGraph(reversedGraph)).toBe(
      stringifyDesktopContractGraph(incompatibleGraph),
    );
    expect(reversedGraph.semanticHash).toBe(incompatibleGraph.semanticHash);
  });

  it("deduplicates compatible Problem definitions", () => {
    const { app, registry } = createProblemFixture();
    const graph = compileDesktopContractGraph(app, { problemRegistries: [registry] });

    expect(graph.problems).toHaveLength(1);
    expect(graph.diagnostics).toEqual([]);
  });

  it.each([
    "stackTrace",
    "filePath",
    "credential",
    "rootCause",
    "accessKey",
    "pathValue",
    "causedBy",
  ])("rejects the unsafe Problem extension field %s", (unsafeField) => {
    class UnsafeProblem extends Problem {
      declare public readonly code: "EDITOR_UNSAFE_FAILURE";

      public constructor() {
        super("EDITOR_UNSAFE_FAILURE", ProblemCategory.BadRequest);
      }
    }
    const registry = defineProblemRegistry({
      package: "@croco/editor",
      problems: {
        EDITOR_UNSAFE_FAILURE: {
          category: ProblemCategory.BadRequest,
          retryable: false,
          public: true,
          redaction: "public",
        },
      },
    });
    const unsafe = desktop.problem(UnsafeProblem, {
      code: "EDITOR_UNSAFE_FAILURE",
      category: ProblemCategory.BadRequest,
      extensions: z.object({ [unsafeField]: z.string() }),
    });
    const project = desktop.contract({
      commands: {
        open: desktop.query({ input: z.object({}), output: z.string(), problems: [unsafe] }),
      },
    });
    const graph = compileDesktopContractGraph(
      desktop.app({ contracts: { project }, windows: {} }),
      { problemRegistries: [registry] },
    );

    expect(graph.problems[0]).not.toHaveProperty("extensions");
    expect(graph.diagnostics).toEqual([
      expect.objectContaining({
        code: "DESKTOP_GRAPH_UNSAFE_PROBLEM_EXTENSION",
        schemaPath: [unsafeField],
      }),
    ]);
  });

  it.each(["stack", "accessKey", "pathValue", "causedBy"])(
    "rejects the nested unsafe Problem extension field %s",
    (unsafeField) => {
      class UnsafeProblem extends Problem {
        declare public readonly code: "EDITOR_UNSAFE_FAILURE";

        public constructor() {
          super("EDITOR_UNSAFE_FAILURE", ProblemCategory.BadRequest);
        }
      }
      const registry = defineProblemRegistry({
        package: "@croco/editor",
        problems: {
          EDITOR_UNSAFE_FAILURE: {
            category: ProblemCategory.BadRequest,
            retryable: false,
            public: true,
            redaction: "public",
          },
        },
      });
      const unsafe = desktop.problem(UnsafeProblem, {
        code: "EDITOR_UNSAFE_FAILURE",
        category: ProblemCategory.BadRequest,
        extensions: z.object({
          errors: z.array(z.object({ [unsafeField]: z.string() })),
        }),
      });
      const project = desktop.contract({
        commands: {
          open: desktop.query({ input: z.object({}), output: z.string(), problems: [unsafe] }),
        },
      });
      const graph = compileDesktopContractGraph(
        desktop.app({ contracts: { project }, windows: {} }),
        { problemRegistries: [registry] },
      );

      expect(graph.problems[0]).not.toHaveProperty("extensions");
      expect(graph.diagnostics).toEqual([
        expect.objectContaining({
          code: "DESKTOP_GRAPH_UNSAFE_PROBLEM_EXTENSION",
          schemaPath: ["errors", "[]", unsafeField],
        }),
      ]);
    },
  );

  it("rejects extension shapes for private operator-only Problems", () => {
    class PrivateProblem extends Problem {
      declare public readonly code: "EDITOR_PRIVATE_FAILURE";

      public constructor() {
        super("EDITOR_PRIVATE_FAILURE", ProblemCategory.InternalServerError);
      }
    }
    const registry = defineProblemRegistry({
      package: "@croco/editor",
      problems: {
        EDITOR_PRIVATE_FAILURE: {
          category: ProblemCategory.InternalServerError,
          retryable: false,
          public: false,
          redaction: "operator-only",
        },
      },
    });
    const failure = desktop.problem(PrivateProblem, {
      code: "EDITOR_PRIVATE_FAILURE",
      category: ProblemCategory.InternalServerError,
      extensions: z.object({ reason: z.string() }),
    });
    const project = desktop.contract({
      commands: {
        open: desktop.query({ input: z.object({}), output: z.string(), problems: [failure] }),
      },
    });
    const graph = compileDesktopContractGraph(
      desktop.app({ contracts: { project }, windows: {} }),
      { problemRegistries: [registry] },
    );

    expect(graph.problems[0]).not.toHaveProperty("extensions");
    expect(graph.diagnostics).toEqual([
      expect.objectContaining({
        code: "DESKTOP_GRAPH_UNSAFE_PROBLEM_EXTENSION",
        schemaPath: ["reason"],
      }),
    ]);
  });

  it("rethrows unexpected ProblemRegistry failures", () => {
    const { app, registry } = createProblemFixture();
    const unreadableRegistry = new Proxy(registry, {
      get() {
        throw new Error("registry read failed");
      },
    });

    expect(() =>
      compileDesktopContractGraph(app, { problemRegistries: [unreadableRegistry] }),
    ).toThrow("registry read failed");
  });
});

function createProblemFixture(
  options: {
    readonly incompatibleDuplicate?: boolean;
    readonly reverseDefinitions?: boolean;
  } = {},
) {
  class ProjectOpenProblem extends Problem {
    declare public readonly code: "EDITOR_PROJECT_OPEN_FAILED";

    public constructor() {
      super("EDITOR_PROJECT_OPEN_FAILED", ProblemCategory.Conflict);
    }
  }
  const declared = desktop.problem(ProjectOpenProblem, {
    code: "EDITOR_PROJECT_OPEN_FAILED",
    category: ProblemCategory.Conflict,
    extensions: z.object({ reason: z.string() }),
  });
  const duplicate = desktop.problem(ProjectOpenProblem, {
    code: "EDITOR_PROJECT_OPEN_FAILED",
    category: options.incompatibleDuplicate ? ProblemCategory.BadRequest : ProblemCategory.Conflict,
    extensions: options.incompatibleDuplicate
      ? z.object({ retryAfterMs: z.number() })
      : z.object({ reason: z.string() }),
  });
  const effect = desktop.effect({
    namespace: "filesystem",
    access: "read",
    methods: { readText: desktop.effect.method<[reference: string], Promise<string>>() },
    problems: [options.reverseDefinitions ? declared : duplicate],
  });
  const project = desktop.contract({
    commands: {
      open: desktop.query({
        input: z.object({ projectId: z.string() }),
        output: z.string(),
        effects: [effect],
        problems: [options.reverseDefinitions ? duplicate : declared],
      }),
    },
  });
  const registry = defineProblemRegistry({
    package: "@croco/editor",
    problems: {
      EDITOR_PROJECT_OPEN_FAILED: {
        category: ProblemCategory.Conflict,
        retryable: false,
        public: true,
        redaction: "safe",
      },
    },
  });
  return {
    app: desktop.app({ contracts: { project }, windows: {} }),
    registry,
  };
}

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
