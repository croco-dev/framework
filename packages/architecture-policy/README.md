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
