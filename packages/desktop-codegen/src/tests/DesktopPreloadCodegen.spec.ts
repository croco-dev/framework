import path from "node:path";

import { compileDesktopContractGraph, desktop } from "@croco/protocols-desktop";
import ts from "typescript";
import { assert, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  DesktopPreloadGenerationProblem,
  generateDesktopPreloadBridges,
  generateDesktopRendererClients,
} from "../index";
import type {
  DesktopPreloadCommandOptions,
  DesktopPreloadContextBridge,
  DesktopPreloadTransport,
} from "../index";

type GeneratedBridge = {
  readonly commands: Readonly<
    Record<
      string,
      Readonly<
        Record<
          string,
          (input: unknown, registerAbort?: DesktopAbortRegistration) => Promise<unknown>
        >
      >
    >
  >;
  readonly events: Readonly<
    Record<string, Readonly<Record<string, (callback: (payload: unknown) => void) => () => void>>>
  >;
};

type DesktopAbortRegistration = (abort: () => void) => () => void;

describe("generateDesktopPreloadBridges", () => {
  it("generates deterministic minimal bridges for local window profiles only", () => {
    const graph = createGraph(false);
    const first = generateDesktopPreloadBridges(graph);
    const reordered = generateDesktopPreloadBridges({
      ...graph,
      commands: [...graph.commands].reverse(),
      events: [...graph.events].reverse(),
      windows: [...graph.windows].reverse(),
    });

    expect(reordered).toEqual(first);
    expect(first).toMatchSnapshot();
    expect(first.map((artifact) => artifact.windowId)).toEqual(["empty", "main", "settings"]);
    expect(first.some((artifact) => artifact.windowId === "login")).toBe(false);
  });

  it("emits strict-clean artifacts for command, event-only, and empty windows", () => {
    const graph = createGraph(false);
    const eventOnlyGraph = {
      ...graph,
      windows: graph.windows.map((window) =>
        window.id === "settings" ? { ...window, exposedCommands: [] } : window,
      ),
    };
    const sources = new Map<string, string>();
    for (const artifact of generateDesktopPreloadBridges(graph)) {
      sources.set(`/virtual/${artifact.windowId}.generated.ts`, artifact.source);
    }
    sources.set(
      "/virtual/event-only.generated.ts",
      requireBridgeSource(eventOnlyGraph, "settings"),
    );

    expectGeneratedSourcesToCompile(sources);
  });

  it("never generates an artifact for a forged remote profile with capabilities", () => {
    const graph = createGraph(false);
    const remote = graph.windows.find((window) => window.id === "login");
    if (!remote) {
      throw new Error("Fixture remote window is missing");
    }
    const forged = {
      ...graph,
      windows: [
        ...graph.windows.filter((window) => window.id !== "login"),
        {
          ...remote,
          exposedCommands: ["project.open"],
          receivedEvents: ["project.changed"],
        },
      ],
    };

    expect(
      generateDesktopPreloadBridges(forged).some((artifact) => artifact.windowId === "login"),
    ).toBe(false);
  });

  it("rejects unknown trust values instead of granting local authority", () => {
    const graph = createGraph(false);
    const main = graph.windows.find((window) => window.id === "main");
    assert(main, "Fixture main window is missing");

    expect(() =>
      generateDesktopPreloadBridges({
        ...graph,
        windows: graph.windows.map((window) =>
          window.id === main.id ? { ...window, trust: "forged" as never } : window,
        ),
      }),
    ).toThrow(DesktopPreloadGenerationProblem);
  });

  it("binds command and event IDs inside payload-only generated closures", async () => {
    const source = requireBridgeSource(createGraph(false), "main");
    const invoke = vi.fn(async (_commandId: string, input: unknown) => ({ input }));
    const unsubscribe = vi.fn();
    const subscribe = vi.fn(
      (_eventId: string, callback: (payload: unknown) => void): (() => void) => {
        callback({ path: "README.md" });
        return unsubscribe;
      },
    );
    const transport: DesktopPreloadTransport = { invoke, subscribe };
    let exposedName: string | undefined;
    let exposedBridge: GeneratedBridge | undefined;
    const contextBridge: DesktopPreloadContextBridge = {
      exposeInMainWorld(name, api) {
        exposedName = name;
        exposedBridge = api as GeneratedBridge;
      },
    };

    executeGeneratedSource(source)(contextBridge, transport);

    expect(exposedName).toBe("crocoDesktop");
    expect(Object.keys(exposedBridge ?? {})).toEqual(["commands", "events"]);
    expect(Object.keys(exposedBridge?.commands ?? {})).toEqual(["project", "system"]);
    expect(Object.keys(exposedBridge?.commands.project ?? {})).toEqual(["open"]);
    expect(Object.keys(exposedBridge?.events.project ?? {})).toEqual(["changed"]);
    expect("invoke" in (exposedBridge ?? {})).toBe(false);
    expect("send" in (exposedBridge ?? {})).toBe(false);
    expect("ipcRenderer" in (exposedBridge ?? {})).toBe(false);

    await exposedBridge?.commands.project?.open?.({ path: "README.md" });
    expect(invoke).toHaveBeenCalledWith("project.open", { path: "README.md" }, {});

    const received: unknown[] = [];
    const stop = exposedBridge?.events.project?.changed?.((payload) => received.push(payload));
    expect(subscribe).toHaveBeenCalledWith("project.changed", expect.any(Function));
    expect(received).toEqual([{ path: "README.md" }]);
    stop?.();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("keeps overlapping capabilities scoped to each generated window", () => {
    const main = executeBridge(createGraph(false), "main");
    const settings = executeBridge(createGraph(false), "settings");
    const empty = executeBridge(createGraph(false), "empty");

    expect(Object.keys(main.commands.project ?? {})).toEqual(["open"]);
    expect(Object.keys(main.commands.system ?? {})).toEqual(["status"]);
    expect(Object.keys(settings.commands)).toEqual(["system"]);
    expect(Object.keys(settings.commands.system ?? {})).toEqual(["status"]);
    expect(Object.keys(settings.events.system ?? {})).toEqual(["ready"]);
    expect(empty).toEqual({ commands: {}, events: {} });
  });

  it("rejects inconsistent graphs instead of generating broader authority", () => {
    const graph = createGraph(false);
    const main = graph.windows.find((window) => window.id === "main");
    if (!main || main.trust !== "local") {
      throw new Error("Fixture main window is missing");
    }

    const invalid = {
      ...graph,
      windows: [
        ...graph.windows.filter((window) => window.id !== "main"),
        { ...main, exposedCommands: [...main.exposedCommands, "project.missing"] },
      ],
    };

    expect(() => generateDesktopPreloadBridges(invalid)).toThrow(DesktopPreloadGenerationProblem);
  });

  it("rejects duplicate window profiles instead of emitting ambiguous artifacts", () => {
    const graph = createGraph(false);

    expect(() =>
      generateDesktopPreloadBridges({
        ...graph,
        windows: [...graph.windows, graph.windows[0]!],
      }),
    ).toThrow(DesktopPreloadGenerationProblem);
  });

  it("emits prototype-sensitive graph keys as inert own properties", async () => {
    const graph = createGraph(false);
    const command = graph.commands.find((candidate) => candidate.id === "project.open");
    const main = graph.windows.find((window) => window.id === "main");
    if (!command || !main) {
      throw new Error("Fixture command or window is missing");
    }
    const forgedCommand = {
      ...command,
      id: "__proto__.constructor",
      contractId: "__proto__",
      key: "constructor",
    };
    const source = requireBridgeSource(
      {
        ...graph,
        commands: [forgedCommand],
        events: [],
        windows: [{ ...main, exposedCommands: [forgedCommand.id], receivedEvents: [] }],
      },
      "main",
    );
    const invoke = vi.fn(async () => undefined);
    let bridge: GeneratedBridge | undefined;

    executeGeneratedSource(source)(
      {
        exposeInMainWorld(_name, api) {
          bridge = api as GeneratedBridge;
        },
      },
      { invoke, subscribe: () => () => {} },
    );

    expect(Object.getPrototypeOf(bridge?.commands)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(bridge?.commands ?? {}, "__proto__")).toBe(true);
    expect(
      Object.prototype.hasOwnProperty.call(bridge?.commands["__proto__"] ?? {}, "constructor"),
    ).toBe(true);
    await bridge?.commands["__proto__"]?.constructor?.({ safe: true });
    expect(invoke).toHaveBeenCalledWith("__proto__.constructor", { safe: true }, {});
  });

  it("propagates live cancellation across a context-isolated bridge", async () => {
    const graph = createGraph(false);
    const preloadSource = requireBridgeSource(graph, "main");
    const rendererSource = generateDesktopRendererClients(graph).find(
      (artifact) => artifact.windowId === "main",
    )?.source;
    expect(rendererSource).toBeDefined();
    let transportSignal: AbortSignal | undefined;
    const invoke = vi.fn(
      async (
        _commandId: string,
        _input: unknown,
        options: DesktopPreloadCommandOptions,
      ): Promise<string> => {
        transportSignal = options.signal;
        return new Promise((resolve) =>
          options.signal?.addEventListener("abort", () => resolve("cancelled"), { once: true }),
        );
      },
    );
    let bridge: GeneratedBridge | undefined;

    executeGeneratedSource(preloadSource)(
      {
        exposeInMainWorld(_name, api) {
          bridge = copyContextBridgeValue(api) as GeneratedBridge;
        },
      },
      { invoke, subscribe: () => () => {} },
    );
    expect(bridge).toBeDefined();
    if (!rendererSource || !bridge) {
      throw new Error("Generated renderer or preload bridge is missing");
    }
    const controller = new AbortController();
    const removeAbortListener = vi.spyOn(controller.signal, "removeEventListener");
    const renderer = executeRendererSource(rendererSource, bridge);
    const hostileOptions = {
      signal: controller.signal,
      timeoutMs: 60_000,
      forged: true,
    } as DesktopPreloadCommandOptions;

    const pending = renderer.project.open({ path: "README.md" }, hostileOptions);
    expect(transportSignal).toBeInstanceOf(AbortSignal);
    expect(transportSignal).not.toBe(controller.signal);
    expect(transportSignal?.aborted).toBe(false);
    controller.abort();

    await expect(pending).resolves.toBe("cancelled");
    expect(transportSignal?.aborted).toBe(true);
    expect(invoke).toHaveBeenCalledWith(
      "project.open",
      { path: "README.md" },
      {
        signal: transportSignal,
      },
    );
    expect(invoke.mock.calls[0]?.[2]).not.toHaveProperty("timeoutMs");
    expect(invoke.mock.calls[0]?.[2]).not.toHaveProperty("forged");
    expect(removeAbortListener).toHaveBeenCalledOnce();
  });
});

type GeneratedRenderer = {
  readonly project: {
    readonly open: (
      input: { readonly path: string },
      options?: DesktopPreloadCommandOptions,
    ) => Promise<unknown>;
  };
};

function createGraph(reverse: boolean) {
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
    events: {
      ready: desktop.event({ payload: z.object({ at: z.number() }) }),
    },
  });
  const windows = {
    main: desktop.window.local({
      expose: reverse
        ? [system.commands.status, project.commands.open]
        : [project.commands.open, system.commands.status],
      receive: reverse
        ? [system.events.ready, project.events.changed]
        : [project.events.changed, system.events.ready],
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
  );
}

function requireBridgeSource(graph: ReturnType<typeof createGraph>, windowId: string): string {
  const source = generateDesktopPreloadBridges(graph).find(
    (artifact) => artifact.windowId === windowId,
  )?.source;
  if (!source) {
    throw new Error(`Generated bridge ${windowId} is missing`);
  }
  return source;
}

function executeBridge(graph: ReturnType<typeof createGraph>, windowId: string): GeneratedBridge {
  let bridge: GeneratedBridge | undefined;
  executeGeneratedSource(requireBridgeSource(graph, windowId))(
    {
      exposeInMainWorld(_name, api) {
        bridge = api as GeneratedBridge;
      },
    },
    {
      invoke: async () => undefined,
      subscribe: () => () => {},
    },
  );
  if (!bridge) {
    throw new Error(`Generated bridge ${windowId} did not expose an API`);
  }
  return bridge;
}

function executeGeneratedSource(
  source: string,
): (contextBridge: DesktopPreloadContextBridge, transport: DesktopPreloadTransport) => void {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const generatedModule = { exports: {} as Record<string, unknown> };
  const load = new Function("module", "exports", output);
  load(generatedModule, generatedModule.exports);
  return generatedModule.exports.installDesktopPreloadBridge as (
    contextBridge: DesktopPreloadContextBridge,
    transport: DesktopPreloadTransport,
  ) => void;
}

function executeRendererSource(source: string, bridge: GeneratedBridge): GeneratedRenderer {
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
    return generatedModule.exports.desktop as GeneratedRenderer;
  } finally {
    Reflect.deleteProperty(globalThis, "crocoDesktop");
  }
}

function copyContextBridgeValue(value: unknown): unknown {
  if (typeof value === "function") {
    return (...args: unknown[]) => {
      const result = value(...args.map(copyContextBridgeValue));
      return copyContextBridgeValue(result);
    };
  }
  if (value instanceof Promise) {
    return value.then(copyContextBridgeValue);
  }
  if (Array.isArray(value)) {
    return value.map(copyContextBridgeValue);
  }
  if (value !== null && typeof value === "object") {
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      return structuredClone(value);
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, copyContextBridgeValue(entry)]),
    );
  }
  return value;
}

