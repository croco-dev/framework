import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";

import {
  diffDesktopContractGraphs,
  formatDesktopContractGraphDiff,
  formatDesktopContractGraphDiffChange,
  resolveDesktopContractGraphDiffExitStatus,
  stringifyDesktopContractGraphDiff,
} from "../index";
import type { DesktopContractGraphV1 } from "../index";

describe("DesktopContractGraphDiff", () => {
  it("ignores ordering and source evidence while keeping canonical human and JSON output", () => {
    const baseline = createGraph();
    const current = createGraph({
      commands: [
        {
          ...baseline.commands[0]!,
          effects: [
            {
              ...baseline.commands[0]!.effects[0]!,
              methods: ["writeText", "readText"],
              grantIds: ["project.workspace", "project.selectedFile"],
            },
          ],
          problems: ["PROJECT_WRITE_FAILED", "PROJECT_READ_FAILED"],
          events: ["project.saved", "project.changed"],
          sourceLocation: { path: "another/checkout/project.ts", line: 999 },
          input: {
            ...baseline.commands[0]!.input,
            descriptor: {
              kind: "object",
              unknownKeys: "reject",
              fields: [...inputFields].reverse(),
            },
          },
        },
      ],
      windows: [
        {
          ...baseline.windows[0]!,
          exposedCommands: [...baseline.windows[0]!.exposedCommands].reverse(),
          receivedEvents: [...baseline.windows[0]!.receivedEvents].reverse(),
          sourceLocation: { path: "another/checkout/windows.ts" },
        },
        {
          ...baseline.windows[1]!,
          originPolicy: {
            ...remoteOriginPolicy,
            allowedOrigins: [...remoteOriginPolicy.allowedOrigins].reverse(),
          },
        },
      ].reverse(),
    });

    const diff = diffDesktopContractGraphs(baseline, current);

    expect(diff.changes).toEqual([]);
    expect(resolveDesktopContractGraphDiffExitStatus(diff)).toEqual({
      exitCode: 0,
      hasBreakingCompatibility: false,
      unreviewedAuthorityEscalations: [],
    });
    expect(formatDesktopContractGraphDiff(diff)).toBe(
      "Desktop contract diff found 0 breaking compatibility change(s), 0 authority escalation(s), and 0 authority reduction(s).",
    );
    expect(JSON.parse(stringifyDesktopContractGraphDiff(diff))).toMatchObject({
      version: "croco.desktop-contract-graph-diff.v1",
      changes: [],
    });
  });

  it("classifies compatibility independently from authority", () => {
    const baseline = createGraph();
    const command = baseline.commands[0]!;
    const current = createGraph({
      commands: [
        {
          ...command,
          kind: "mutation",
          input: {
            ...command.input,
            descriptor: {
              kind: "object",
              unknownKeys: "reject",
              fields: [
                ...inputFields,
                { name: "mode", required: true, schema: { kind: "string" } },
              ],
            },
          },
          output: {
            ...command.output,
            descriptor: {
              kind: "object",
              unknownKeys: "reject",
              fields: [],
            },
          },
          problems: [...command.problems, "PROJECT_NEW_FAILURE"],
        },
      ],
      problems: [
        ...baseline.problems,
        {
          code: "PROJECT_NEW_FAILURE",
          category: ProblemCategory.InternalServerError,
          source: problemSource,
        },
      ],
    });

    const diff = diffDesktopContractGraphs(baseline, current);

    expect(diff.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "desktop-command-kind-changed",
          compatibility: "breaking",
          authority: "escalation",
        }),
        expect.objectContaining({
          code: "desktop-command-input-schema-changed",
          compatibility: "breaking",
          authority: "none",
        }),
        expect.objectContaining({
          code: "desktop-command-output-schema-changed",
          compatibility: "breaking",
          authority: "none",
        }),
        expect.objectContaining({
          code: "desktop-command-problem-added",
          compatibility: "breaking",
          authority: "none",
        }),
      ]),
    );
    expect(diff.hasBreakingCompatibility).toBe(true);
    expect(diff.hasAuthorityEscalations).toBe(true);
    expect(diff.breakingChanges).toHaveLength(diff.breakingCompatibilityCount);
    expect(diff.authorityEscalations).toHaveLength(diff.authorityEscalationCount);
  });

  it("keeps change fingerprints stable across source movement and set reordering", () => {
    const baseline = createGraph();
    const firstCurrent = createGraph({
      windows: [
        {
          ...baseline.windows[0]!,
          exposedCommands: ["project.open", "project.admin"],
        },
        baseline.windows[1]!,
      ],
    });
    const secondCurrent = createGraph({
      windows: [
        baseline.windows[1]!,
        {
          ...baseline.windows[0]!,
          exposedCommands: ["project.admin", "project.open"],
          sourceLocation: { path: "moved/windows.ts", line: 42 },
        },
      ],
    });

    const first = diffDesktopContractGraphs(baseline, firstCurrent).changes.find(
      (change) => change.code === "desktop-window-command-exposed",
    );
    const second = diffDesktopContractGraphs(baseline, secondCurrent).changes.find(
      (change) => change.code === "desktop-window-command-exposed",
    );

    expect(first?.fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(second?.fingerprint).toBe(first?.fingerprint);
    expect(first && formatDesktopContractGraphDiffChange(first)).toContain(first?.fingerprint);
  });

  it("binds window exposure reviews to the effective transitive command authority", () => {
    const readBaseline = createGraph({
      windows: [{ ...createGraph().windows[0]!, exposedCommands: [] }, createGraph().windows[1]!],
    });
    const readCurrent = createGraph();
    const writeCommand = {
      ...createGraph().commands[0]!,
      kind: "mutation" as const,
      effects: [{ ...createGraph().commands[0]!.effects[0]!, access: "write" as const }],
    };
    const writeGrant = { ...createGraph().grants[0]!, access: "write" as const };
    const writeBaseline = createGraph({
      commands: [writeCommand],
      grants: [writeGrant],
      windows: [{ ...createGraph().windows[0]!, exposedCommands: [] }, createGraph().windows[1]!],
    });
    const writeCurrent = createGraph({ commands: [writeCommand], grants: [writeGrant] });

    const readExposure = diffDesktopContractGraphs(
      readBaseline,
      readCurrent,
    ).authorityEscalations.find((change) => change.code === "desktop-window-command-exposed");
    const writeDiff = diffDesktopContractGraphs(writeBaseline, writeCurrent);
    const writeExposure = writeDiff.authorityEscalations.find(
      (change) => change.code === "desktop-window-command-exposed",
    );

    expect(readExposure?.fingerprint).not.toBe(writeExposure?.fingerprint);
    expect(
      resolveDesktopContractGraphDiffExitStatus(writeDiff, {
        reviewedAuthorityEscalationFingerprints: readExposure ? [readExposure.fingerprint] : [],
      }).exitCode,
    ).toBe(2);
  });

  it("treats nested object, enum, and optional union widening as compatible input changes", () => {
    const baseline = createGraph();
    const command = baseline.commands[0]!;
    const objectUnionBaseline = {
      kind: "union" as const,
      options: [
        {
          kind: "object" as const,
          unknownKeys: "reject" as const,
          fields: [{ name: "value", required: true, schema: { kind: "string" as const } }],
        },
      ],
    };
    const objectUnionCurrent = {
      kind: "union" as const,
      options: [
        {
          kind: "object" as const,
          unknownKeys: "reject" as const,
          fields: [
            { name: "value", required: true, schema: { kind: "string" as const } },
            { name: "trace", required: false, schema: { kind: "string" as const } },
          ],
        },
      ],
    };
    const objectUnionDiff = diffDesktopContractGraphs(
      createGraph({
        commands: [{ ...command, input: { ...command.input, descriptor: objectUnionBaseline } }],
      }),
      createGraph({
        commands: [{ ...command, input: { ...command.input, descriptor: objectUnionCurrent } }],
      }),
    );
    const enumUnionDiff = diffDesktopContractGraphs(
      createGraph({
        commands: [
          {
            ...command,
            input: {
              ...command.input,
              descriptor: { kind: "enum", values: ["read", "write"] },
            },
          },
        ],
      }),
      createGraph({
        commands: [
          {
            ...command,
            input: {
              ...command.input,
              descriptor: {
                kind: "union",
                options: [
                  { kind: "literal", value: "write" },
                  { kind: "literal", value: "read" },
                  { kind: "literal", value: "admin" },
                ],
              },
            },
          },
        ],
      }),
    );
    const optionalUnionDiff = diffDesktopContractGraphs(
      createGraph({
        commands: [
          {
            ...command,
            input: {
              ...command.input,
              descriptor: { kind: "optional", inner: { kind: "string" } },
            },
          },
        ],
      }),
      createGraph({
        commands: [
          {
            ...command,
            input: {
              ...command.input,
              descriptor: {
                kind: "union",
                options: [{ kind: "optional", inner: { kind: "string" } }, { kind: "number" }],
              },
            },
          },
        ],
      }),
    );

    expect(objectUnionDiff.changes).toEqual([
      expect.objectContaining({
        code: "desktop-command-input-schema-changed",
        compatibility: "non-breaking",
      }),
    ]);
    expect(enumUnionDiff.changes).toEqual([
      expect.objectContaining({
        code: "desktop-command-input-schema-changed",
        compatibility: "non-breaking",
      }),
    ]);
    expect(optionalUnionDiff.changes).toEqual([
      expect.objectContaining({
        code: "desktop-command-input-schema-changed",
        compatibility: "non-breaking",
      }),
    ]);
  });

  it("binds direct effect and grant escalation reviews to their full authority", () => {
    const graph = createGraph();
    const command = graph.commands[0]!;
    const effect = command.effects[0]!;
    const grant = graph.grants[0]!;
    const readMethodDiff = diffDesktopContractGraphs(
      graph,
      createGraph({
        commands: [{ ...command, effects: [{ ...effect, methods: [...effect.methods, "stat"] }] }],
      }),
    );
    const writeCommand = {
      ...command,
      kind: "mutation" as const,
      effects: [{ ...effect, access: "write" as const }],
    };
    const writeGrant = { ...grant, access: "write" as const };
    const writeMethodDiff = diffDesktopContractGraphs(
      createGraph({ commands: [writeCommand], grants: [writeGrant] }),
      createGraph({
        commands: [
          {
            ...writeCommand,
            effects: [{ ...writeCommand.effects[0]!, methods: [...effect.methods, "stat"] }],
          },
        ],
        grants: [writeGrant],
      }),
    );
    const readMethod = readMethodDiff.authorityEscalations.find(
      (change) => change.code === "desktop-effect-method-added",
    );
    const writeMethod = writeMethodDiff.authorityEscalations.find(
      (change) => change.code === "desktop-effect-method-added",
    );

    expect(readMethod?.fingerprint).not.toBe(writeMethod?.fingerprint);
    expect(
      resolveDesktopContractGraphDiffExitStatus(writeMethodDiff, {
        reviewedAuthorityEscalationFingerprints: readMethod ? [readMethod.fingerprint] : [],
      }).unreviewedAuthorityEscalations,
    ).toContainEqual(expect.objectContaining({ code: "desktop-effect-method-added" }));

    const readScopeDiff = diffDesktopContractGraphs(
      graph,
      createGraph({ grants: [{ ...grant, scope: "descendant" }] }),
    );
    const writeScopeDiff = diffDesktopContractGraphs(
      createGraph({ grants: [writeGrant] }),
      createGraph({ grants: [{ ...writeGrant, scope: "descendant" }] }),
    );
    const readScope = readScopeDiff.authorityEscalations.find(
      (change) => change.code === "desktop-grant-scope-changed",
    );
    const writeScope = writeScopeDiff.authorityEscalations.find(
      (change) => change.code === "desktop-grant-scope-changed",
    );

    expect(readScope?.fingerprint).not.toBe(writeScope?.fingerprint);
  });

  it("preserves malformed remote-origin evidence without throwing", () => {
    const baseline = createGraph({
      windows: [
        createGraph().windows[0]!,
        {
          ...createGraph().windows[1]!,
          originPolicy: {
            ...remoteOriginPolicy,
            allowedOrigins: ["not-an-origin"],
          },
        },
      ],
    });
    const current = createGraph({
      windows: [
        createGraph().windows[0]!,
        {
          ...createGraph().windows[1]!,
          originPolicy: {
            ...remoteOriginPolicy,
            allowedOrigins: ["still-not-an-origin"],
          },
        },
      ],
    });

    expect(diffDesktopContractGraphs(baseline, baseline).changes).toEqual([]);
    expect(diffDesktopContractGraphs(baseline, current).changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "desktop-window-remote-origin-removed",
          before: "invalid-origin:not-an-origin",
        }),
        expect.objectContaining({
          code: "desktop-window-remote-origin-added",
          after: "invalid-origin:still-not-an-origin",
        }),
      ]),
    );

    const pathBaseline = createGraph({
      windows: [
        createGraph().windows[0]!,
        {
          ...createGraph().windows[1]!,
          originPolicy: {
            ...remoteOriginPolicy,
            allowedOrigins: ["https://example.com/a"],
          },
        },
      ],
    });
    const pathCurrent = createGraph({
      windows: [
        createGraph().windows[0]!,
        {
          ...createGraph().windows[1]!,
          originPolicy: {
            ...remoteOriginPolicy,
            allowedOrigins: ["https://example.com/b"],
          },
        },
      ],
    });

    expect(diffDesktopContractGraphs(pathBaseline, pathCurrent).changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ before: "invalid-origin:https://example.com/a" }),
        expect.objectContaining({ after: "invalid-origin:https://example.com/b" }),
      ]),
    );
  });

  it("keeps schema-change fingerprints stable across field reordering", () => {
    const baseline = createGraph();
    const command = baseline.commands[0]!;
    const changedFields = [
      ...inputFields,
      { name: "mode", required: true, schema: { kind: "string" as const } },
    ] as const;
    const reorderedBaseline = createGraph({
      commands: [
        {
          ...command,
          input: {
            ...command.input,
            descriptor: {
              kind: "object",
              unknownKeys: "reject",
              fields: [...inputFields].reverse(),
            },
          },
        },
      ],
    });
    const reorderedCurrent = createGraph({
      commands: [
        {
          ...command,
          input: {
            ...command.input,
            descriptor: {
              kind: "object",
              unknownKeys: "reject",
              fields: [...changedFields].reverse(),
            },
          },
        },
      ],
    });

    const first = diffDesktopContractGraphs(
      baseline,
      createGraph({
        commands: [
          {
            ...command,
            input: {
              ...command.input,
              descriptor: { kind: "object", unknownKeys: "reject", fields: changedFields },
            },
          },
        ],
      }),
    ).changes[0];
    const second = diffDesktopContractGraphs(reorderedBaseline, reorderedCurrent).changes[0];

    expect(second?.fingerprint).toBe(first?.fingerprint);
  });

  it("reports same-origin initial route changes without authority escalation", () => {
    const baseline = createGraph();
    const current = createGraph({
      windows: [
        baseline.windows[0]!,
        {
          ...baseline.windows[1]!,
          originPolicy: {
            ...remoteOriginPolicy,
            initialUrl: "https://login.example.com/callback",
          },
        },
      ],
    });

    const diff = diffDesktopContractGraphs(baseline, current);

    expect(diff.changes).toEqual([
      expect.objectContaining({
        code: "desktop-window-initial-url-changed",
        compatibility: "breaking",
        authority: "none",
      }),
    ]);
    expect(resolveDesktopContractGraphDiffExitStatus(diff).exitCode).toBe(1);
  });

  it("classifies effect, grant, window, and remote-origin expansion as authority escalation", () => {
    const baseline = createGraph();
    const command = baseline.commands[0]!;
    const current = createGraph({
      commands: [
        {
          ...command,
          effects: [
            {
              ...command.effects[0]!,
              access: "write",
              methods: [...command.effects[0]!.methods, "deleteFile"],
            },
          ],
        },
      ],
      grants: [
        {
          ...baseline.grants[0]!,
          access: "write",
          scope: "descendant",
          lifetime: "session",
        },
      ],
      windows: [
        {
          ...baseline.windows[0]!,
          exposedCommands: [...baseline.windows[0]!.exposedCommands, "project.admin"],
        },
        {
          ...baseline.windows[1]!,
          originPolicy: {
            ...remoteOriginPolicy,
            allowedOrigins: [...remoteOriginPolicy.allowedOrigins, "https://new.example.com"],
          },
        },
      ],
    });

    const diff = diffDesktopContractGraphs(baseline, current);

    expect(diff.authorityEscalations.map((change) => change.code)).toEqual(
      expect.arrayContaining([
        "desktop-effect-access-changed",
        "desktop-effect-method-added",
        "desktop-grant-access-changed",
        "desktop-grant-scope-changed",
        "desktop-grant-lifetime-changed",
        "desktop-window-command-exposed",
        "desktop-window-remote-origin-added",
      ]),
    );
    expect(
      diff.authorityEscalations.every((change) => change.fingerprint.startsWith("sha256:")),
    ).toBe(true);
    expect(diff.breakingChanges.map((change) => change.code)).toEqual(
      expect.arrayContaining([
        "desktop-grant-access-changed",
        "desktop-grant-scope-changed",
        "desktop-grant-lifetime-changed",
      ]),
    );
  });

  it("records additions, removals, widening, narrowing, and authority reductions", () => {
    const baseline = createGraph();
    const command = baseline.commands[0]!;
    const widened = createGraph({
      commands: [
        {
          ...command,
          input: {
            ...command.input,
            descriptor: {
              kind: "object",
              unknownKeys: "reject",
              fields: [
                ...inputFields,
                { name: "trace", required: false, schema: { kind: "string" } },
              ],
            },
          },
          output: {
            ...command.output,
            descriptor: {
              kind: "object",
              unknownKeys: "reject",
              fields: [
                ...outputFields,
                { name: "version", required: true, schema: { kind: "number" } },
              ],
            },
          },
        },
      ],
    });
    const reduced = createGraph({
      commands: [],
      grants: [],
      problems: [],
      windows: [
        { ...baseline.windows[0]!, exposedCommands: [], receivedEvents: [] },
        {
          ...baseline.windows[1]!,
          originPolicy: {
            ...remoteOriginPolicy,
            allowedOrigins: [remoteOriginPolicy.allowedOrigins[1]!],
          },
        },
      ],
    });

    const widenedDiff = diffDesktopContractGraphs(baseline, widened);
    const reducedDiff = diffDesktopContractGraphs(baseline, reduced);

    expect(widenedDiff.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "desktop-command-input-schema-changed",
          compatibility: "non-breaking",
        }),
        expect.objectContaining({
          code: "desktop-command-output-schema-changed",
          compatibility: "non-breaking",
        }),
      ]),
    );
    expect(reducedDiff.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "desktop-command-removed", compatibility: "breaking" }),
        expect.objectContaining({
          code: "desktop-grant-removed",
          compatibility: "breaking",
          authority: "reduction",
        }),
        expect.objectContaining({
          code: "desktop-window-command-hidden",
          authority: "reduction",
        }),
        expect.objectContaining({
          code: "desktop-window-remote-origin-removed",
          authority: "reduction",
        }),
      ]),
    );
  });

  it("uses distinct exit bits for breaking compatibility and unreviewed authority", () => {
    const clean = diffDesktopContractGraphs(createGraph(), createGraph());
    const breaking = diffDesktopContractGraphs(createGraph(), createGraph({ commands: [] }));
    const escalation = diffDesktopContractGraphs(
      createGraph(),
      createGraph({
        windows: [
          {
            ...createGraph().windows[0]!,
            exposedCommands: ["project.open", "project.admin"],
          },
          createGraph().windows[1]!,
        ],
      }),
    );
    const both = diffDesktopContractGraphs(
      createGraph(),
      createGraph({
        commands: [],
        windows: [
          {
            ...createGraph().windows[0]!,
            exposedCommands: ["project.open", "project.admin"],
          },
          createGraph().windows[1]!,
        ],
      }),
    );

    expect(resolveDesktopContractGraphDiffExitStatus(clean).exitCode).toBe(0);
    expect(resolveDesktopContractGraphDiffExitStatus(breaking).exitCode).toBe(1);
    expect(resolveDesktopContractGraphDiffExitStatus(escalation).exitCode).toBe(2);
    expect(resolveDesktopContractGraphDiffExitStatus(both).exitCode).toBe(3);

    const reviewed = escalation.authorityEscalations.map((change) => change.fingerprint);
    expect(
      resolveDesktopContractGraphDiffExitStatus(escalation, {
        reviewedAuthorityEscalationFingerprints: reviewed,
      }),
    ).toMatchObject({ exitCode: 0, unreviewedAuthorityEscalations: [] });
  });
});

