# @croco/desktop-codegen

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

## Verification

```bash
pnpm --filter @croco/desktop-codegen test
pnpm --filter @croco/desktop-codegen typecheck
pnpm --filter @croco/desktop-codegen lint
pnpm --filter @croco/desktop-codegen build
```
