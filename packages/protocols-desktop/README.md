# @croco/protocols-desktop

`@croco/protocols-desktop` defines browser-safe, typed desktop application contracts. Command and event IDs come
from contract and member object keys, so application code never repeats an IPC channel string.

This package owns declarations and the browser-safe DesktopWire schema boundary. It does not import Electron, Node
runtime APIs, a transport, or application bootstrap code. Handler registration, preload/client generation, and
Electron process integration are separate layers.

Its public package boundary is intentionally narrow: production code may depend on
`@croco/problems-core` and `@croco/protocols-core`; `zod` and `vitest` are development-only schema and test tooling.
Consumers must import from `@croco/protocols-desktop`, not its `src/**` implementation paths. Architecture and
dependency-boundary gates enforce these constraints for source imports and package manifests.

## Define an application

```typescript
import { compileDesktopWireSchema, desktop, parseDesktopWireValue } from "@croco/protocols-desktop";
import { z } from "zod";

const fileChanged = desktop.event({
  payload: z.object({ path: z.string() }),
});
const filesystemRead = desktop.effect({
  namespace: "filesystem",
  access: "read",
  methods: {
    readText: desktop.effect.method<[path: string], Promise<string>>(),
  },
});
const filesystemWrite = desktop.effect({
  namespace: "filesystem",
  access: "write",
  methods: {
    writeText: desktop.effect.method<[path: string, contents: string], Promise<void>>(),
  },
});

const project = desktop.contract({
  commands: {
    readFile: desktop.query({
      input: z.object({ path: z.string() }),
      output: z.object({ contents: z.string() }),
      effects: [filesystemRead],
      events: ["fileChanged"],
    }),
    saveFile: desktop.mutation({
      input: z.object({ path: z.string(), contents: z.string() }),
      output: z.object({ saved: z.boolean() }),
      effects: [filesystemWrite],
      events: ["fileChanged"],
    }),
  },
  events: {
    fileChanged,
  },
});

export const app = desktop.app({
  contracts: { project },
  windows: {
    main: desktop.window.local({
      expose: [project.commands.readFile, project.commands.saveFile],
      receive: [project.events.fileChanged],
    }),
    login: desktop.window.remote({
      initialUrl: "https://login.example.com",
      allowedOrigins: ["https://login.example.com"],
    }),
  },
});
```

The application definition assigns `project.readFile`, `project.saveFile`, and `project.fileChanged` without
accepting user-provided IDs. Local windows have typed command exposure and event receipt. Remote windows have a
separate type that cannot express either privileged field.

`app.metadata` is a deterministic `croco.desktop-app-definition.v1` artifact. It preserves contract/member keys,
derived IDs, command kinds, window trust, and local capability references for the later desktop compiler. Invalid
keys, unresolved local-window references, and references made ambiguous by mounting one contract under multiple
keys are rejected with stable `DesktopDefinitionProblem` codes.

## Declare least-authority handlers

`app.implement()` derives every handler key, input, result, event, Problem, cancellation signal, and effect method
from the mounted contracts. It has no runtime registration or effect implementation behavior; later desktop runtime
layers consume the implementation after this type-only boundary has proven complete coverage and authority.

```typescript
app.implement({
  contracts: {
    project: {
      commands: {
        readFile: async ({ path }, ctx) => {
          const contents = await ctx.filesystem.readText(path);
          await ctx.emit(project.events.fileChanged, { path });
          return ctx.ok({ contents });
        },
        saveFile: async ({ path, contents }, ctx) => {
          ctx.signal.throwIfAborted();
          await ctx.filesystem.writeText(path, contents);
          await ctx.emit(project.events.fileChanged, { path });
          return ctx.ok({ saved: true });
        },
      },
    },
  },
});
```

