CREATE TABLE croco_experience_config_revisions (
  scope_key text NOT NULL,
  config_id text NOT NULL,
  revision integer NOT NULL,
  placement_id text NOT NULL,
  config jsonb NOT NULL,
  actor_id text NOT NULL,
  reason text NOT NULL,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_key, config_id, revision),
  UNIQUE (scope_key, config_id, idempotency_key)
);
CREATE TABLE croco_experience_current (
  scope_key text NOT NULL,
  config_id text NOT NULL,
  placement_id text NOT NULL,
  revision integer NOT NULL,
  status text NOT NULL CHECK (status IN ('draft','published','paused','archived')),
  PRIMARY KEY (scope_key, config_id),
  FOREIGN KEY (scope_key, config_id, revision) REFERENCES croco_experience_config_revisions(scope_key, config_id, revision)
);
CREATE INDEX croco_experience_current_placement ON croco_experience_current(scope_key, placement_id, status);
CREATE TABLE croco_experience_decisions (
  decision_id text PRIMARY KEY,
  scope_key text NOT NULL,
  placement_id text NOT NULL,
  config_id text NOT NULL,
  revision integer NOT NULL,
  subject_kind text NOT NULL,
  subject_id text NOT NULL,
  decision jsonb NOT NULL,
  handle jsonb NOT NULL,
  token text NOT NULL,
  exposure_id text NOT NULL UNIQUE,
  surface_instance_id text NOT NULL,
  selected_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  displayed_at timestamptz,
  FOREIGN KEY (scope_key, config_id, revision) REFERENCES croco_experience_config_revisions(scope_key, config_id, revision)
);
CREATE INDEX croco_experience_frequency ON croco_experience_decisions(scope_key, subject_kind, subject_id, config_id, selected_at DESC);
CREATE TABLE croco_experience_dismissals (
  scope_key text NOT NULL,
  config_id text NOT NULL,
  subject_kind text NOT NULL,
  subject_id text NOT NULL,
  dismissed_at timestamptz NOT NULL,
  PRIMARY KEY (scope_key, config_id, subject_kind, subject_id)
);
