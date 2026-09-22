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