Every mounted contract and command needs a handler. Unknown contract, command, and nested keys are rejected at
typecheck. Undeclared effect namespaces, effect methods, and events are absent from `ctx`; `ctx.ok()` preserves the
exact output, while `ctx.fail()` accepts only the command's declared Problem constructors. A command with no declared
Problems cannot call `ctx.fail()`. Handlers return `DesktopResult` directly or through a promise. The API derives IDs
from the app definition, so no handler string ID or IPC channel is supplied.

Effects are declarations only. `desktop.effect.method()` records a callable signature without accepting an
implementation, so this package cannot invoke Electron, filesystem, dialog, shell, secret, or process APIs. Runtime
adapters must provide those capabilities later from the command's exact effect tuple. Every effect declares `read`
or `write` access explicitly and may name the opaque grants it consumes. The graph compiler rejects write effects on
queries and any effect/grant access mismatch.

Keep `effects`, `events`, and `problems` as literal tuples. Widened arrays, dynamic effect namespaces, open-ended
method records, and conditional tuple elements are rejected because they would grant more handler authority than one
runtime declaration proves. Declared Problem classes must expose a literal `code` discriminant:

```typescript
import { Problem, ProblemCategory } from "@croco/problems-core";

class ProjectReadProblem extends Problem {
  declare readonly code: "PROJECT_READ_FAILED";

  constructor() {
    super("PROJECT_READ_FAILED", ProblemCategory.InternalServerError);
  }
}
```

This type declaration must match the stable code passed to the Problem base constructor by the real class
constructor. Problem Registry validation and renderer-safe serialization remain the responsibility of the later
desktop compiler layer.

`DesktopHandlerContext` and `DesktopCommandHandler` require both the command and its owning contract as type
arguments. The contract is the evidence used to resolve declared event keys, so an unbound command cannot acquire
event authority through a broad default.

## Declare opaque resource grants

Resource grants model authority without placing a filesystem path in a renderer-facing command type. A grant is a
Standard Schema-compatible input declaration: its inferred value is an opaque branded token, and its definition
records the permitted resource kind, access, scope, and lifetime. File grants are exact-resource only; directory
grants may use exact or descendant scope.

```typescript
const selectedFile = desktop.grant.file({
  access: "read",
  scope: "exact",
  lifetime: "command",
});
const workspace = desktop.grant.directory({
  access: "write",
  scope: "descendant",
  lifetime: "session",
});

const project = desktop.contract({
  grants: { selectedFile, workspace },
  commands: {
    read: desktop.query({ input: selectedFile, output: z.object({ contents: z.string() }) }),
    save: desktop.mutation({ input: workspace, output: z.object({ saved: z.boolean() }) }),
  },
});

const app = desktop.app({ contracts: { project }, windows: {} });

app.contracts.project.grants.selectedFile.id; // "project.selectedFile"
```

Grant IDs are derived from the mounted contract and grant member keys, never supplied by the renderer. The
deterministic contract and app metadata preserve the serialized grant policy for the future compiler and runtime;
this package does not issue, redeem, or validate tokens and never accepts a filesystem path as a grant reference.

## Compile the desktop contract graph

`compileDesktopContractGraph(app)` produces the explicit `croco.desktop-contract-graph.v1` artifact consumed by
later generators and runtime-authority layers. Contracts, commands, events, grants, and windows are ordered by
stable IDs. Every command includes its input and output descriptors plus explicit effect, Problem, emitted-event,
and request-response execution-policy fields. Effects record their namespace, access, method names, and mounted grant
IDs. Problem lists remain empty until the Problem Registry integration tracked separately is available.

Commands may declare positive integer `timeoutMs`, `maxInputBytes`, `maxOutputBytes`, and `maxConcurrency` values in
`executionPolicy`. Invalid values are omitted from the executable policy and retained as blocking diagnostics; the
compiler never replaces them with a runtime default.

The graph records local-window exposure and receipt, remote-window origin allowlists, opaque grant references, and
structured schema diagnostics. Unsupported schemas produce a `null` descriptor and diagnostic data in the graph;
they are never formatted away or degraded to an unvalidated schema. `stringifyDesktopContractGraph(graph)` emits
canonical, trailing-newline JSON.

