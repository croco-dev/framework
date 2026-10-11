# Subscription cancellation and retention

This example composes `CancellationService`, `BillingService`, PostgreSQL stores,
`CancellationFlow` and `RetentionOfferConsole` without Offer, Survey, Experiment or a shared slot.
The customer can skip the optional reason, decline the offer, and confirm cancellation directly.

`createCancellationExample()` in `src/index.ts` accepts the application's real `BillingGateway`,
authenticated authority and PostgreSQL connection. The authority owns refund quotes and serializes
subscription/quote changes against command admission. Croco does not calculate refunds or infer
refund execution from cancellation. The built-in billing action schedules cancellation at period end
or resumes a scheduled cancellation. Additional plan actions require a code-registered adapter.

Apply `packages/billing-drizzle/migrations/0001_billing.up.sql` with your reviewed migration runner
before starting. The runtime never applies DDL. Keep existing financial data in the application's
billing store; migrating an existing custom store requires a separately reviewed data mapping.

For the local sandbox only, also apply `examples/cancellation-flow/sandbox.sql`. It contains the
synthetic provider's command state and authoritative quote fixture; neither table belongs in a
production deployment. The server validates the fixture's owner and consumes its amount unchanged.

The local sandbox uses synthetic accounts, application-owned quote fixtures and a stateful fake
provider. PostgreSQL persists real billing lifecycle commands, sessions and policy audits. It never
contacts a live payment provider. Supply a dedicated development database:

```bash
CANCELLATION_DATABASE_URL=postgres://user:password@localhost:5432/cancellation \
  pnpm --filter @croco-example/cancellation-flow dev
```

Open `http://127.0.0.1:4184/` for the customer flow and `/retention` for the console.
The server resolves its synthetic owner and operator; browser edit payloads cannot choose actors,
subjects or tenants. In a real app, replace this sandbox identity with authenticated server context
and verify subscription ownership in the authoritative source.

The example shows exact quote amounts in major currency units. Full or partial quotes are eligibility and
display evidence, not proof of refund execution. Cancellation scheduling and subscription ending
remain separate outcomes. Unsupported lower-plan choices remain disabled.
