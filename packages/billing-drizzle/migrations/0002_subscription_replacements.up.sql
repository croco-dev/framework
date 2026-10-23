CREATE TABLE croco_billing_subscription_replacements (
  namespace text NOT NULL, id text NOT NULL, data jsonb NOT NULL, PRIMARY KEY (namespace, id)
);

-- Older stores accepted every different-identity transition. Preserve their recorded replacements.
INSERT INTO croco_billing_subscription_replacements (namespace, id, data)
SELECT DISTINCT ON (namespace, data->'previousSubscription'->>'billingAccountId', data->'previousSubscription'->>'externalSubscriptionId')
  namespace,
  format('[%s,%s]', to_json(data->'previousSubscription'->>'billingAccountId'), to_json(data->'previousSubscription'->>'externalSubscriptionId')),
  jsonb_build_object('eventId', id, 'previousSubscription', data->'previousSubscription', 'subscription', data->'subscription')
FROM croco_billing_transitions
WHERE data->'previousSubscription'->>'externalSubscriptionId' IS NOT NULL
  AND data->'subscription'->>'externalSubscriptionId' <> data->'previousSubscription'->>'externalSubscriptionId'
ORDER BY namespace, data->'previousSubscription'->>'billingAccountId', data->'previousSubscription'->>'externalSubscriptionId', id;
