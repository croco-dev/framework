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

`@croco/docs` is an Astro documentation site, not an importable runtime package or npm artifact. It
must remain `private: true`, with no `publishConfig.access`, so npm, pnpm recursive publish, and
Changesets cannot select it for publish or tagging work. If the docs manifest becomes public again,
the package manifest and entrypoint gates should fail instead of treating it as a runtime-package
exception.

## Exceptions

- `create-croco-app` is a bin-only project generator. It ships `dist` and `templates`, but does
  not expose an import entrypoint because importing it would execute the CLI.
