# @croco/cohort-core

Bounded cohort definitions, deterministic three-valued evaluation, and a published
snapshot reader that implements the existing engagement `AudienceSource` contract.

## Definition and registration

A `CohortDefinition` pins an id, positive version, subject kind, application,
environment, tenant, and predicate tree. `CohortRegistration` declares permitted
fields, field types, operators, enum values, events, and static membership ids.
`validateCohort` additionally checks the caller's permitted fields and exact scope.
Server applications must authorize preview, explanation, and publication actions
before calling these functions; client-supplied scope is not authorization.

Supported predicates:

| Kind          | Inputs and semantics                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| `all` / `any` | Nonempty child predicates; three-valued conjunction/disjunction                                           |
| `not`         | One child; `unknown` remains `unknown`                                                                    |
| `fact`        | Registered field and typed value; `eq` / `ne`; numeric fields additionally allow `gt`, `gte`, `lt`, `lte` |
| `event`       | Registered event, count or distinct UTC calendar days, comparison, trailing window in days                |
| `static`      | Registered membership id in the complete input membership list                                            |

Event windows include the lower boundary and exclude `asOf`. All timestamps must
include a timezone. A count is known only when the union of event coverage intervals
covers the complete window. Missing facts or incomplete coverage produce `unknown`.
Malformed source values and provider failures are errors, not unknown membership.

Default limits are nesting 4, predicates 30, preview sample 50, input rows 10,000,
and cost 300,000. Cost is the number of input rows multiplied by AST nodes. Root and
group nodes count toward nesting and predicate limits. Applications can configure
positive integer limits through the validation context. These are execution bounds,
not performance guarantees. `previewCohort` checks budgets before evaluating input.
The provider must also enforce its query and row budgets before fetching input.

## Evaluation and preview

Call `validateCohort` before using `evaluateCohort` directly. `previewCohort` performs
validation itself and returns exact counts for the supplied bounded input, plus a
sample sorted by subject id. It rejects duplicate subject ids. Explanations contain
predicate kinds, results, and reason codes without raw fact values. Fixed definitions,
inputs, and `asOf` produce the same results regardless of input ordering.

```ts no-check
const preview = previewCohort(
  definition,
  registration,
  {
    scope: authorizedScope,
    subjectKind: "user",
    allowedFields: ["plan"],
  },
  subjects,
  asOf,
  20,
);
```

`CohortRun` describes source snapshot references, watermarks, and run status. Durable
run storage, checkpoint/resume, complete membership publication, and revision CAS
belong to the persistence adapter. Partial or failed runs must never be published.

## Published serving

`PublishedCohortReader` reads an immutable snapshot id from an application-supplied
trusted `CohortPublicationStore`. It verifies schema version 1, exact scope and subject
kind, publication metadata, validity timestamps, membership content hash, and current
privacy version. It checks current subject suppression before returning membership
and rechecks the privacy version after that pass. Privacy provider failures propagate.

The reader does not contact the original source. A valid completed publication remains
readable during source outages. Expired, withdrawn, corrupt, mismatched, or stale
privacy snapshots fail with an unavailable error. `validUntil` is mandatory: there is
no implicit stale grace period. The store and privacy reader must provide consistent,
trusted data; applications must enforce retention and deletion in those providers.
Rollback publication is owned by the adapter and must pass these same checks.

`CohortAudienceSource` pins a snapshot id and requires matching `tenantId` in every
engagement audience context. It emits `{ subjectId, cohortSnapshot }`, preserving
version, source references, expiry, and publication metadata for campaign consumption.
It does not expose raw customer attributes. Applications map the subject id into their
existing campaign recipient contract. Suppressed subjects are removed; an unavailable
snapshot is never converted to an empty audience.

Snapshot membership is not security authorization. Recheck operational purchase,
pricing, balance, and access rules in the owning domain.
