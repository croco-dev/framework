CREATE TABLE croco_saved_intents (
  scope_key text NOT NULL,
  subject_key text NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('explicit', 'recent')),
  intent jsonb NOT NULL,
  PRIMARY KEY (scope_key, subject_key, resource_type, resource_id, source_kind)
);
CREATE UNIQUE INDEX croco_saved_intent_identity ON croco_saved_intents(scope_key, subject_key, (intent ->> 'id'));
CREATE TABLE croco_saved_intent_suppression (
  scope_key text NOT NULL,
  subject_key text NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  PRIMARY KEY (scope_key, subject_key, resource_type, resource_id)
);
CREATE TABLE croco_saved_intent_receipts (
  scope_key text NOT NULL,
  subject_key text NOT NULL,
  idempotency_key text NOT NULL,
  command jsonb NOT NULL,
  result jsonb NOT NULL,
  PRIMARY KEY (scope_key, subject_key, idempotency_key)
);
CREATE TABLE croco_saved_intent_policy_revisions (
  scope_key text NOT NULL,
  resource_type text NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  idempotency_key text NOT NULL,
  command jsonb NOT NULL,
  policy jsonb NOT NULL,
  PRIMARY KEY (scope_key, resource_type, revision),
  UNIQUE (scope_key, resource_type, idempotency_key)
);
