-- Review/apply once outside the Worker and verifier, in a dedicated smoke database.
-- Create the login separately; credentials are never part of this artifact.
-- The login must be named croco_hyperdrive_smoke_worker and must not own these objects.
CREATE SCHEMA croco_hyperdrive_smoke;
CREATE TABLE croco_hyperdrive_smoke.claims (
  run_id uuid NOT NULL,
  id text NOT NULL,
  tenant text NOT NULL,
  value integer NOT NULL,
  PRIMARY KEY (run_id, id)
);
ALTER TABLE croco_hyperdrive_smoke.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE croco_hyperdrive_smoke.claims FORCE ROW LEVEL SECURITY;
CREATE POLICY isolated_tenant ON croco_hyperdrive_smoke.claims
  USING (tenant = current_setting('croco.tenant', true))
  WITH CHECK (tenant = current_setting('croco.tenant', true));
GRANT USAGE ON SCHEMA croco_hyperdrive_smoke TO croco_hyperdrive_smoke_worker;
GRANT SELECT, INSERT, UPDATE ON croco_hyperdrive_smoke.claims TO croco_hyperdrive_smoke_worker;
