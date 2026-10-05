# @croco/experience-core

Code-registered in-app placements, deterministic server decisions, and receipt
contracts for visible displays and dismissals. Define each placement with
`definePlacement({ id, schema, allowedRenderers })`; the schema declares
context fields, allowed locales, copy length limits, and whether action URLs
are allowed. Renderer names and the schema form the validation boundary for
configuration.

`evaluatePlacement` considers only published, active configurations in the exact
application, environment, tenant, and placement. It validates targeting, chooses
one match by priority and stable ID ordering, and reserves a durable decision
through `ExperienceStore`. A caller can pass the requested locale for an exact
content match. No match returns `no_match`; an unavailable published cohort
returns `unavailable` rather than being treated as empty membership.

The decision copies the selected content and any published cohort snapshot
reference. Serve that decision and its exposure handle in the server response and
hydrate with the same values. Call `recordExposure` only after the display has
actually been visible. Its server-issued handle and authenticated scope and
subject let the store reject forged or cross-scope confirmations and deduplicate
retries. Call `dismissExperience` when the user dismisses the experience.

`previewPlacement` runs the same matching rules without reserving a decision or
recording an exposure. The application must authorize configuration and preview
requests at its server boundary. A `PublishedCohortReader` supplies immutable
cohort membership; this package does not query warehouse or source facts. Cohort
membership is targeting data and must not replace authorization for checkout or
other protected actions.

Use `@croco/experience-drizzle` for PostgreSQL persistence and
`@croco/frontend-react/experience-slot` to render a server decision in React.
`examples/experience-placement` demonstrates the complete path.

## Saved Intent (standalone)

`createSavedIntentService` supports private saved resources and recent work without
an ExperienceSlot, Goal, Journey, marketing consent, or a content database.
Provide a `SavedIntentStore`, code-declared `resourceTypes`, and a server-owned
`authorize` callback. Obtain `principal` from verified server authentication;
never deserialize a client-supplied principal as trusted identity. Every method
requires an explicit app/environment/tenant scope and subject. The callback must
check subject ownership and the requested action, including operator inspection,
policy changes, retention purge, and privacy deletion.

Each resource type declares its resolver, HTTPS origin allowlist, and default
`displayLimit`, `retentionDays`, and `excludeCompleted` policy. Resolvers check the
original repository's current permissions, deletion, and expiry on each read.
Only available resolutions may expose a label and URL. Unavailable resolutions
remove progress references as well as labels and URLs. URLs are checked on the
server, including encoded control characters, backslashes, and protocol-relative
forms. Call `resolveIntent` again when continuing a resource so a previously
rendered link does not bypass the current resolver. The destination must also
apply its native authorization.

`saveIntent` distinguishes `explicit` and `recent` sources. Their unique key is
scope, subject, resource type, resource ID, and source kind. Mutations require an
expected revision (`null` means create) and idempotency key. The durable store
atomically checks revisions, compares semantic retry payloads, and suppresses
recent updates after `removeIntent`. Only explicit save clears that suppression.
`markCompleted` and `pinIntent` are revisioned operations; `pinOrder: null` unpins.
Mutation responses and `readIntent` return metadata with `progressRef` removed,
including receipt retries. Retrieve current progress only through an available
`listResumeCandidates` or `resolveIntent` result. Removing unavailable resources
does not require the source resolver to grant access.
No title, URL, resolved source content, or principal is persisted by this service.

Display prefers retained explicit records over recent records for the same resource,
then sorts pinned items by ascending pin order, descending last-used timestamp,
and stable intent ID. Removed, policy-excluded completed, and retention-expired
records are excluded before per-type display limits and pagination. Pages have a
maximum size of 100; the service refuses to truncate subjects exceeding 10,000
stored records. `includeExclusions: true` additionally requires `inspect`
authorization and returns only bounded identifiers and reasons, never source
metadata. Operator pages apply the same offset and limit independently to the
candidate and exclusion lists; each list contains at most `limit` entries.
`nextOffset` remains present while either list has another page. Customer pages
advance only through candidates. An expired explicit record does not suppress a
fresh recent record, so retention purge does not change that deduplication result.
Provider errors propagate as failures instead of empty candidate lists.

`readPolicy` and `updatePolicy` share the same service used by the operator
console. Policy changes preserve actor, reason, revision, and idempotency.
`purgeRetention` applies each resource type's current retention cutoff to the
store; schedule it in the application's existing maintenance lifecycle. A
provider retains only minimal removal suppression after retention purge, while
`deleteSubject` erases all private rows, suppression, and idempotency receipts for
that exact scope and subject. Provider migrations and durable implementation are
in `@croco/experience-drizzle`.
