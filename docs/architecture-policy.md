# Architecture Policy Check

`pnpm architecture-policy:check` validates `croco.arch.json` with the
`@croco/architecture-policy` engine. The gate runs through `pnpm check`.

The policy manifest is a build-time contract for package and layer boundaries:

- package groups such as `framework`, `protocols`, `transports`, `integrations`,
  `presentation`, and `app`;
- forbidden imports from framework/core packages into provider or runtime implementations;
- allowed group edges for generated app packages;
- public entrypoint imports so package consumers do not reach into `src` or `dist` internals;
- deterministic diagnostics with file, line, column, diagnostic code, import specifier, and
  recovery guidance.

This gate is intentionally not a replacement for oxlint, oxfmt, Biome, TypeScript, or
`static-misuse:check`.

| Gate                        | Owns                                                                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------------------- |
| `architecture-policy:check` | Croco package groups, layer edges, package manifest dependencies, public entrypoint import boundaries |
| `static-misuse:check`       | Narrow line-oriented misuse patterns that are easier to express as source text checks                 |
| `oxlint` / `oxfmt` / Biome  | Syntax, style, unused symbols, and lint rules that do not need Croco package context                  |
| `typecheck`                 | TypeScript type contracts and emitted declaration compatibility                                       |
| `public-api:check`          | Export snapshot drift for publishable package entrypoints                                             |

Generated SaaS apps receive their own `croco.arch.json` and an
`architecture-policy:check` script:

```bash
croco architecture-policy check --manifest croco.arch.json
```

The generated policy uses the same engine as this repository. Its manifest keeps app entrypoints,
provider packages, generated provider RPC contracts, Croco framework/protocol packages, selected
integrations, and external SDKs in explicit groups before demo smoke tests run.
