CREATE TABLE croco_billing_accounts (
  namespace text NOT NULL, id text NOT NULL, data jsonb NOT NULL, PRIMARY KEY (namespace, id),
  tenant_id text GENERATED ALWAYS AS (data->>'tenantId') STORED NOT NULL,
  external_id text GENERATED ALWAYS AS (data->>'externalCustomerId') STORED NOT NULL, UNIQUE (namespace, tenant_id), UNIQUE (namespace, external_id)
);
CREATE TABLE croco_billing_subscriptions (
  namespace text NOT NULL, id text NOT NULL, data jsonb NOT NULL, PRIMARY KEY (namespace, id),
  external_id text GENERATED ALWAYS AS (data->>'externalSubscriptionId') STORED NOT NULL, UNIQUE (namespace, external_id)
);
CREATE TABLE croco_billing_commands (
  namespace text NOT NULL, id text NOT NULL, data jsonb NOT NULL, PRIMARY KEY (namespace, id),
  tenant_id text GENERATED ALWAYS AS (data->>'tenantId') STORED NOT NULL,
  state text GENERATED ALWAYS AS (data->>'state') STORED NOT NULL
);
CREATE UNIQUE INDEX croco_billing_commands_pending_tenant ON croco_billing_commands (namespace, tenant_id) WHERE state <> 'completed';
CREATE TABLE croco_billing_orders (namespace text NOT NULL, id text NOT NULL, data jsonb NOT NULL, PRIMARY KEY (namespace, id));
CREATE TABLE croco_billing_webhooks (namespace text NOT NULL, id text NOT NULL, data jsonb NOT NULL, PRIMARY KEY (namespace, id));
CREATE TABLE croco_billing_transitions (namespace text NOT NULL, id text NOT NULL, data jsonb NOT NULL, PRIMARY KEY (namespace, id));
CREATE TABLE croco_cancellation_sessions (namespace text NOT NULL, id text NOT NULL, data jsonb NOT NULL, PRIMARY KEY (namespace, id));
CREATE TABLE croco_cancellation_policies (namespace text NOT NULL, id text NOT NULL, data jsonb NOT NULL, PRIMARY KEY (namespace, id));
CREATE TABLE croco_cancellation_policy_audits (namespace text NOT NULL, id text NOT NULL, data jsonb NOT NULL, PRIMARY KEY (namespace, id));
