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
hides text immediately even before purge. Audit capacity is 50,000 records per study. One
record per retained note is reserved for physical deletion. Admission also reserves its dispatch
claim and completion records; interrupted sends keep completion capacity until dispatch or
authenticated reconciliation finishes. Ordinary writes and new notes cannot consume these
reserves. A result arriving after reconciliation preserves that audited outcome. Capacity
exhaustion rejects writes instead of silently evicting idempotency or contact evidence.

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

## Optional micro surveys


Versioned, optional micro surveys for a completed product event. A survey never owns the original save, cancellation, refund, or support operation. Complete that operation before requesting a survey invitation. Collection failure is a separate failure.

## Contracts

`SurveyDefinition` supports single choice, multiple choice, integer scale, and bounded text. Each publication has a new immutable version and an actor, reason, expected revision, and idempotency key. Question order and choices belong to that version. The survey `id` is the family and frequency identity: changing the version does not reset its invitation history. Changing an explicit frequency policy requires a new audited publication; copying a definition to a new family is an operator decision, not a wording edit.

`SurveyManager` requires a transactional `SurveyStore`, a server `SurveyAuthority`, a cryptographic `SurveyTokenCodec`, code-registered eligibility predicates, trigger names, and a server clock. `publish`, `evaluateEligibility`, `createInvitation`, `expose`, `submitResponse`, and `dismiss` validate server-side state. A manual trigger uses the literal `manual`. The application calls these operations from its existing product event handler; no new event bus or ExperienceSlot, Cohort, Goal, or survey SaaS is required.

The scope always includes tenant, application, and environment. A missing tenant is invalid. `verifySubject` must independently authenticate the member or stable anonymous identity used to claim an invitation; it must not trust an identity in a request body. Member invitations require the same verified member on every use. Anonymous invitations are bearer capabilities scoped to their original anonymous identity. Logging in never links or merges that identity. The application must not log request bodies containing tokens. Tokens expire at the earlier of one day after issuance and the publication's end. Revoked targeting is checked again at use.

An invitation is separate from an exposure. Mount a survey only after `expose` succeeds. Skipping produces a dismissal, never a response. Submission requires an actual recorded exposure. Repeated identical submit keys replay the current response; changed payloads conflict. Edits require `allowEdits` and the exact current response revision, leave the preceding revision, and cannot resurrect deleted responses. A retained response's first submission time anchors retention.

## Operations and privacy

`results` requires read permission and explicitly chooses invitation or exposure as its denominator. It returns invitations, exposures, unexposed, unanswered, dismissed, submitted, and a nullable response rate. Zero denominator means unavailable. Infrastructure failure throws a stable Problem rather than returning zeros. Selected respondents do not establish population-wide sentiment or causality.

`rawResponses` separately requires raw permission and uses an exclusive ID cursor with a maximum page size of 100. It returns current responses, never historical revisions. It strips and durably erases expired raw answers and classifications, including history for each visited invitation. Schedule bounded pagination through this operation with an authorized retention principal to physically clear all expired records even when operators do not open results. No scheduler is installed. Retention is at most one year. Publication must choose a shorter purpose-appropriate duration when necessary.

`changeResponse` requires delete or classify permission, an actor, reason, current revision, and operation idempotency key. Classification additionally requires raw permission and remains separate from the customer's answers. An identical administrative retry replays its current receipt without repeating a mutation; a changed payload or a superseded receipt conflicts. Classification cannot revive expired raw data. Delete scrubs every raw revision and classification while preserving submission counts and an audit receipt. Definitions, invitation identity metadata and audit metadata are retained by the application's separately declared metadata policy; raw-answer retention does not promise deletion of that metadata.

The default example asks about product satisfaction and explicitly discourages personal information. React renders text as escaped content. `surveyCsvCell` quotes CSV cells, doubles embedded quotes, and prefixes formula-like or tab/newline-prefixed values. Export each untrusted value through it; do not concatenate user input into a spreadsheet formula.

## Standalone example and validation

[Micro surveys](../../examples/micro-surveys/README.md) connects the real PostgreSQL service, SurveyCard/Modal, editor, isolated preview, and bounded results/operations in one local application.

Run `pnpm --filter @croco/research-core test` and `pnpm --filter @croco/research-core typecheck`. This package is alpha; provider certification and production deployment are not established by these checks.
