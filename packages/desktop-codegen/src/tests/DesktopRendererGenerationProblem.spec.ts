import path from "node:path";

import { Problem, ProblemCategory, defineProblemRegistry } from "@croco/problems-core";
import { compileDesktopContractGraph, desktop } from "@croco/protocols-desktop";
import ts from "typescript";
import { assert, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { DesktopRendererGenerationProblem, generateDesktopRendererClients } from "../index";

type RuntimeClient = {
  readonly project: {
    readonly readFile: (
      input: { readonly path: string },
      options?: { readonly signal?: AbortSignal },
    ) => Promise<unknown>;
    readonly fileChanged: {
      readonly subscribe: (callback: (payload: { readonly path: string }) => void) => () => void;
    };
  };
};

describe("generateDesktopRendererClients", () => {
  it("generates deterministic typed clients for local window capabilities only", () => {
    const graph = createGraph(false);
    expect(graph.diagnostics).toEqual([]);
    const first = generateDesktopRendererClients(graph);
    const declarationReversed = createGraph(true);
    expect(declarationReversed.diagnostics).toEqual([]);
    const reordered = generateDesktopRendererClients({
      ...graph,
      commands: [...graph.commands].reverse(),
      contracts: [...graph.contracts].reverse(),
      events: [...graph.events].reverse(),
      grants: [...graph.grants].reverse(),
      problems: [...graph.problems].reverse(),
      windows: [...graph.windows].reverse(),
    });

    expect(generateDesktopRendererClients(declarationReversed)).toEqual(first);
    expect(reordered).toEqual(first);
    expect(first).toMatchSnapshot();
    expect(first.map((artifact) => artifact.windowId)).toEqual(["empty", "main", "settings"]);
    expect(first.some((artifact) => artifact.windowId === "login")).toBe(false);
    expect(first.find((artifact) => artifact.windowId === "empty")?.source).not.toContain(
      "import type",
    );
  });

  it("forwards AbortSignal without exposing timeout or raw command identifiers", async () => {
    const source = requireClientSource(createGraph(false), "main");
    const signal = new AbortController().signal;
    const readFile = vi.fn(async (_input: unknown, _options?: unknown) => ({
      ok: true,
      value: { contents: "Croco" },
    }));
    const runtime = executeGeneratedSource(source, {
      commands: {
        project: { openGranted: vi.fn(), readFile },
        system: { status: vi.fn() },
      },
      events: {
        project: { fileChanged: vi.fn() },
        system: { ready: vi.fn() },
      },
    });

    const options = { signal, timeoutMs: 60_000 };
    await runtime.project.readFile({ path: "README.md" }, options);

    expect(readFile).toHaveBeenCalledWith({ path: "README.md" }, { signal });
    expect(readFile.mock.calls[0]?.[1]).not.toHaveProperty("timeoutMs");
    expect(source).not.toContain("commandId");
    expect(source).not.toContain("channel");
    expect(source).not.toContain("timeoutMs");
    expect(source).not.toContain("ipcRenderer");
  });

  it("delivers payload-only event callbacks and returns the bridge unsubscriber", () => {
    const source = requireClientSource(createGraph(false), "main");
    const unsubscribe = vi.fn();
    const subscribe = vi.fn((callback: (payload: unknown, event: unknown) => void) => {
      callback({ path: "README.md" }, { sender: "electron" });
      return unsubscribe;
    });
    const runtime = executeGeneratedSource(source, {
      commands: {
        project: { openGranted: vi.fn(), readFile: vi.fn() },
        system: { status: vi.fn() },
      },
      events: {
        project: { fileChanged: subscribe },
        system: { ready: vi.fn() },
      },
    });
    const callback = vi.fn();

    const stop = runtime.project.fileChanged.subscribe(callback);

    expect(callback).toHaveBeenCalledWith({ path: "README.md" });
    expect(callback.mock.calls[0]).toHaveLength(1);
    stop();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("generates a fixture that enforces graph input, output, Problem, event, and option types", () => {
    const source = requireClientSource(createGraph(false), "main");
    const consumer = `
import { desktop } from './desktop.generated';

const signal = new AbortController().signal;
const result = await desktop.project.readFile({ path: 'README.md' }, { signal });
if (result.ok) {
  result.value.contents;
  result.value.encoding satisfies 'utf8' | 'utf16';
  // @ts-expect-error command outputs match the graph exactly
  result.value.forged;
} else {
  if (result.problem.code === 'EDITOR_FILE_NOT_FOUND') {
    result.problem.extensions?.reason;
  } else if (result.problem.code === 'EDITOR_FILESYSTEM_UNAVAILABLE') {
    // @ts-expect-error only the declared Problem exposes extensions
    result.problem.extensions;
  } else {
    result.problem satisfies never;
  }
}
desktop.project.fileChanged.subscribe((payload) => payload.path);

// @ts-expect-error generated commands do not accept caller-selected response generics
desktop.project.readFile<{ forged: true }>({ path: 'README.md' });
// @ts-expect-error callers cannot replace or expand the contract timeout
desktop.project.readFile({ path: 'README.md' }, { timeoutMs: 60_000 });
// @ts-expect-error raw command invocation is not part of the renderer client
desktop.invoke('project.readFile', { path: 'README.md' });
// @ts-expect-error command inputs match the graph exactly
desktop.project.readFile({ filePath: 'README.md' });
// @ts-expect-error opaque grant inputs cannot be replaced with raw strings
desktop.project.openGranted('/tmp/project.txt');
// @ts-expect-error event callbacks receive the declared payload, not Electron event objects
desktop.project.fileChanged.subscribe((_payload, _event) => undefined);
`;

    expectTypeScriptSourcesToCompile(
      new Map([
        ["/virtual/desktop.generated.ts", source],
        ["/virtual/consumer.ts", consumer],
      ]),
      ["/virtual/desktop.generated.ts", "/virtual/consumer.ts"],
    );
  });

  it("changes generated types when a stale graph schema differs", () => {
    const graph = createGraph(false);
    const current = requireClientSource(graph, "main");
    const readFile = graph.commands.find((command) => command.id === "project.readFile");
    assert(readFile, "Fixture readFile command is missing");
    const stale = requireClientSource(
      {
        ...graph,
        commands: graph.commands.map((command) =>
          command.id === readFile.id
            ? { ...command, output: { ...command.output, descriptor: { kind: "number" } } }
            : command,
        ),
      },
      "main",
    );

    expect(stale).not.toBe(current);
    expect(current).toContain('readonly ["contents"]: string');
    expect(stale).toContain("DesktopResult<number");
  });

  it("imports only the browser-safe protocols-desktop public entrypoint", () => {
    const source = requireClientSource(createGraph(false), "main");
    const imports = source.match(/^import .+$/gm);

    expect(imports).toEqual([
      "import type { DesktopGrantReference, DesktopResult } from '@croco/protocols-desktop';",
    ]);
    expect(source).not.toContain("@croco/problems-core");
    expect(source).not.toContain("electron");
  });

  it("rejects graph diagnostics and missing referenced records", () => {
    const graph = createGraph(false);
    const command = graph.commands.find((candidate) => candidate.id === "project.readFile");
    const grant = graph.grants.find((candidate) => candidate.resource === "file");
    assert(command, "Fixture readFile command is missing");
    assert(grant, "Fixture file grant is missing");

    expectGenerationProblem(
      () =>
        generateDesktopRendererClients({
          ...graph,
          diagnostics: [
            {
              severity: "error",
              code: "DESKTOP_GRAPH_MISSING_COMMAND_REFERENCE",
              targetKind: "window",
              contractMember: "main",
              memberId: "main",
              schemaPath: [],
              message: "missing",
              recovery: "declare it",
            },
          ],
        }),
      "Cannot generate renderer clients from a graph with 1 diagnostic.",
    );
    expectGenerationProblem(
      () =>
        generateDesktopRendererClients({
          ...graph,
          problems: graph.problems.filter((problem) => problem.code !== command.problems[0]),
        }),
      `Desktop member ${JSON.stringify(command.id)} references missing Problem ${JSON.stringify(command.problems[0])}.`,
    );
    expectGenerationProblem(
      () =>
        generateDesktopRendererClients({
          ...graph,
          grants: graph.grants.map((candidate) =>
            candidate.id === grant.id ? { ...candidate, scope: "descendant" } : candidate,
          ),
        }),
      `Desktop file grant ${JSON.stringify(grant.id)} must use exact scope.`,
    );
  });

  it("rejects inconsistent graph inventories and schema ownership", () => {
    const graph = createGraph(false);
    const project = graph.contracts.find((contract) => contract.id === "project");
    const readFile = graph.commands.find((command) => command.id === "project.readFile");
    assert(project && readFile, "Fixture project contract is incomplete");

    expectGenerationProblem(
      () =>
        generateDesktopRendererClients({
          ...graph,
          app: {
            ...graph.app,
            contractIds: graph.app.contractIds.filter((id) => id !== project.id),
          },
        }),
      "Desktop app contract inventory does not match its records.",
    );
    expectGenerationProblem(
      () =>
        generateDesktopRendererClients({
          ...graph,
          contracts: graph.contracts.map((contract) =>
            contract.id === project.id
              ? { ...contract, commandIds: [...contract.commandIds, "project.missing"] }
              : contract,
          ),
        }),
      `Desktop contract ${JSON.stringify(project.id)} command inventory does not match its records.`,
    );
    expectGenerationProblem(
      () =>
        generateDesktopRendererClients({
          ...graph,
          commands: graph.commands.map((command) =>
            command.id === readFile.id ? { ...command, contractId: "system" } : command,
          ),
        }),
      `Desktop contract ${JSON.stringify(project.id)} command inventory does not match its records.`,
    );
    expectGenerationProblem(
      () =>
        generateDesktopRendererClients({
          ...graph,
          commands: graph.commands.map((command) =>
            command.id === readFile.id
              ? { ...command, input: { ...command.input, id: "project.other.input" } }
              : command,
          ),
        }),
      `Desktop schema reference "project.other.input" must use owning member ID ${JSON.stringify(`${readFile.id}.input`)}.`,
    );
  });

  it("rejects non-string graph identifiers before indexing or rendering", () => {
    const graph = createGraph(false);
    const command = graph.commands[0];
    const effectCommand = graph.commands.find((candidate) => candidate.effects.length > 0);
    const event = graph.events[0];
    const grant = graph.grants[0];
    assert(command && effectCommand && event && grant, "Fixture graph members are missing");

    const invalidGraphs: readonly { graph: typeof graph; detail: string }[] = [
      {
        graph: {
          ...graph,
          version: BigInt(1) as unknown as typeof graph.version,
        },
        detail: "Expected croco.desktop-contract-graph.v1, received bigint.",
      },
      {
        graph: {
          ...graph,
          commands: graph.commands.map((candidate) =>
            candidate.id === command.id
              ? { ...candidate, id: undefined as unknown as string }
              : candidate,
          ),
        },
        detail: "Desktop command id must be a string, received undefined.",
      },
      {
        graph: {
          ...graph,
          commands: graph.commands.map((candidate) =>
            candidate.id === command.id
              ? { ...candidate, contractId: null as unknown as string }
              : candidate,
          ),
        },
        detail: "Desktop command contractId must be a string, received null.",
      },
      {
        graph: {
          ...graph,
          commands: graph.commands.map((candidate) =>
            candidate.id === command.id
              ? { ...candidate, key: undefined as unknown as string }
              : candidate,
          ),
        },
        detail: "Desktop command key must be a string, received undefined.",
      },
      {
        graph: {
          ...graph,
          commands: graph.commands.map((candidate) =>
            candidate.id === command.id
              ? {
                  ...candidate,
                  input: { ...candidate.input, id: BigInt(1) as unknown as string },
                }
              : candidate,
          ),
        },
        detail: "Desktop command input schema id must be a string, received bigint.",
      },
      {
        graph: {
          ...graph,
          events: graph.events.map((candidate) =>
            candidate.id === event.id
              ? {
                  ...candidate,
                  payload: { ...candidate.payload, id: BigInt(1) as unknown as string },
                }
              : candidate,
          ),
        },
        detail: "Desktop event payload schema id must be a string, received bigint.",
      },
      {
        graph: {
          ...graph,
          commands: graph.commands.map((candidate) =>
            candidate.id === command.id
              ? { ...candidate, problems: [BigInt(1) as unknown as string] }
              : candidate,
          ),
        },
        detail: "Desktop command Problem reference must be a string, received bigint.",
      },
      {
        graph: {
          ...graph,
          commands: graph.commands.map((candidate) =>
            candidate.id === effectCommand.id
              ? {
                  ...candidate,
                  effects: candidate.effects.map((effect) => ({
                    ...effect,
                    grantIds: [BigInt(1) as unknown as string],
                  })),
                }
              : candidate,
          ),
        },
        detail: "Desktop command grant reference must be a string, received bigint.",
      },
      {
        graph: {
          ...graph,
          windows: graph.windows.map((window, index) =>
            index === 0 ? { ...window, exposedCommands: [BigInt(1) as unknown as string] } : window,
          ),
        },
        detail: "Desktop window command reference must be a string, received bigint.",
      },
      {
        graph: {
          ...graph,
          events: graph.events.map((candidate) =>
            candidate.id === event.id ? { ...candidate, key: 1 as unknown as string } : candidate,
          ),
        },
        detail: "Desktop event key must be a string, received number.",
      },
      {
        graph: {
          ...graph,
          grants: graph.grants.map((candidate) =>
            candidate.id === grant.id
              ? { ...candidate, key: false as unknown as string }
              : candidate,
          ),
        },
        detail: "Desktop grant key must be a string, received boolean.",
      },
      {
        graph: {
          ...graph,
          contracts: graph.contracts.map((contract, index) =>
            index === 0 ? { ...contract, id: BigInt(1) as unknown as string } : contract,
          ),
        },
        detail: "Desktop contract id must be a string, received bigint.",
      },
    ];

    for (const invalid of invalidGraphs) {
      expectGenerationProblem(() => generateDesktopRendererClients(invalid.graph), invalid.detail);
    }
  });

  it("rejects forged capability discriminators before rendering", () => {
    const graph = createGraph(false);
    const grant = graph.grants[0];
    const problem = graph.problems[0];
    const remoteWindow = graph.windows.find((window) => window.trust === "remote");
    assert(grant && problem && remoteWindow, "Fixture capability records are missing");

    const invalidGraphs: readonly { graph: typeof graph; detail: string }[] = [
      {
        graph: {
          ...graph,
          windows: graph.windows.map((window) =>
            window.id === remoteWindow.id
              ? { ...window, trust: "forged" as unknown as typeof window.trust }
              : window,
          ),
        },
        detail: `Desktop window ${JSON.stringify(remoteWindow.id)} has an unsupported trust mode.`,
      },
      ...(
        [
          ["resource", "forged", "resource"],
          ["access", "forged", "access mode"],
          ["scope", "forged", "scope"],
          ["lifetime", "forged", "lifetime"],
        ] as const
      ).map(([field, value, description]) => ({
        graph: {
          ...graph,
          grants: graph.grants.map((candidate) =>
            candidate.id === grant.id ? { ...candidate, [field]: value } : candidate,
          ),
        } as typeof graph,
        detail: `Desktop grant ${JSON.stringify(grant.id)} has an unsupported ${description}.`,
      })),
      ...([undefined, "forged", BigInt(1)] as const).map((category) => ({
        graph: {
          ...graph,
          problems: graph.problems.map((candidate) =>
            candidate.code === problem.code
              ? { ...candidate, category: category as unknown as ProblemCategory }
              : candidate,
          ),
        },
        detail: `Desktop Problem ${JSON.stringify(problem.code)} has an unsupported category.`,
      })),
    ];

    for (const invalid of invalidGraphs) {
      expectGenerationProblem(() => generateDesktopRendererClients(invalid.graph), invalid.detail);
    }
  });

  it("rejects invalid references on unexposed graph members", () => {
    const graph = createGraph(false);
    const readFile = graph.commands.find((command) => command.id === "project.readFile");
    const fileGrant = graph.grants.find((grant) => grant.contractId === "project");
    assert(readFile && fileGrant, "Fixture project command is incomplete");
    const hiddenCommand = {
      ...readFile,
      id: "project.hidden",
      key: "hidden",
      input: { ...readFile.input, id: "project.hidden.input" },
      output: { ...readFile.output, id: "project.hidden.output" },
    };
    const project = graph.contracts.find((contract) => contract.id === "project");
    assert(project, "Fixture project contract is missing");
    const withHiddenCommand = {
      ...graph,
      contracts: graph.contracts.map((contract) =>
        contract.id === project.id
          ? { ...contract, commandIds: [...contract.commandIds, hiddenCommand.id] }
          : contract,
      ),
      commands: [...graph.commands, hiddenCommand],
    };

    expectGenerationProblem(
      () =>
        generateDesktopRendererClients({
          ...withHiddenCommand,
          commands: withHiddenCommand.commands.map((command) =>
            command.id === hiddenCommand.id
              ? { ...command, problems: ["MISSING_PROBLEM"] }
              : command,
          ),
        }),
      `Desktop member ${JSON.stringify(hiddenCommand.id)} references missing Problem "MISSING_PROBLEM".`,
    );
    expectGenerationProblem(
      () =>
        generateDesktopRendererClients({
          ...withHiddenCommand,
          commands: withHiddenCommand.commands.map((command) =>
            command.id === hiddenCommand.id ? { ...command, events: ["project.missing"] } : command,
          ),
        }),
      `Desktop member ${JSON.stringify(hiddenCommand.id)} references missing event "project.missing".`,
    );
    expectGenerationProblem(
      () =>
        generateDesktopRendererClients({
          ...withHiddenCommand,
          commands: withHiddenCommand.commands.map((command) =>
            command.id === hiddenCommand.id
              ? { ...command, input: { ...command.input, descriptor: null } }
              : command,
          ),
        }),
      `Desktop member ${JSON.stringify(hiddenCommand.id)} has no schema descriptor.`,
    );
    expectGenerationProblem(
      () =>
        generateDesktopRendererClients({
          ...withHiddenCommand,
          commands: withHiddenCommand.commands.map((command) =>
            command.id === hiddenCommand.id
              ? {
                  ...command,
                  effects: command.effects.map((effect) => ({
                    ...effect,
                    grantIds: ["project.missing"],
                  })),
                }
              : command,
          ),
        }),
      `Desktop member ${JSON.stringify(hiddenCommand.id)} references missing grant "project.missing".`,
    );
    expectGenerationProblem(
      () =>
        generateDesktopRendererClients({
          ...withHiddenCommand,
          commands: withHiddenCommand.commands.map((command) =>
            command.id === hiddenCommand.id
              ? {
                  ...command,
                  input: {
                    ...command.input,
                    descriptor: { kind: "grant-reference", grantId: "system.file" },
                  },
                }
              : command,
          ),
          grants: [
            ...graph.grants,
            { ...fileGrant, id: "system.file", contractId: "system", key: "file" },
          ],
          contracts: withHiddenCommand.contracts.map((contract) =>
            contract.id === "system"
              ? { ...contract, grantIds: [...contract.grantIds, "system.file"] }
              : contract,
          ),
        }),
      `Desktop member ${JSON.stringify(hiddenCommand.id)} references grant "system.file" from contract "system".`,
    );
  });

  it("rejects malformed wire schema descriptors before rendering", () => {
    const graph = createGraph(false);
    const readFile = graph.commands.find((command) => command.id === "project.readFile");
    const fileNotFound = graph.problems.find((problem) => problem.code === "EDITOR_FILE_NOT_FOUND");
    assert(readFile && fileNotFound, "Fixture schema owners are missing");

    const expectInvalidInput = (descriptor: unknown, detail: string): void => {
      expectGenerationProblem(
        () =>
          generateDesktopRendererClients({
            ...graph,
            commands: graph.commands.map((command) =>
              command.id === readFile.id
                ? {
                    ...command,
                    input: {
                      ...command.input,
                      descriptor: descriptor as typeof command.input.descriptor,
                    },
                  }
                : command,
            ),
          }),
        `Desktop member ${JSON.stringify(readFile.id)} has an invalid schema descriptor at ${detail}.`,
      );
    };

    expectInvalidInput(
      { kind: "future-unsupported-kind" },
      '$: unsupported kind "future-unsupported-kind"',
    );
    expectInvalidInput({ kind: "enum", values: [] }, "$: enum values must be a non-empty array");
    expectInvalidInput(
      { kind: "union", options: [{ kind: "string" }] },
      "$: union options must contain at least two schemas",
    );
    const sparseEnumValues: unknown[] = [];
    sparseEnumValues.length = 1;
    const sparseUnionOptions: unknown[] = [];
    sparseUnionOptions.length = 2;
    const sparseObjectFields: unknown[] = [];
    sparseObjectFields.length = 1;
    expectInvalidInput(
      { kind: "enum", values: sparseEnumValues },
      "$: enum values must be strings or finite numbers",
    );
    expectInvalidInput(
      { kind: "union", options: sparseUnionOptions },
      "$.options[0]: expected a descriptor object with a string kind",
    );
    expectInvalidInput(
      { kind: "object", unknownKeys: "reject", fields: sparseObjectFields },
      "$.fields[0]: object fields require a string name",
    );
    expectInvalidInput(
      {
        kind: "object",
        unknownKeys: "passthrough",
        fields: [],
      },
      '$: object unknownKeys must be "reject"',
    );
    expectInvalidInput(
      {
        kind: "object",
        unknownKeys: "reject",
        fields: [
          { name: "path", required: true, schema: { kind: "string" } },
          { name: "path", required: false, schema: { kind: "string" } },
        ],
      },
      '$.fields[1]: object field name "path" is duplicated',
    );
    expectInvalidInput(
      { kind: "literal", value: Number.NaN },
      "$: literal values must be strings, finite numbers, booleans, or null",
    );
    const recursiveDescriptor: { kind: "array"; element?: unknown } = { kind: "array" };
    recursiveDescriptor.element = recursiveDescriptor;
    expectInvalidInput(recursiveDescriptor, "$.element: recursive descriptors are not supported");

    expectGenerationProblem(
      () =>
        generateDesktopRendererClients({
          ...graph,
          problems: graph.problems.map((problem) =>
            problem.code === fileNotFound.code
              ? {
                  ...problem,
                  extensions: {
                    kind: "object",
                    unknownKeys: "reject",
                    fields: [
                      {
                        name: "reason",
                        required: true,
                        schema: { kind: "future-unsupported-kind" },
                      },
                    ],
                  } as unknown as typeof problem.extensions,
                }
              : problem,
          ),
        }),
      `Desktop member "Problem ${fileNotFound.code}" has an invalid schema descriptor at $.fields[0].schema: unsupported kind "future-unsupported-kind".`,
    );
  });
});

function expectGenerationProblem(action: () => unknown, detail: string): void {
  let thrown: unknown;
  try {
    action();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(DesktopRendererGenerationProblem);
  expect(thrown).toMatchObject({
    code: "desktop-codegen/invalid-renderer-contract-graph",
    detail,
  });
}

function createGraph(reverse: boolean) {
  class FileNotFoundProblem extends Problem {
    declare public readonly code: "EDITOR_FILE_NOT_FOUND";
    declare public readonly category: ProblemCategory.NotFound;

    public constructor() {
      super("EDITOR_FILE_NOT_FOUND", ProblemCategory.NotFound);
    }
  }
  class FilesystemUnavailableProblem extends Problem {
    declare public readonly code: "EDITOR_FILESYSTEM_UNAVAILABLE";
    declare public readonly category: ProblemCategory.InternalServerError;

    public constructor() {
      super("EDITOR_FILESYSTEM_UNAVAILABLE", ProblemCategory.InternalServerError);
    }
  }
  const fileNotFound = desktop.problem(FileNotFoundProblem, {
    code: "EDITOR_FILE_NOT_FOUND",
    category: ProblemCategory.NotFound,
    extensions: z.object({ reason: z.string() }),
  });
  const filesystemUnavailable = desktop.problem(FilesystemUnavailableProblem, {
    code: "EDITOR_FILESYSTEM_UNAVAILABLE",
    category: ProblemCategory.InternalServerError,
  });
  const filesystem = desktop.effect({
    namespace: "filesystem",
    access: "read",
    methods: { readText: desktop.effect.method<[path: string], Promise<string>>() },
    problems: [filesystemUnavailable],
  });
  const selectedFile = desktop.grant.file({
    access: "read",
    scope: "exact",
    lifetime: "command",
  });
  const project = desktop.contract({
    grants: { selectedFile },
    commands: {
      readFile: desktop.query({
        input: z.object({ path: z.string() }),
        output: z.object({ contents: z.string(), encoding: z.enum(["utf8", "utf16"]) }),
        effects: [filesystem],
        problems: [fileNotFound],
      }),
      openGranted: desktop.query({
        input: selectedFile,
        output: z.object({ opened: z.boolean() }),
      }),
    },
    events: {
      fileChanged: desktop.event({ payload: z.object({ path: z.string() }) }),
    },
  });
  const system = desktop.contract({
    commands: {
      status: desktop.query({
        input: z.object({}),
        output: z.object({ ready: z.boolean().nullable() }),
        executionPolicy: { timeoutMs: 1_000 },
      }),
    },
    events: {
      ready: desktop.event({ payload: z.object({ at: z.number() }) }),
    },
  });
  const windows = {
    main: desktop.window.local({
      expose: reverse
        ? [system.commands.status, project.commands.openGranted, project.commands.readFile]
        : [project.commands.readFile, project.commands.openGranted, system.commands.status],
      receive: reverse
        ? [system.events.ready, project.events.fileChanged]
        : [project.events.fileChanged, system.events.ready],
    }),
    settings: desktop.window.local({
      expose: [system.commands.status],
      receive: [system.events.ready],
    }),
    empty: desktop.window.local(),
    login: desktop.window.remote({
      initialUrl: "https://login.example.com",
      allowedOrigins: ["https://login.example.com"],
    }),
  };
  const registry = defineProblemRegistry({
    package: "@croco/editor",
    problems: {
      EDITOR_FILE_NOT_FOUND: {
        category: ProblemCategory.NotFound,
        retryable: false,
        public: true,
        redaction: "public",
      },
      EDITOR_FILESYSTEM_UNAVAILABLE: {
        category: ProblemCategory.InternalServerError,
        retryable: true,
        public: false,
        redaction: "operator-only",
      },
    },
  });

  return compileDesktopContractGraph(
    desktop.app({
      contracts: reverse ? { system, project } : { project, system },
      windows: reverse
        ? {
            settings: windows.settings,
            login: windows.login,
            main: windows.main,
            empty: windows.empty,
          }
        : windows,
    }),
    { problemRegistries: [registry] },
  );
}

function requireClientSource(graph: ReturnType<typeof createGraph>, windowId: string): string {
  const source = generateDesktopRendererClients(graph).find(
    (artifact) => artifact.windowId === windowId,
  )?.source;
  assert(source, `Generated renderer client ${windowId} is missing`);
  return source;
}

function executeGeneratedSource(source: string, bridge: unknown): RuntimeClient {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const generatedModule = { exports: {} as Record<string, unknown> };
  Object.assign(globalThis, { crocoDesktop: bridge });
  try {
    const load = new Function("module", "exports", output);
    load(generatedModule, generatedModule.exports);
    return generatedModule.exports.desktop as RuntimeClient;
  } finally {
    Reflect.deleteProperty(globalThis, "crocoDesktop");
  }
}

function expectTypeScriptSourcesToCompile(
  sources: ReadonlyMap<string, string>,
  rootFileNames: readonly string[],
): void {
  const protocolsDesktopModule = "/virtual/protocols-desktop.d.ts";
  const virtualSources = new Map(sources).set(
    protocolsDesktopModule,
    `
export type DesktopResult<TResult, TProblem = never> =
  | { readonly ok: true; readonly value: TResult }
  | { readonly ok: false; readonly problem: TProblem };
declare const DESKTOP_GRANT_REFERENCE: unique symbol;
export type DesktopGrantReference<
  TResource extends 'file' | 'directory',
  TAccess extends 'read' | 'write',
  TScope extends TResource extends 'file' ? 'exact' : 'exact' | 'descendant',
  TLifetime extends 'command' | 'window' | 'session',
> = string & {
  readonly [DESKTOP_GRANT_REFERENCE]: {
    readonly resource: TResource;
    readonly access: TAccess;
    readonly scope: TScope;
    readonly lifetime: TLifetime;
  };
};
`,
  );
  const compilerOptions: ts.CompilerOptions = {
    lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    skipLibCheck: true,
    strict: true,
    target: ts.ScriptTarget.ES2022,
    types: [],
  };
  const host = ts.createCompilerHost(compilerOptions);
  const getSource = (name: string): string | undefined =>
    virtualSources.get(name) ?? ts.sys.readFile(name);

  host.getSourceFile = (name, languageVersion) => {
    const source = getSource(name);
    return source === undefined
      ? undefined
      : ts.createSourceFile(name, source, languageVersion, true);
  };
  host.fileExists = (name) => virtualSources.has(name) || ts.sys.fileExists(name);
  host.readFile = getSource;
  host.directoryExists = (name) => name === "/virtual" || ts.sys.directoryExists(name);
  host.resolveModuleNames = (moduleNames, containingFile) =>
    moduleNames.map((moduleName) => {
      if (moduleName === "@croco/protocols-desktop") {
        return { resolvedFileName: protocolsDesktopModule, extension: ts.Extension.Dts };
      }
      const virtualCandidate = path.resolve(path.dirname(containingFile), `${moduleName}.ts`);
      if (virtualSources.has(virtualCandidate)) {
        return { resolvedFileName: virtualCandidate, extension: ts.Extension.Ts };
      }
      return ts.resolveModuleName(moduleName, containingFile, compilerOptions, host).resolvedModule;
    });

  const program = ts.createProgram([...rootFileNames], compilerOptions, host);
  const diagnostics = ts
    .getPreEmitDiagnostics(program)
    .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));

  expect(diagnostics).toEqual([]);
}
