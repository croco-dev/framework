# @croco/architecture-policy

Declarative static architecture policy engine for Croco repositories and generated apps.

It validates package groups, forbidden imports, allowed group edges, manifest dependencies, and
public package entrypoint imports before runtime. The user-facing CLI is exposed through
`@croco/cli`:

```bash
croco architecture-policy check --manifest croco.arch.json
```

The engine is intentionally separate from oxlint and format checks. It reasons over Croco package
contracts, generated app manifests, and package export surfaces; syntax and style remain owned by
oxlint, oxfmt, and TypeScript.

Source imports use the nearest `tsconfig.json` within the checked repository and TypeScript's module
resolution for each import, including inherited `extends`, `baseUrl`, and `paths`. Aliases into
another workspace package receive that package's group and entrypoint checks. Aliases to files in the
same package remain local. A package-name alias that redirects a declared source export is checked
against the export's target. Built exports under `dist` retain their declared package specifier when
the project maps them to source.
Invalid configuration fails with `architecture-policy/tsconfig`, including the configuration path,
TypeScript diagnostics, and recovery guidance. Correct the configuration or its `extends` chain
before rerunning the check.

The `publicEntrypoints` rule checks all scoped and unscoped workspace packages when
`includePackages` is omitted. An explicit filter keeps the existing glob semantics: `*` selects
unscoped names, `@croco/*` selects that scope, and an empty array selects no packages.

Manifest parsing and direct `checkArchitecturePolicy` calls reject malformed fields before normalization with
`architecture-policy/manifest-shape`. The Problem includes `extensions.field` and
`extensions.recovery` so callers can locate and correct the declaration. Rule IDs must be non-empty,
selectors must be arrays of non-empty strings, and `appliesTo`, when present, must contain only
`source` or `package-manifest` and cannot be empty. Unknown fields are rejected rather than ignored.
Each `publicEntrypoints.ignoreImports` entry needs at least one non-empty `paths`, `packages`, or
`specifiers` selector; all supplied selectors must match for an import to be exempted. `packages`
selects the imported package. Empty rule collections and empty allow-lists remain valid.

For `forbiddenImports`, all supplied fields in both `from` and `to` must match. `from.groups`,
`from.packages`, and `from.paths` select the importing group, package, and file path;
`from.specifiers` filters the import's module specifier using the same glob patterns as
`to.specifiers`. This condition also applies to dependency names in package manifests.
