-- Explicit host migration. Never applied at service construction or read time.
CREATE TABLE croco_learning_records (
  app_id text NOT NULL, environment text NOT NULL, tenant_id text NOT NULL,
  id text NOT NULL, revision bigint NOT NULL CHECK (revision > 0), payload jsonb NOT NULL,
  PRIMARY KEY (app_id, environment, tenant_id, id)
);
CREATE TABLE croco_learning_history (
  app_id text NOT NULL, environment text NOT NULL, tenant_id text NOT NULL,
  id text NOT NULL, revision bigint NOT NULL, payload jsonb NOT NULL,
  actor text NOT NULL, reason text NOT NULL, at timestamptz NOT NULL,
  PRIMARY KEY (app_id, environment, tenant_id, id, revision),
  FOREIGN KEY (app_id, environment, tenant_id, id) REFERENCES croco_learning_records
);
CREATE TABLE croco_learning_receipts (
  app_id text NOT NULL, environment text NOT NULL, tenant_id text NOT NULL,
  actor text NOT NULL, command_key text NOT NULL, fingerprint text NOT NULL, payload jsonb NOT NULL,
  PRIMARY KEY (app_id, environment, tenant_id, actor, command_key)
);
