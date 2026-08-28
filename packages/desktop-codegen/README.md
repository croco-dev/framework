# @croco/desktop-codegen

Deterministic generators for Croco desktop contract artifacts.

## Preload bridges

`@croco/desktop-codegen` turns `croco.desktop-contract-graph.v1` artifacts into one deterministic preload bridge
source file per local window profile. Remote windows never receive an artifact.

Each generated module exposes a fixed `crocoDesktop` API through the supplied Electron `contextBridge`. Commands
and events are nested by contract and member key; their full IDs are bound inside generated closures and cannot be
selected by renderer input. Event subscriptions forward payloads only. The renderer never receives `ipcRenderer`,
`send`, `invoke`, an Electron event object, or the internal transport.

```typescript
import { generateDesktopPreloadBridges } from "@croco/desktop-codegen";
import { compileDesktopContractGraph } from "@croco/protocols-desktop";

const artifacts = generateDesktopPreloadBridges(compileDesktopContractGraph(app));
```

Generated preload bridge installers accept exactly two reviewed boundaries: a context bridge with
`exposeInMainWorld("crocoDesktop", api)` and `DesktopPreloadTransport`. The transport can invoke a fixed command ID
or subscribe to a fixed event ID, and subscriptions receive payloads rather than Electron event objects. The later
Electron runtime adapter owns the concrete transport implementation, executes each installer, and validates senders.

The generator does not write files, import Electron, expose handwritten preload extension points, or implement IPC
runtime behavior. Callers choose where to persist the returned `{ windowId, source }` artifacts.

## Renderer clients

`generateDesktopRendererClients(graph)` emits one browser-safe TypeScript client for each local window profile and
no client for remote windows. Generated clients expose only contract methods and payload-only event subscriptions:

```typescript
import { desktop } from "./generated/desktop";

const result = await desktop.project.readFile({ path: "README.md" }, { signal });
const unsubscribe = desktop.project.fileChanged.subscribe((payload) => {
  console.log(payload.path);
});
```

Command IDs, event IDs, bridge namespaces, response generics, and timeout controls remain private to generated code.
Callers may pass only an `AbortSignal`; the contract's execution timeout cannot be replaced or extended. Input,
output, grant-reference, Problem-union, and event-payload types are derived from the deterministic
`DesktopContractGraph` rather than caller-selected generics.

Generation fails when the graph has diagnostics, duplicate or missing records, inconsistent member IDs, unresolved
Problems or grants, or missing schema descriptors. Output ordering is independent of declaration order.

## Verification

```bash
pnpm --filter @croco/desktop-codegen test
pnpm --filter @croco/desktop-codegen typecheck
pnpm --filter @croco/desktop-codegen lint
pnpm --filter @croco/desktop-codegen build
```
