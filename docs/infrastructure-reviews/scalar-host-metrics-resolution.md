# Scalar and host-metrics dependency resolution

This review covers repository and generated pnpm workspace overrides, not published package dependency floors or a new runtime claim. The existing GraphQL 16 / Node 24 requirements satisfy graphql-scalars 2.x. TypeGraphQL retains its upstream 1.x peer declaration; root overrides are required to select the tested 2.0.1 scalar implementation.

| Profile    | Result      | Existing provider and constraints                                                                                                                                                                                                               | Evidence                                                                                                                                   |
| ---------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| kubernetes | unverified  | Node Host with `@croco/transports-graphql` and `@croco/telemetry-sdk-node`; application-owned initialization, shutdown and OTLP flush remain required. No cluster deployment ran.                                                               | `packages/transports-graphql/src/tests/GraphQLScalarSecurity.spec.ts`; `packages/telemetry-sdk-node/src/tests/HostMetricsSecurity.spec.ts` |
| aws-lambda | unverified  | Lambda Host with the same GraphQL and Node telemetry providers; await invocation work and flush before completion. No live AWS execution ran.                                                                                                   | `examples/quick-start-lambda`; `packages/telemetry-sdk-node/src/libs/presets/lambda.ts`                                                    |
| cloudflare | conditional | GraphQL uses the existing Workers transport path and GraphQL 16 contract. Node host metrics are unsupported in Worker isolates; an explicit Node Container deployment remains unverified. No Workers or Container deployment is certified here. | `examples/workers-protocols`; `packages/telemetry-sdk-node/package.json`; `docs/package-catalog.json`                                      |

The Windows regression captures the actual dependency command builder in an isolated worker with its PowerShell sink replaced; it runs no shell and does not establish Windows host support.

## Reviewed content

SHA-256 binds the dependency decision and catalog snapshot:

- `pnpm-workspace.yaml`: `90780eb42f551a00399f00baa693a0a1076a905a818324c9c1e8ba7dde8f4848`
- `pnpm-lock.yaml`: `aa851867e242d84ee577326d1dc12eb10f9f033bbfe63fff2521effd7dcced4f`
- `docs/package-catalog.json`: `46cb9e796f9666803d9c7c7742c71a8b666a0030c3aca0b1e3aea8a707335990`