const inputFields = [
  { name: "path", required: true, schema: { kind: "string" as const } },
  { name: "encoding", required: false, schema: { kind: "string" as const } },
] as const;

const outputFields = [
  { name: "contents", required: true, schema: { kind: "string" as const } },
] as const;

const problemSource = {
  package: "@example/problems",
  retryable: false,
  retryability: "not-retryable" as const,
  public: true,
  visibility: "public" as const,
  redaction: "safe" as const,
  cookbookPath: "problems/project.md",
};

const remoteOriginPolicy = {
  mode: "remote-allowlist" as const,
  initialUrl: "https://login.example.com/start",
  allowedOrigins: ["https://accounts.example.com", "https://login.example.com"],
};

function createGraph(overrides: Partial<DesktopContractGraphV1> = {}): DesktopContractGraphV1 {
  return {
    version: "croco.desktop-contract-graph.v1",
    semanticHash: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    app: { contractIds: ["project"], windowIds: ["main", "login"] },
    contracts: [
      {
        id: "project",
        commandIds: ["project.open"],
        eventIds: ["project.changed", "project.saved"],
        grantIds: ["project.selectedFile"],
      },
    ],
    commands: [
      {
        id: "project.open",
        contractId: "project",
        key: "open",
        kind: "query",
        input: {
          id: "project.open.input",
          descriptor: { kind: "object", unknownKeys: "reject", fields: inputFields },
        },
        output: {
          id: "project.open.output",
          descriptor: { kind: "object", unknownKeys: "reject", fields: outputFields },
        },
        effects: [
          {
            namespace: "filesystem",
            access: "read",
            methods: ["readText", "writeText"],
            grantIds: ["project.selectedFile", "project.workspace"],
          },
        ],
        problems: ["PROJECT_READ_FAILED", "PROJECT_WRITE_FAILED"],
        events: ["project.changed", "project.saved"],
        executionPolicy: { mode: "request-response", timeoutMs: 5_000 },
      },
    ],
    events: [
      {
        id: "project.changed",
        contractId: "project",
        key: "changed",
        payload: { id: "project.changed.payload", descriptor: { kind: "string" } },
      },
    ],
    effects: ["filesystem"],
    grants: [
      {
        id: "project.selectedFile",
        contractId: "project",
        key: "selectedFile",
        resource: "file",
        access: "read",
        scope: "exact",
        lifetime: "command",
      },
    ],
    problems: [
      {
        code: "PROJECT_READ_FAILED",
        category: ProblemCategory.InternalServerError,
        source: problemSource,
      },
      {
        code: "PROJECT_WRITE_FAILED",
        category: ProblemCategory.InternalServerError,
        source: problemSource,
      },
    ],
    windows: [
      {
        id: "main",
        trust: "local",
        originPolicy: { mode: "local-content" },
        exposedCommands: ["project.open"],
        receivedEvents: ["project.changed"],
      },
      {
        id: "login",
        trust: "remote",
        originPolicy: remoteOriginPolicy,
        exposedCommands: [],
        receivedEvents: [],
      },
    ],
    diagnostics: [],
    ...overrides,
  };
}
