-- Match the UTF8 recovery cursor order independently of the column's default collation.
CREATE INDEX croco_referral_attributions_recovery_order
  ON croco_referral_attributions (attribution_id COLLATE pg_catalog."C");
