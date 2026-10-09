CREATE TABLE croco_referral_programs (
  program_id text NOT NULL,
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
  PRIMARY KEY (program_id, version),
  UNIQUE (program_id, version, idempotency_key)
);
CREATE TABLE croco_referral_links (
  link_id text PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  program_id text NOT NULL,
  program_version integer NOT NULL,
  family_id text NOT NULL,
  benefit_cycle_id text NOT NULL,
  referrer jsonb NOT NULL,
  document jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (program_id, program_version) REFERENCES croco_referral_programs(program_id, version)
);
CREATE INDEX croco_referral_links_program ON croco_referral_links(program_id, program_version);
CREATE TABLE croco_referral_clicks (
  click_id bigserial PRIMARY KEY,
  link_id text NOT NULL REFERENCES croco_referral_links(link_id),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX croco_referral_clicks_link ON croco_referral_clicks(link_id, occurred_at);
CREATE TABLE croco_referral_attributions (
  attribution_id text PRIMARY KEY,
  link_id text NOT NULL REFERENCES croco_referral_links(link_id),
  fingerprint text NOT NULL,
  program_id text NOT NULL,
  program_version integer NOT NULL,
  family_id text NOT NULL,
  benefit_cycle_id text NOT NULL,
  scope jsonb NOT NULL,
  referrer jsonb NOT NULL,
  recipient jsonb,
  recipient_key text,
  document jsonb NOT NULL,
  state text NOT NULL CHECK (state IN ('claimed', 'qualified', 'benefits-pending', 'benefits-partial', 'fulfilled', 'held', 'rejected', 'expired', 'indeterminate')),
  hold_reason text,
  reject_reason text,
  claimed_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  cycle_index integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX croco_referral_attributions_first_valid
  ON croco_referral_attributions(family_id, recipient_key)
  WHERE recipient_key IS NOT NULL;
CREATE INDEX croco_referral_attributions_family_cycle ON croco_referral_attributions(family_id, benefit_cycle_id, state);
CREATE INDEX croco_referral_attributions_state ON croco_referral_attributions(state, created_at);
CREATE TABLE croco_referral_benefit_intents (
  intent_id text PRIMARY KEY,
  attribution_id text NOT NULL REFERENCES croco_referral_attributions(attribution_id),
  side text NOT NULL CHECK (side IN ('referrer', 'recipient')),
  logical_key text NOT NULL UNIQUE,
  idempotency_key text NOT NULL,
  subject jsonb NOT NULL,
  document jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'granting', 'granted', 'failed', 'unknown', 'canceled', 'returned', 'skipped')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX croco_referral_benefits_attribution ON croco_referral_benefit_intents(attribution_id, side);
CREATE TABLE croco_referral_audit (
  audit_id text PRIMARY KEY,
  target_kind text NOT NULL,
  target_id text NOT NULL,
  action text NOT NULL,
  document jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX croco_referral_audit_target ON croco_referral_audit(target_kind, target_id, created_at);
