# @croco/framework-routes

Build-time route and framework manifest utilities.

`@croco/framework-routes` converts decorated controllers and route contracts into
inspectable registration tables, generated modules, project intent maps, and framework
manifests. It keeps routing glue explicit so build, docs, and LLM tooling can validate
the same artifacts.

## Public API

- Route compiler helpers such as `compileRoutes`, `createRouteRegistrationTable`, and
  `generateRouteRegistrationCode`.
- Manifest helpers such as `createFrameworkManifest` and
  `createFrameworkManifestFromIntentMap`.
- Intent-map helpers such as `createProjectIntentMap`.
- Metadata readers for controller constructors and route metadata.

## Usage

```typescript
import { compileRoutes, createRouteRegistrationTable } from "@croco/framework-routes";

const compiled = compileRoutes([UserController]);
const table = createRouteRegistrationTable(compiled);
```

## Component discovery

Project intent maps recognize top-level classes decorated with `Component` imported
from `@croco/framework-context`, including named aliases (`Component as Service`)
and namespace imports (`import * as Context`, then `@Context.Component()`). Provider
identity, literal scope options and constructor dependency edges use the same output
contract for each form. Scope is read from the Component call itself.

Type-only imports, unrelated local or third-party decorators, local wrappers and
Component re-exports through application barrels are not inferred as Croco providers.
Discovery parses source without executing decorators or resolving application modules.

## Verification

```bash
pnpm --filter @croco/framework-routes test
pnpm --filter @croco/framework-routes typecheck
```
