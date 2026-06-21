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
