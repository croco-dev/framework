# Contact Policy example

Run a zero-credential, in-memory contact budget demonstration:

```bash
pnpm --filter @croco/engagement-core build
pnpm --filter @croco-example/contact-policy start
```

The script previews a campaign email without consuming budget, races ten distinct logical sends for one remaining allowance, commits the winner, and confirms that a replay does not spend again. The rule and quiet hours are typed application configuration; the security topic is registered by the server with a specific message ID. The example uses synthetic identifiers and no contact addresses or provider credentials.

For the browser console fixture, run `pnpm --filter @croco-example/contact-policy dev` and open `http://127.0.0.1:4178/`. Query parameter `state` selects `loading`, `empty`, `partial`, `denied`, `error`, or `ready`; `fail=1` exercises operation errors. This fixture renders the real `ContactPolicyConsole` with synthetic data and callbacks so the UI can be inspected without credentials. It does not persist edits.

To enforce the same policy during real sends, pass a gate as the optional seventh `EngagementService` constructor argument:

```ts
declare const canonicalPayloadDigest: (value: unknown) => string;

const contactGate = {
  policy,
  app: "shop",
  environment: "production",
  fingerprint: canonicalPayloadDigest,
};
const engagement = new EngagementService(
  directory,
  renderer,
  notifications,
  suppressions,
  dispatchStore,
  clock,
  contactGate,
);
```

The host supplies a stable, non-reversible payload digest through `canonicalPayloadDigest`. Use `DrizzleContactPolicyStore` and `createEngagementSchema()` for durable multi-worker use. Run the migration before enabling the gate; rollback drops policy settings, reservations, and budget evidence. Resolve `unknown` reservations from provider evidence before deciding whether a new logical send is safe. This policy covers sends through the configured `EngagementService`; direct calls to notification providers or other send paths require their own gate.

[`src/host.ts`](src/host.ts) shows the server composition with `DrizzleContactPolicyStore`, `DrizzleContactPolicyAdminStore`, `ContactPolicyOperations`, and the dynamic policy resolver. The host must supply authenticated tenant-wide write authorization and a deterministic payload digest. New sends load the current scope configuration; prior reservations keep the version stored when they were created.

Persisted settings must match the deployed code registration. Call
`assertContactPolicyRegistration(snapshot, registration)` before constructing a send
policy from stored settings; `ContactPolicyOperations` applies this guard to reads,
dry-runs, and saves. The guard preserves permitted limit, priority, and quiet-hour
overrides, and rejects changed registration versions, rule topology or timing,
reservation TTL, topic kinds, message memberships, or overrides outside current
bounds with `admin-core/contact-policy-invalid`. A deployment that changes these
contracts requires an explicit settings migration or reinitialization. Do not
reuse the old snapshot or silently substitute defaults after validation fails.
