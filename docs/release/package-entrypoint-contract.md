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

The contract is enforced by:

```bash
pnpm package-manifests:check
pnpm package-manifests:write
```

`pnpm check` runs the check mode, and the release workflow runs the same gate before build and
publish dry-run.

## Exceptions

- `@croco/docs` is an Astro documentation site, not an importable runtime package.
- `create-croco-app` is a bin-only project generator. It ships `dist` and `templates`, but does
  not expose an import entrypoint because importing it would execute the CLI.