function expectGeneratedSourcesToCompile(sources: ReadonlyMap<string, string>): void {
  const desktopCodegenModule = "/virtual/desktop-codegen.d.ts";
  const virtualSources = new Map(sources).set(
    desktopCodegenModule,
    `
export type DesktopPreloadContextBridge = {
  exposeInMainWorld(name: 'crocoDesktop', api: Readonly<Record<string, unknown>>): void;
};
export type DesktopPreloadTransport = {
  invoke(commandId: string, input: unknown, options: { readonly signal?: AbortSignal }): Promise<unknown>;
  subscribe(eventId: string, callback: (payload: unknown) => void): () => void;
};
`,
  );
  const compilerOptions: ts.CompilerOptions = {
    lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    noUnusedLocals: true,
    noUnusedParameters: true,
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
      if (moduleName === "@croco/desktop-codegen") {
        return { resolvedFileName: desktopCodegenModule, extension: ts.Extension.Dts };
      }
      const virtualCandidate = path.resolve(path.dirname(containingFile), `${moduleName}.ts`);
      if (virtualSources.has(virtualCandidate)) {
        return { resolvedFileName: virtualCandidate, extension: ts.Extension.Ts };
      }
      return ts.resolveModuleName(moduleName, containingFile, compilerOptions, host).resolvedModule;
    });

  const program = ts.createProgram([...sources.keys()], compilerOptions, host);
  const diagnostics = ts
    .getPreEmitDiagnostics(program)
    .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));

  expect(diagnostics).toEqual([]);
}
