CREATE TABLE croco_explorer_snapshots (
  app_id text NOT NULL, environment text NOT NULL, tenant_id text NOT NULL,
  snapshot_id text NOT NULL, digest text NOT NULL,
  PRIMARY KEY (app_id, environment, tenant_id, snapshot_id)
);
CREATE TABLE croco_explorer_samples (
  app_id text NOT NULL, environment text NOT NULL, tenant_id text NOT NULL,
  id text NOT NULL, snapshot_id text NOT NULL, expires_at timestamptz NOT NULL, payload jsonb NOT NULL,
  PRIMARY KEY (app_id, environment, tenant_id, id),
  FOREIGN KEY (app_id, environment, tenant_id, snapshot_id)
    REFERENCES croco_explorer_snapshots(app_id, environment, tenant_id, snapshot_id)
);
CREATE INDEX croco_explorer_samples_expiry ON croco_explorer_samples(expires_at);
CREATE TABLE croco_explorer_notes (
  app_id text NOT NULL, environment text NOT NULL, tenant_id text NOT NULL,
  sample_id text NOT NULL, id text NOT NULL, revision integer NOT NULL CHECK (revision > 0),
  expires_at timestamptz NOT NULL, deleted_at timestamptz, payload jsonb NOT NULL,
  PRIMARY KEY (app_id, environment, tenant_id, sample_id, id),
  FOREIGN KEY (app_id, environment, tenant_id, sample_id)
    REFERENCES croco_explorer_samples(app_id, environment, tenant_id, id) ON DELETE CASCADE
);
CREATE TABLE croco_explorer_note_audit (
  sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  app_id text NOT NULL, environment text NOT NULL, tenant_id text NOT NULL,
  sample_id text NOT NULL, note_id text NOT NULL, revision integer NOT NULL,
  actor text NOT NULL, action text NOT NULL CHECK (action IN ('save','delete')), at timestamptz NOT NULL,
  FOREIGN KEY (app_id, environment, tenant_id, sample_id)
    REFERENCES croco_explorer_samples(app_id, environment, tenant_id, id) ON DELETE CASCADE
);
