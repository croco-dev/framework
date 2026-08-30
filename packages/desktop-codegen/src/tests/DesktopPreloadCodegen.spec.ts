import { compileDesktopContractGraph, desktop } from "@croco/protocols-desktop";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { DesktopPreloadGenerationProblem, generateDesktopPreloadBridges } from "../index";
import type { DesktopPreloadContextBridge, DesktopPreloadTransport } from "../index";

type GeneratedBridge = {
  readonly commands: Readonly<
    Record<string, Readonly<Record<string, (input: unknown) => Promise<unknown>>>>
  >;
  readonly events: Readonly<
    Record<string, Readonly<Record<string, (callback: (payload: unknown) => void) => () => void>>>
  >;
};

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
    expect(invoke).toHaveBeenCalledWith("project.open", { path: "README.md" });

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
    expect(invoke).toHaveBeenCalledWith("__proto__.constructor", { safe: true });
  });
});

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
