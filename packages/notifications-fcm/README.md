# @croco/notifications-fcm

Firebase Cloud Messaging provider for one resolved PUSH endpoint per dispatch. Use it with Croco engagement messages and a `ContactEndpointStore`; audiences remain Croco recipients and endpoints. FCM topics and multicast sending are not exposed.

## Configuration

```ts typecheck
import { FcmProvider, FcmDiagnosticsProvider } from "@croco/notifications-fcm";

declare const secretStore: { resolve(reference: string): Promise<string> };
const config = {
  projectId: "your-firebase-project",
  credential: { type: "application-default" as const },
};
const provider = new FcmProvider(config, undefined, {
  resolveToken: (reference) => secretStore.resolve(reference),
});
const diagnostics = new FcmDiagnosticsProvider(config);
```

`secretStore` is an application-owned token vault. In persistent engagement dispatch, keep `payload.to` as an opaque token reference and configure `resolveToken`; resolving happens inside the provider so persisted jobs contain no token. Direct non-persistent sends can supply a resolved token when no resolver is configured. Never print payloads or vault values. The injected `FcmClient` supports credential-free unit tests. Call `await provider.close()` at shutdown to delete the Firebase app owned by this provider; injected clients remain caller-owned.

Choose explicit Application Default Credentials or `{ type: 'service-account', clientEmail, privateKey }`. Keep service-account material in your secret manager. Configuration validation checks required values; it does not prove upstream authorization. Diagnostics report `liveCheck: not_configured` unless an application supplies a readiness check. Readiness callbacks return no arbitrary diagnostic text or credential data. Failed checks report fixed, sanitized Problems.

## Content and delivery

Pass canonical `NotificationPayload.push` content. `title`, `body`, and `imageUrl` map to Firebase notification fields. String `data` entries map to data fields; `deepLink` is delivered as `data.deepLink` for the receiving application to handle. Supplying both `deepLink` and `data.deepLink` fails validation. Reserved Firebase data keys fail validation.

`ttlSeconds` accepts integer values from 0 through 2,419,200, maps to Android milliseconds, APNs expiration, and Web Push TTL. Priority maps to Android priority, APNs priority 10/5, and Web Push urgency. `collapseKey` maps to Android collapse key, APNs collapse ID, and the Web notification tag. Platform-specific limits still apply; Firebase rejection is returned as a terminal validation Problem. Web tags replace displayed notifications and do not guarantee transport deduplication. Clients own deep-link navigation and push-open ingestion through Croco's provider-neutral interaction seam.

Acceptance returns the provider message ID; it is not proof of display or delivery. FCM does not guarantee idempotency-key deduplication. Capabilities report `supportsIdempotencyKey: false`, and telemetry records only whether an idempotency key was provided. Croco retains delivery identity in its durable stores. The adapter sends once and performs no hidden retries. Its optional `sendBatch` helper runs at most five sends concurrently and returns results in input order, including retryable failures. The engagement dispatcher owns durable retry policy.

Problems contain fixed messages and explicit `retryable`/`endpointInvalid` extensions. Invalid or unregistered registration tokens are terminal; when `EngagementService` has a delivery-event processor, it records that outcome and invalidates the dispatched endpoint version. Sender mismatch, authentication, configuration, and malformed payload failures are terminal without invalidating a potentially valid token. Quota/rate limits, transport timeouts, connection failures, and provider 5xx failures are retryable. Unknown failures remain terminal for investigation. Raw upstream errors, causes, responses, credential values, and tokens are never attached to Problems or telemetry. Resolve quota/authentication causes before retrying; use application policy for delays and attempt limits.

## Verification and opt-in live smoke

`pnpm --filter @croco/notifications-fcm test` uses a fake client and requires no credentials. Build and typecheck use the package scripts.

For an explicitly opted-in live certification, use a dedicated Firebase test project with Cloud Messaging enabled, Application Default Credentials with send permission, and a test-device token held in your vault. Run a local application using the configuration above; send one canonical push through `EngagementService`, verify the accepted provider message ID in the durable delivery store, then verify receipt on the device. Exercise a revoked test token to verify endpoint invalidation, and confirm subsequent sends skip it. Check the push-open ingestion fixture separately. Do not log request payloads or include credentials/device tokens in screenshots, fixtures, or ordinary CI. Delete the local Firebase app with `close()` when done. Live delivery is not certified by credential-free tests.

Firebase references: [Admin send API](https://firebase.google.com/docs/cloud-messaging/send/admin-sdk), [error codes](https://firebase.google.com/docs/cloud-messaging/error-codes), [Android options](https://firebase.google.com/docs/reference/admin/node/firebase-admin.messaging.androidconfig).
