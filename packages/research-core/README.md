# @croco/research-core

Bounded research recruitment with reproducible candidate selection, per-group quota claims,
separate contact/participation consent, and audited invitation transitions. Alpha; no provider
certification or production recruitment claim.

## Standalone flow

Create a `ResearchService(store, authorizer, sender, approvedBookingUrls, clock?)`. The authorizer
must resolve app/environment/tenant, actor, read/write/participation/note permissions and subject
access from the verified server principal. Never accept an access object or permissions from a
browser body. The explicit booking allowlist contains complete HTTPS URLs, including path and
query; arbitrary URLs on the same origin are not approved.

1. `publishStudy(scope, definition, access, command)` fixes dataset definition, source snapshot,
   observation end, seed, group quotas, booking link and contact/slot policy.
2. `importCandidates` accepts validated batches of at most 1,000 candidates (10,000 per study).
   Imports are immutable and duplicate identical subjects are harmless. The application supplies
   comparable observed candidates, consent evidence and prior contact/participation history;
   no Survey, Cohort Builder or new Contact Policy service is required.
3. `selectCandidates` sorts eligible candidates by seeded deterministic rank and atomically
   claims up to each group's quota. Incomplete observation windows, recent participation/contact,
   ineligibility and missing contact consent are explicit exclusions.
4. `invite` records admission under the study lock and calls the existing EngagementService
   through `createResearchEngagementSender`. Recipient contacts remain in RecipientDirectory;
   the service records only subject references. Use an EngagementService with durable dispatch
   storage, native notification idempotency and current recipient preferences.
5. `recordConsent`, `recordResponse` and `markParticipated` record consent, acceptance and actual
   participation separately. Actual participation requires accepted participation consent plus
   authenticated `research.participate` authority and an audited explicit command. A callback
   must be authenticated by the host before invoking the same method.

All writes require `research.write`; note and participation operations additionally require their
field/action permission. Permission to read a private note does not grant write authority.

Every command includes expected revision, unique idempotency key, actor from authenticated
access, reason and source. Idempotency fingerprints contain SHA-256 digests, not response/note
contents. Do not put sensitive response text into audit reasons or identity fields. Conflicting
imports, stale revisions, duplicate groups, malformed quota policies, unsupported booking links
and unauthorized commands produce stable `research/invalid`, `research/conflict`, or
`research/denied` Problems.

## Quota, consent and failures

The supported published quota unit is **active invitations**, not accepted or participated
people. Selected, admitted, unknown, invited, accepted and participated states hold slots;
declined, withdrawn and definitively suppressed states release them. Replacement selection
never selects an already invited subject again. The per-study cap is one logical invitation per
subject and is not reset by re-deploying or changing operational revision. A published study's
identity/policy/snapshot cannot be revised to reset caps.

Admission is the first durable transaction in `invite`. Contact withdrawal completed before
admission prevents dispatch. Withdrawal after admission cannot guarantee cancellation of an
already admitted contact; the console never reports cancellation success. Participation
withdrawal prevents subsequent actual participation confirmation. The EngagementService
checks current recipient preferences at its own dispatch boundary.

Contact-only opt-out after acceptance preserves granted participation consent and the accepted
slot. Completed participation is a historical fact: ordinary decline/withdraw responses cannot
erase it or return its slot. Later consent withdrawal is recorded separately without changing that fact.

A second durable claim marks acceptance unknown before external dispatch. Only one caller
owns that send. A retry reuses the admission and never sends again. Process death before/after
external acceptance leaves admitted/unknown state holding its slot; `reconcileInvitation`
requires authenticated participation authority and an audit reason referencing verified provider
acceptance or rejection. It never invents a retry or releases an unknown slot. Suppression and
unknown outcomes are different from nonparticipation.

`inspect` returns group population/eligible/selected/invited/accepted/participated/unknown/held/
shortage counts, a candidate page (limit 1–100), authorized notes and up to 100 relevant audit
events. Counts describe recruitment, not representativeness or insight quality. Each row requires
subject read permission. Notes require an additional field permission, expire after the published
1–365 day retention period, and are physically removed by audited `purgeExpiredNotes` or explicit
`writeNote(..., null, ...)`. Deploy a host-owned purge job using the existing scheduler; expiration
hides text immediately even before purge. Audit capacity is 50,000 commands per study. One
record per retained note is reserved for physical deletion; ordinary writes stop before consuming
that reserve. Capacity exhaustion rejects writes instead of silently evicting idempotency or
contact evidence.

## Dependencies and verification

The contract depends on `@croco/problems-core` and `@croco/engagement-core`; no database or
calendar/survey engine is implemented. `InMemoryResearchStore` is development/test-only;
`@croco/research-drizzle` provides PostgreSQL persistence.

```bash
pnpm --filter @croco/research-core test
pnpm --filter @croco/research-core typecheck
```

The synthetic executable Console is in `examples/research-recruitment`. It uses real research
operations and the actual EngagementService with a local non-contacting dispatcher.
