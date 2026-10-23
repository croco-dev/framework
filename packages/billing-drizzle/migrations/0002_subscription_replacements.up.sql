CREATE TABLE croco_billing_subscription_replacements (
  namespace text NOT NULL, id text NOT NULL, data jsonb NOT NULL, PRIMARY KEY (namespace, id)
);

-- Fixed-size index keys preserve long namespaces and identifiers; original evidence remains in JSONB.
-- Legacy stores applied every different-identity transition; modern receipts retain projectionApplied.
INSERT INTO croco_billing_subscription_replacements (namespace, id, data)
SELECT DISTINCT ON (namespace, data->'previousSubscription'->>'billingAccountId', data->'previousSubscription'->>'externalSubscriptionId')
  encode(sha256(convert_to(namespace, 'UTF8')), 'hex'),
  encode(sha256(convert_to(format('[%s,%s]', to_json(data->'previousSubscription'->>'billingAccountId'), to_json(data->'previousSubscription'->>'externalSubscriptionId')), 'UTF8')), 'hex'),
  jsonb_build_object('namespace', namespace, 'eventId', id, 'previousSubscription', data->'previousSubscription', 'subscription', data->'subscription')
FROM croco_billing_transitions
WHERE data->'previousSubscription'->>'externalSubscriptionId' IS NOT NULL
  AND data->'subscription'->>'externalSubscriptionId' <> data->'previousSubscription'->>'externalSubscriptionId'
  AND COALESCE((data->>'projectionApplied')::boolean, true)
ORDER BY namespace, data->'previousSubscription'->>'billingAccountId', data->'previousSubscription'->>'externalSubscriptionId', id;
