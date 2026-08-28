import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  compileDesktopContractGraph,
  desktop,
  formatDesktopContractGraphDiagnostic,
  stringifyDesktopContractGraphDiagnostics,
} from "../index";
import type {
  DesktopAppDefinition,
  DesktopCommandExecutionPolicy,
  DesktopContractGraphDiagnosticCode,
  DesktopContractRecord,
  DesktopWindowRecord,
} from "../index";

type CompilableDesktopApp = DesktopAppDefinition<DesktopContractRecord, DesktopWindowRecord>;

describe("DesktopContractGraph diagnostics", () => {
  it("compiles declared authority and bounded execution policy into semantic graph data", () => {
    const selectedFile = desktop.grant.file({
      access: "read",
      scope: "exact",
      lifetime: "command",
    });
    const filesystem = desktop.effect({
      namespace: "filesystem",
      access: "read",
      grants: [selectedFile],
      methods: { readText: desktop.effect.method<[token: string], Promise<string>>() },
    });
    const changed = desktop.event({ payload: z.object({ path: z.string() }) });
    const project = desktop.contract({
      grants: { selectedFile },
      events: { changed },
      commands: {
        read: desktop.query({
          input: selectedFile,
          output: z.string(),
          effects: [filesystem],
          events: ["changed"],
          executionPolicy: {
            timeoutMs: 1_000,
            maxInputBytes: 4_096,
            maxOutputBytes: 65_536,
            maxConcurrency: 4,
          },
        }),
      },
    });

    const graph = compileDesktopContractGraph(desktop.app({ contracts: { project }, windows: {} }));

    expect(graph.effects).toEqual(["filesystem"]);
    expect(graph.commands[0]).toEqual(
      expect.objectContaining({
        effects: [
          {
            namespace: "filesystem",
            access: "read",
            methods: ["readText"],
            grantIds: ["project.selectedFile"],
          },
        ],
        events: ["project.changed"],
        executionPolicy: {
          mode: "request-response",
          timeoutMs: 1_000,
          maxInputBytes: 4_096,
          maxOutputBytes: 65_536,
          maxConcurrency: 4,
        },
      }),
    );
    expect(graph.diagnostics).toEqual([]);
  });

  it("includes effect authority and execution limits in semantic identity", () => {
    const createApp = (access: "read" | "write", timeoutMs: number) => {
      const effect = desktop.effect({
        namespace: "filesystem",
        access,
        methods: { inspect: desktop.effect.method<[], Promise<void>>() },
      });
      const contract = desktop.contract({
        commands: {
          run: desktop.mutation({
            input: z.object({}),
            output: z.object({}),
            effects: [effect],
            executionPolicy: { timeoutMs },
          }),
        },
      });
      return desktop.app({ contracts: { contract }, windows: {} });
    };

    const baseline = compileDesktopContractGraph(createApp("read", 1_000));
    const widerAuthority = compileDesktopContractGraph(createApp("write", 1_000));
    const longerTimeout = compileDesktopContractGraph(createApp("read", 2_000));

    expect(widerAuthority.semanticHash).not.toBe(baseline.semanticHash);
    expect(longerTimeout.semanticHash).not.toBe(baseline.semanticHash);
  });

  it("reports duplicate and reserved stable IDs without throwing", () => {
    const contract = desktop.contract({
      commands: {
        first: desktop.query({ input: z.object({}), output: z.string() }),
        second: desktop.query({ input: z.object({}), output: z.string() }),
      },
    });
    const app = desktop.app({ contracts: { contract }, windows: {} });
    const invalid = {
      ...app,
      contracts: {
        contract: {
          ...app.contracts.contract,
          commands: {
            first: { ...app.contracts.contract.commands.first, id: "contract.metadata" },
            second: { ...app.contracts.contract.commands.second, id: "contract.metadata" },
          },
        },
      },
    } as unknown as CompilableDesktopApp;

    const graph = compileDesktopContractGraph(invalid);

    expect(graph.diagnostics.map(({ code }) => code)).toEqual([
      "DESKTOP_GRAPH_DUPLICATE_ID",
      "DESKTOP_GRAPH_RESERVED_ID",
      "DESKTOP_GRAPH_RESERVED_ID",
    ]);
  });

  it("rejects write authority on queries and mismatched grant access", () => {
    const selectedFile = desktop.grant.file({
      access: "read",
      scope: "exact",
      lifetime: "command",
    });
    const filesystemWrite = desktop.effect({
      namespace: "filesystem",
      access: "write",
      grants: [selectedFile],
      methods: { writeText: desktop.effect.method<[token: string], Promise<void>>() },
    });
    const project = desktop.contract({
      grants: { selectedFile },
      commands: {
        save: desktop.query({
          input: selectedFile,
          output: z.boolean(),
          effects: [filesystemWrite],
        }),
      },
    });

    const graph = compileDesktopContractGraph(desktop.app({ contracts: { project }, windows: {} }));

    expect(graph.diagnostics.map(({ code }) => code)).toEqual([
      "DESKTOP_GRAPH_EFFECT_GRANT_ACCESS_MISMATCH",
      "DESKTOP_GRAPH_QUERY_WRITE_EFFECT",
    ]);
  });

  it("rejects remote exposure plus wildcard, malformed, and insecure origins", () => {
    const app = desktop.app({
      contracts: {},
      windows: {
        login: desktop.window.remote({
          initialUrl: "http://login.example.com",
          allowedOrigins: ["https://*.example.com", "not-an-origin", "http://example.com"],
        }),
      },
    });
    const invalid = {
      ...app,
      windows: {
        login: {
          ...app.windows.login,
          expose: [{ id: "project.open" }],
          receive: [{ id: "project.changed" }],
        },
      },
    } as unknown as CompilableDesktopApp;

    const graph = compileDesktopContractGraph(invalid);

    expect(graph.diagnostics.map(({ code }) => code)).toEqual([
      "DESKTOP_GRAPH_REMOTE_WINDOW_EXPOSURE",
      "DESKTOP_GRAPH_REMOTE_ORIGIN_INSECURE",
      "DESKTOP_GRAPH_REMOTE_ORIGIN_WILDCARD",
      "DESKTOP_GRAPH_REMOTE_ORIGIN_MALFORMED",
      "DESKTOP_GRAPH_REMOTE_ORIGIN_INSECURE",
    ]);
  });

  it("keeps remote-origin diagnostics independent of declaration order", () => {
    const compile = (allowedOrigins: readonly string[]) =>
      compileDesktopContractGraph(
        desktop.app({
          contracts: {},
          windows: {
            login: desktop.window.remote({
              initialUrl: "https://login.example.com",
              allowedOrigins,
            }),
          },
        }),
      );
    const origins = ["not-an-origin", "http://example.com", "https://*.example.com"];

    const forward = compile(origins);
    const reversed = compile([...origins].reverse());

    expect(reversed.diagnostics).toEqual(forward.diagnostics);
    expect(reversed.semanticHash).toBe(forward.semanticHash);
    expect(stringifyDesktopContractGraphDiagnostics(reversed.diagnostics)).toBe(
      stringifyDesktopContractGraphDiagnostics(forward.diagnostics),
    );
  });

  it("reports empty identifier segments as reserved IDs", () => {
    const contract = desktop.contract({
      commands: {
        run: desktop.query({ input: z.object({}), output: z.string() }),
      },
    });
    const app = desktop.app({ contracts: { contract }, windows: {} });
    const invalid = {
      ...app,
      contracts: {
        contract: {
          ...app.contracts.contract,
          commands: {
            run: { ...app.contracts.contract.commands.run, id: "contract..run" },
          },
        },
      },
    } as unknown as CompilableDesktopApp;

    const graph = compileDesktopContractGraph(invalid);

    expect(graph.diagnostics).toEqual([
      expect.objectContaining({
        code: "DESKTOP_GRAPH_RESERVED_ID",
        memberId: "contract..run",
      }),
    ]);
  });

  const invalidNumbers = [
    -1,
    0,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ];
  const numericFields = [
    ["timeoutMs", "DESKTOP_GRAPH_INVALID_TIMEOUT"],
    ["maxInputBytes", "DESKTOP_GRAPH_INVALID_BYTE_LIMIT"],
    ["maxOutputBytes", "DESKTOP_GRAPH_INVALID_BYTE_LIMIT"],
    ["maxConcurrency", "DESKTOP_GRAPH_INVALID_CONCURRENCY"],
  ] as const satisfies readonly (readonly [
    keyof DesktopCommandExecutionPolicy,
    DesktopContractGraphDiagnosticCode,
  ])[];

  for (const [field, code] of numericFields) {
    it.each(invalidNumbers)(
      `rejects invalid ${field} value %s without applying a default`,
      (value) => {
        const contract = desktop.contract({
          commands: {
            run: desktop.mutation({
              input: z.object({}),
              output: z.object({}),
              executionPolicy: { [field]: value },
            }),
          },
        });

        const graph = compileDesktopContractGraph(
          desktop.app({ contracts: { contract }, windows: {} }),
        );

        expect(graph.diagnostics).toEqual([
          expect.objectContaining({
            code,
            targetKind: "execution-policy",
            memberId: "contract.run",
            contractMember: "contract.run",
            schemaPath: [field],
          }),
        ]);
        expect(graph.commands[0]?.executionPolicy).not.toHaveProperty(field);
      },
    );
  }

  it("reports missing command, event, grant, and window references", () => {
    const unmountedGrant = desktop.grant.file({
      access: "read",
      scope: "exact",
      lifetime: "command",
    });
    const contract = desktop.contract({
      commands: {
        read: desktop.query({
          input: unmountedGrant,
          output: z.string(),
          events: ["missing"],
        }),
      },
    } as never);
    const app = desktop.app({ contracts: { contract }, windows: {} });
    const invalid = {
      ...app,
      windows: {
        main: {
          definitionType: "window",
          trust: "local",
          expose: [{ id: "contract.missing", memberKey: "missing" }],
          receive: [{ id: "contract.missing", memberKey: "missing" }],
        },
      },
      metadata: {
        ...app.metadata,
        windows: [
          { key: "main", trust: "local", expose: [], receive: [] },
          { key: "missing", trust: "local", expose: [], receive: [] },
        ],
      },
    } as unknown as CompilableDesktopApp;

    const graph = compileDesktopContractGraph(invalid);

    expect(graph.diagnostics.map(({ code }) => code)).toEqual([
      "DESKTOP_GRAPH_MISSING_EVENT_REFERENCE",
      "DESKTOP_GRAPH_MISSING_GRANT_REFERENCE",
      "DESKTOP_GRAPH_MISSING_COMMAND_REFERENCE",
      "DESKTOP_GRAPH_MISSING_EVENT_REFERENCE",
      "DESKTOP_GRAPH_MISSING_WINDOW_REFERENCE",
    ]);
  });

  it("sorts multiple diagnostics deterministically and formats the same objects for humans and JSON", () => {
    const contract = desktop.contract({
      commands: {
        zed: desktop.query({
          input: z.object({}),
          output: z.string(),
          executionPolicy: { timeoutMs: 0 },
        }),
        alpha: desktop.query({
          input: z.object({}),
          output: z.string(),
          executionPolicy: { maxConcurrency: Number.NaN },
        }),
      },
    });
    const app = desktop.app({ contracts: { contract }, windows: {} });
    const sources = {
      "contract.alpha.executionPolicy": { path: "/workspace/src/contract.ts", line: 8 },
      "contract.zed.executionPolicy": { path: "/workspace/src/contract.ts", line: 14 },
    };

    const first = compileDesktopContractGraph(app, { sourceLocations: sources });
    const second = compileDesktopContractGraph(app, {
      sourceLocations: Object.fromEntries(Object.entries(sources).reverse()),
    });

    expect(second.diagnostics).toEqual(first.diagnostics);
    expect(first.diagnostics.map(({ memberId }) => memberId)).toEqual([
      "contract.alpha",
      "contract.zed",
    ]);
    const diagnostic = first.diagnostics[0];
    expect(diagnostic).toEqual(
      expect.objectContaining({
        severity: "error",
        targetKind: "execution-policy",
        memberId: "contract.alpha",
        message: expect.any(String),
        recovery: expect.any(String),
        sourceLocation: { path: "/workspace/src/contract.ts", line: 8 },
      }),
    );
    expect(formatDesktopContractGraphDiagnostic(diagnostic!)).toContain(
      "DESKTOP_GRAPH_INVALID_CONCURRENCY execution-policy contract.alpha",
    );
    expect(JSON.parse(stringifyDesktopContractGraphDiagnostics(first.diagnostics))).toEqual(
      first.diagnostics,
    );
  });
});
