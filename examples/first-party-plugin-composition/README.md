# First-party plugin composition examples

These examples show Croco's canonical **Profile → Application module → Host/Transport** composition
path. Every example builds and inspects its graph without credentials. Provider constructors receive
explicit inert configuration; no live external call runs unless an application deliberately invokes
the resulting provider.

Plugin metadata and package readiness are separate contracts. The executable graph exposes each
plugin's self-declared maturity, while `docs/package-catalog.json` remains authoritative for package
maturity and certification. The table below uses the catalog values.

| Example                   | First-party plugin                                 | Catalog maturity / certification            | Verification limit                                                                                                      |
| ------------------------- | -------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `auth.ts`                 | `betterAuth()`                                     | alpha / no record                           | Builds the auth plugin graph with `drizzle.mock()`; no database or auth request is made.                                |
| `datastore.ts`            | `drizzleTransaction()`                             | production / no record                      | Builds the persistent transaction boundary; this example makes no certification claim and opens no database connection. |
| `billing.ts`              | `polarBilling()`                                   | beta / uncertified                          | Builds the billing provider graph; no Polar call is made.                                                               |
| `tasksTelemetry.ts`       | `qstashTasks()`, `nodeTelemetry()`                 | alpha / uncertified; production / certified | Builds queue and telemetry ownership; telemetry stays disabled.                                                         |
| `productionGoldenPath.ts` | HTTP, auth, transaction, billing, queue, telemetry | mixed                                       | Starts a local Node host with one application module and one HTTP transport. External provider calls remain opt-in.     |

Run the CI-equivalent checks from the repository root:

```bash
pnpm --filter @croco-example/first-party-plugin-composition... build
pnpm --filter @croco-example/first-party-plugin-composition test
```

Print the inspectable plugin/module graph without credentials:

```bash
pnpm --filter @croco-example/first-party-plugin-composition start
```
