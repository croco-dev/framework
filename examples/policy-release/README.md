# Standalone banner policy

This example registers a bounded banner policy in application code, then creates a draft, reviews its exact revision, publishes it, resolves the active version, and evaluates a decision. It runs with the in-memory store and needs no admin console or credentials.

```bash
pnpm --filter @croco/features-core build
pnpm --filter @croco-example/policy-release start
```

The example fixes its clock and limits edits to a title and a view cap of 1–5. The explicit application, environment, and tenant scope is checked before each operation. Use `@croco/features-drizzle` and its migration for durable PostgreSQL releases and scheduled publication; the in-memory store does not survive process restart.
