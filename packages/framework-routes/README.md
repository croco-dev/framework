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

When supplied a `ContractGraph`, `assertRouteRegistrationTable` and
`createRouteRegistrationTable` validate method, runtime and authored paths, and
controller/handler bindings as well as route ID coverage. Drift fails with
`route-registration-contract-drift`, listing the mismatched fields and the contract
source location when available. Legacy v1 entries without `contractPath` compare
their normalized runtime path; entries with `contractPath` retain the exact authored
path check.

## Generated artifact ignore policy

The default artifact policy inspects the project and ancestor `.gitignore` files.
Literal paths are relative to the directory containing each ignore file; a leading
`/` and a trailing directory `/` are accepted. The existing `**/.croco/build` rule
also covers nested projects. Matching preserves path-component boundaries and the
original rule in `gitIgnoreRule`.

This inspection supports positive literal paths and that specific recursive build
rule. It is not a complete Git ignore evaluator: general globbing, negation and
Git rule precedence are not supported.

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

## Generated HTTP execution

Generated tables mark routes with parameter decorators, route contracts, response schemas,
status declarations or pipeline metadata with `invocation: "rest"`. Their generated modules
require `@croco/transports-http` in the consuming application. Registration reuses its
`RouteCompiler` and `CrocoRouteRegistrar`: parameter extraction and validation, DI-resolved
pipes/guards/interceptors/filters, response validation, Problem responses and success status
handling follow the runtime HTTP path. Controller and pipeline providers must be installed
in the active application scope before registration and request execution.

Metadata-free handlers retain the existing raw Hono `c` argument and must return a `Response`.
Use `@Raw()` for the Hono context or `@Ctx()` for the Croco context in decorated signatures;
undecorated arguments are not implicitly bound alongside parameter decorators. A legacy
entry without the REST invocation marker cannot silently execute a controller that now has
REST binding metadata: registration fails with `route-registration-missing-rest-invocation`.
Regenerate its table and module together. Changed method/path bindings fail with
`route-registration-rest-binding-drift`.

The generated module registers only its table's endpoints. It does not bootstrap an application
or install application-wide security middleware or global providers. Keep those in the existing
application composition root. The shared registrar retains request scope and response-consumption
lifecycle behavior. This integration does not extend the transport's deployment support.
