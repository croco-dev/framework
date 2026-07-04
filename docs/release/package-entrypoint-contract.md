# Package Entrypoint Contract

Croco workspace package manifests have two separate consumers:

- Local workspace tools can use source entrypoints such as `./src/index.ts`.
- Published npm packages must expose only built files under `./dist`.

`publishConfig` is the authoritative publish contract. `pnpm publish` applies those fields to
the packed manifest, so every public runtime package must keep these fields normalized:

- `publishConfig.access` is `public`.
- Root `files` includes the package artifacts shipped to npm, usually `["dist"]`.
- `publishConfig.main`, `publishConfig.types`, and `publishConfig.exports` point to `./dist`.
- Type declaration targets are strings ending in `.d.ts`, not arrays.
- `publishConfig.files` is not used; artifact allowlists live at root `files`.

Decorator and metadata packages use a package-owned side-effect import contract: if non-test source
imports `reflect-metadata`, that package must declare `reflect-metadata` in runtime
`dependencies`. Keeping it only in `devDependencies`, or relying on another Croco package to hoist it
for consumers, is not valid because strict package managers may isolate transitive dependencies.

Internal Croco package references use `workspace:*` in source manifests across `dependencies`,
`devDependencies`, `peerDependencies`, and `optionalDependencies`. This includes internal peer
dependencies: pnpm rewrites `workspace:*` to the target workspace package version during
[pack and publish](https://pnpm.io/workspaces#publishing-workspace-packages), so source manifests do
not need hand-written internal semver ranges. If a future public peer compatibility range must stay
as semver in source, add an exact checked exception to
`scripts/internal-peer-dependency-range-exceptions.json` with the package name, `peerDependencies`
section, internal dependency name, range, and compatibility rationale. Exceptions are peer-only;
internal `dependencies`, `devDependencies`, and `optionalDependencies` still use `workspace:*`.

The contract is enforced by:

```bash
pnpm package-manifests:check
pnpm package-manifests:write
```

`pnpm check` runs the check mode, and the release workflow runs the same gate before build and
publish dry-run.

## Croco 1.0 Spine Root Entrypoints

Importable packages listed in `docs/package-catalog.json` `spine.packages` use one canonical
workspace manifest pattern:

- root `main` and `types` point to `./src/index.ts` for local workspace tooling;
- root `module` and root `exports` are omitted;
- `publishConfig.main`, `publishConfig.types`, and `publishConfig.exports` point to `./dist`.

This keeps the local development face intentionally separate from the npm publish face while making
`publishConfig` the single packed-package contract. `pnpm package-manifests:check` loads the spine
catalog, rejects unmapped catalog entries, and enforces the source-root pattern for every importable
spine package unless a package has a checked direct-dist entrypoint exception.

Direct-dist root exceptions live in `scripts/package-manifest-contracts.mjs`
`DIRECT_DIST_ENTRYPOINT_EXCEPTIONS`. Each exception must name a rationale, keep root `main`,
`types`, and `exports` aligned with `publishConfig`, and keep any root `module` field aligned with
the root import target. `pnpm package-entrypoints:smoke` also reports root/publish face mismatches
for those exceptions before it smokes the merged publish manifest.

`@croco/docs` is an Astro documentation site, not an importable runtime package or npm artifact. It
must remain `private: true`, with no `publishConfig.access`, so npm, pnpm recursive publish, and
Changesets cannot select it for publish or tagging work. If the docs manifest becomes public again,
the package manifest and entrypoint gates should fail instead of treating it as a runtime-package
exception.

## Exceptions

- `create-croco-app` is a bin-only project generator. It ships `dist` and `templates`, but does
  not expose an import entrypoint because importing it would execute the CLI.
- Direct-dist root entrypoint exceptions are checked in
  `scripts/package-manifest-contracts.mjs`: `@croco/problems-core`, `@croco/rpc-codegen`,
  `@croco/storage-cloudinary`, `@croco/storage-core`, `@croco/storage-r2`, and
  `@croco/telemetry-api`.