Semantic diagnostics cover duplicate or reserved IDs, missing references, query/write authority, effect/grant access,
remote-window exposure and origin policy, and execution limits. Every diagnostic carries a stable code, target kind,
member ID, message, recovery guidance, and source evidence when supplied. Use
`formatDesktopContractGraphDiagnostic(diagnostic)` for human output and
`stringifyDesktopContractGraphDiagnostics(diagnostics)` for canonical JSON from those same objects.

The semantic hash is SHA-256 over canonical semantic fields. Source evidence and diagnostic prose are excluded,
while stable diagnostic codes and targets remain part of the identity. Optional source locations may be supplied by
graph ID: `app`, `contract:<contract-id>`, `window:<window-id>`, command/event/grant IDs, and the schema IDs
`<command-id>.input`, `<command-id>.output`, or `<event-id>.payload`. Checkout prefixes and platform separators are
normalized through the explicit `sourceRoot` before source evidence is serialized. Without a source root, the full
path is preserved with forward-slash separators so distinct files never collapse to the same evidence location.

```typescript
const graph = compileDesktopContractGraph(app, {
  sourceLocations: {
    app: { path: "/workspace/apps/editor/src/desktop.ts", line: 10 },
    "contract:project": { path: "/workspace/packages/editor/src/project.contract.ts", line: 12 },
    "project.readFile.input": {
      path: "/workspace/packages/editor/src/project.contract.ts",
      line: 18,
    },
  },
  sourceRoot: "/workspace",
});

graph.semanticHash; // "sha256:..."
```

## Compile and validate DesktopWire schemas

`compileDesktopWireSchema(schema, context)` compiles strict objects, strings, finite numbers, booleans, null,
literals, enums, arrays, optional/nullable values, and structural unions into a deterministic descriptor. Object
fields and union branches use code-unit ordering, and `stringifyDesktopWireSchemaDescriptor()` emits a trailing-newline
JSON artifact that is stable across platforms.

`parseDesktopWireValue(schema, value, context)` validates the compiled DesktopWire shape without delegating to
schema effects or object-stripping behavior. It rejects unknown object keys by default, including nested keys, and
accepts only plain objects rather than class or Electron instances.

The compiler fails closed for `any`, `unknown`, transforms, preprocessors, refinements, coercions, constrained
primitives, passthrough/catchall objects, recursive/lazy schemas, Date, Map, Set, functions, symbols, and all other
unsupported shapes. It never emits `unknown` or an unvalidated passthrough. `DesktopWireSchemaProblem.diagnostics`
identifies the stable code, contract member, nested schema path, recovery, and source location when supplied:

```typescript
const descriptor = compileDesktopWireSchema(project.commands.readFile.input, {
  contractMember: "project.readFile.input",
  sourceLocation: { path: "src/project.contract.ts", line: 7, column: 14 },
});

const input = parseDesktopWireValue(
  project.commands.readFile.input,
  { path: "README.md" },
  { contractMember: "project.readFile.input" },
);
```

## Type inference

The package exports `InferDesktopCommandInput`, `InferDesktopCommandOutput`, `InferDesktopCommandProblem`,
`InferDesktopEventPayload`,
`InferDesktopContractCommands`, `InferDesktopContractEvents`, `InferDesktopAppContracts`, and
`InferDesktopAppWindows`, `DesktopAppImplementation`, `DesktopContractImplementation`, and
`DesktopCommandHandler`, `DesktopHandlerContext`, and `DesktopResult`. Schema inference supports Standard Schema output metadata, Zod-compatible `_output`
metadata, and structural `parse()` return types without making a schema library a runtime dependency.

## Verification

```bash
pnpm --filter @croco/protocols-desktop test
pnpm --filter @croco/protocols-desktop typecheck
pnpm public-api:check
pnpm docs:api:check
```
