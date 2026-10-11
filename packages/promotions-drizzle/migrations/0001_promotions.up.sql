CREATE TABLE croco_promotion_policies (
  policy_id text NOT NULL,
  version integer NOT NULL,
  family_id text NOT NULL,
  benefit_cycle_id text NOT NULL,
  document jsonb NOT NULL,
  fingerprint text NOT NULL,
  budget_total numeric NOT NULL CHECK (budget_total > 0),
  budget_reserved numeric NOT NULL DEFAULT 0 CHECK (budget_reserved >= 0),
  actor_id text NOT NULL,
  reason text NOT NULL,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (policy_id, version),
  UNIQUE (policy_id, version, idempotency_key)
);
CREATE TABLE croco_promotion_quotes (
  quote_id text PRIMARY KEY,
  policy_id text NOT NULL,
  policy_version integer NOT NULL,
  document jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (policy_id, policy_version) REFERENCES croco_promotion_policies(policy_id, version)
);
CREATE INDEX croco_promotion_quotes_policy ON croco_promotion_quotes(policy_id, policy_version);
CREATE TABLE croco_promotion_claims (
  claim_id text PRIMARY KEY,
  quote_id text NOT NULL,
  logical_key text NOT NULL UNIQUE,
  fingerprint text NOT NULL,
  family_id text NOT NULL,
  benefit_cycle_id text NOT NULL,
  subject jsonb NOT NULL,
  document jsonb NOT NULL,
  state text NOT NULL CHECK (state IN ('reserved', 'fulfilling', 'fulfilled', 'expired', 'rejected', 'indeterminate')),
  stacking_group text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX croco_promotion_claims_family_cycle ON croco_promotion_claims(family_id, benefit_cycle_id, state);
CREATE INDEX croco_promotion_claims_state ON croco_promotion_claims(state, created_at);
CREATE TABLE croco_promotion_audit (
  audit_id text PRIMARY KEY,
  target_kind text NOT NULL,
  target_id text NOT NULL,
  action text NOT NULL,
  document jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX croco_promotion_audit_target ON croco_promotion_audit(target_kind, target_id, created_at);
