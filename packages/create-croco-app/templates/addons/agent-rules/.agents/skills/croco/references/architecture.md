# Architecture

Croco assigns public packages one top-level role in `docs/package-catalog.json`:

- **Kernel**: runtime primitives.
- **Contracts**: provider- and runtime-neutral domain, protocol, and observability contracts.
- **Plugins**: concrete providers, protocols, transports, hosts, integrations, and presentations.
- **Application**: app-owned modules and the composition root.
- **Profiles**: tested, opinionated plugin/module compositions.
- **Tooling**: build targets, code generation, testing, CLI, policy, and migrations.

These roles describe dependency direction, not request execution order. Application code composes Profiles and Plugins. Plugins depend on Contracts and Kernel primitives. Contracts and Kernel must not import concrete Plugins.

## Inspect before editing

Prefer machine-readable project evidence in this order:

1. `croco-runtime-capability.manifest.json` for platform capabilities and host/transport/build-target composition.
2. `croco-saas-profile.manifest.json` for selected providers, configuration names, and smoke commands.
3. `croco.arch.json` for package groups and forbidden dependency edges.
4. `package.json` scripts and `@croco/*` dependencies for available verification and installed packages.
5. The application composition root and module graph.

An absent manifest is absence of evidence, not proof of universal compatibility. Inspect the selected plugin's metadata and package documentation before making a runtime claim.

## Composition boundary

The normal path is:

`Profile → defineCrocoApplication() → application-owned modules → transport → host`

Hosts own environment lifecycle. Transports execute protocols inside the application scope. Build targets describe artifacts and do not start a host or execute a transport. Bind host callbacks through the application's runtime boundary so requests re-enter the owning scope.

## Generated application wiring

The current [compile-time DI contract](https://github.com/croco-dev/framework/blob/trunk/docs/architecture/compile-time-di.md) preserves `@Component`, constructor injection, and static `@Inject` tokens. The compiler discovers selected server sources and emits factories and a validated graph. A new service under the default scan root does not also belong in bootstrap imports or hand-written services, dependencies, or factory lists. Explicit modules still own visibility, selected plugins, external SDK factories, secrets, and overrides. Build-time discovery of selected sources or descriptors does not permit runtime discovery of every installed package or import-time global registration.

The current framework context no longer depends on TypeDI. When migrating an older application, validate its generated graph, application scopes, disposal, and host callback isolation before removing its remaining TypeDI wiring. Keep metadata needed by non-DI decorators. Function and factory APIs remain valid for external SDK boundaries and standalone use; do not require class authors to repeat their schemas, dependencies, or handler lists. Convergence of decorated operations and functions on shared operation, guard, and client contracts is a target, not permission to invent missing APIs.

## Product and data boundaries

Preserve Croco's SSR/RSC and `meta-vite` path, GraphQL selection and partial errors, tRPC inference, REST input and status semantics, and TanStack Query/Apollo cache ownership. Growth integration must retain private SSR isolation, experiment assignment versus actual exposure, current eligibility and price authority, and cache/performance policy. Reuse upstream engines while keeping Croco's product policies and measurement provenance explicit. Desktop removal and delegation of generic LLM execution do not authorize removing CLI/MCP, review, or usage, budget, and PII controls.

Use the [architecture guide](https://github.com/croco-dev/framework/blob/trunk/packages/docs/src/content/docs/en/guides/architecture.mdx) and [data recipe](recipes.md#data-and-measurement) for data ownership and current implementation limits. Do not add a parallel growth-data layer, database, optimizer, ETL scheduler, or generic serving platform. Pure calculations accept normalized inputs without requiring a database; integrated collection and storage reuse the existing ETL and provider boundaries and expose those dependencies.
