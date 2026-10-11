-- Local fake provider state. Never apply this fixture to a production billing database.
CREATE TABLE cancellation_sandbox_provider_commands (
  id text PRIMARY KEY,
  subscription_ref text NOT NULL,
  action text NOT NULL
);
CREATE TABLE cancellation_sandbox_quotes (
  subscription_ref text PRIMARY KEY,
  data jsonb NOT NULL
);
INSERT INTO cancellation_sandbox_quotes(subscription_ref, data) VALUES (
  'synthetic-subscription',
  '{"appId":"cancellation-example","environment":"sandbox","tenantId":"sandbox-customer","subject":"synthetic-customer","subscriptionRef":"synthetic-subscription","subscriptionStartedAt":"2026-09-01T00:00:00.000Z","billingPeriod":"renewal","quote":{"ref":"synthetic-quote:1","expiresAt":"2099-01-01T00:00:00.000Z","refund":"partial","amount":"5.00","currency":"USD"}}'
);
