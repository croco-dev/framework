CREATE TABLE saved_demo_reports (
  app_id text NOT NULL, environment text NOT NULL, tenant_id text NOT NULL,
  id text NOT NULL, owner_id text NOT NULL, title text NOT NULL, body text NOT NULL,
  revoked boolean NOT NULL DEFAULT false, deleted boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY(app_id, environment, tenant_id, id)
);
INSERT INTO saved_demo_reports (app_id,environment,tenant_id,id,owner_id,title,body,expires_at) VALUES
('saved-reports','local','demo-tenant','quarterly','demo-customer','Quarterly report','Continue reviewing quarterly results.', '2099-01-01'),
('saved-reports','local','demo-tenant','forecast','demo-customer','Revenue forecast','Continue preparing the revenue forecast.', '2099-01-01'),
('saved-reports','local','demo-tenant','retention','demo-customer','Retention report','Continue reviewing customer retention.', '2099-01-01');
