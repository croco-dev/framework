CREATE TABLE croco_journey_episodes (
  scope_key text NOT NULL,
  id text NOT NULL,
  reentry_key text NOT NULL,
  revision integer NOT NULL CHECK (revision >= 0),
  episode jsonb NOT NULL,
  wake_claim_until timestamptz,
  PRIMARY KEY (scope_key, id),
  UNIQUE (scope_key, reentry_key),
  CHECK ((episode->>'revision')::integer = revision),
  CHECK (episode->>'id' = id),
  CHECK (episode->>'reentryKey' = reentry_key)
);
CREATE INDEX croco_journey_wake ON croco_journey_episodes
  (scope_key, (episode->>'wakeAt')) WHERE episode->>'status' IN ('running', 'waiting');
