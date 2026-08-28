import path from "node:path";

import { Problem, ProblemCategory, defineProblemRegistry } from "@croco/problems-core";
import { compileDesktopContractGraph, desktop } from "@croco/protocols-desktop";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
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
    const reordered = generateDesktopRendererClients({
      ...graph,
      commands: [...graph.commands].reverse(),
      contracts: [...graph.contracts].reverse(),
      events: [...graph.events].reverse(),
      grants: [...graph.grants].reverse(),
      problems: [...graph.problems].reverse(),
      windows: [...graph.windows].reverse(),
    });

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
    const readFile = vi.fn(async () => ({ ok: true, value: { contents: "Croco" } }));
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

    await runtime.project.readFile({ path: "README.md" }, { signal });

    expect(readFile).toHaveBeenCalledWith({ path: "README.md" }, { signal });
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
    if (!readFile) {
      throw new Error("Fixture readFile command is missing");
    }
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
    if (!command) {
      throw new Error("Fixture readFile command is missing");
    }
    if (!grant) {
      throw new Error("Fixture file grant is missing");
    }

    expect(() =>
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
    ).toThrow(DesktopRendererGenerationProblem);
    expect(() =>
      generateDesktopRendererClients({
        ...graph,
        problems: graph.problems.filter((problem) => problem.code !== command.problems[0]),
      }),
    ).toThrow(DesktopRendererGenerationProblem);
    expect(() =>
      generateDesktopRendererClients({
        ...graph,
        grants: graph.grants.map((candidate) =>
          candidate.id === grant.id ? { ...candidate, scope: "descendant" } : candidate,
        ),
      }),
    ).toThrow(DesktopRendererGenerationProblem);
  });
});

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
  if (!source) {
    throw new Error(`Generated renderer client ${windowId} is missing`);
  }
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
