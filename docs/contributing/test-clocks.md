# Shared clocks in test fixtures

A fixture owns business time. Services, readers, stores and restarted instances created by that fixture
must observe the same clock. Pass existing production clock and scheduler dependencies through one
bound factory; keep production defaults unchanged. Use `fixedClock` / `TestClock` from `@croco/testing`
when a fixture needs virtual scheduling. An existing injected mutable clock is sufficient for synchronous
expiry boundaries. Do not patch global `Date` to control domain time.

The executable reference is
[`createResearchFixture`](../../packages/research-core/src/tests/researchFixtures.ts).
Its `createService(authorizer?)` closes over the store, sender and clock. Permission variants and restarted
readers therefore cannot accidentally select the production default clock. `time.advanceBy()` moves that
same clock, including any scheduled work. Create a new fixture per test; never share a mutable clock
between concurrent fixtures. A TestKernel bootstrap can use its existing `context.clock` in the same way.

`ResearchService.spec.ts` exercises note visibility one millisecond before expiry, exactly at expiry and
after expiry, independently of write denial. It runs with two starting dates and checks concurrent fixture
isolation. To check timezone independence, run the same assertions under both timezone settings:

```sh
TZ=UTC pnpm --dir packages/research-core exec vitest run src/tests/ResearchService.spec.ts
TZ=Asia/Seoul pnpm --dir packages/research-core exec vitest run src/tests/ResearchService.spec.ts
```

## Detecting missing dependencies

Put `// croco-test-clock: controlled` at the top of a controlled test or its fixture source. The existing
`pnpm static-misuse:check` gate then checks that source's declared constructor clock dependencies and
rejects ambient clock reads with `CROCO_STATIC_TEST_CLOCK_BOUNDARY`, a source location and recovery action.
A negative fixture constructs a second service without the clock; it must fail even when the corresponding
production constructor has a default. See [the exact detection limits](../static-misuse-checks.md).
Do not use that marker as a claim that every transitive dependency has been inspected: opaque factories,
unmarked legacy tests and dependencies without a supported injection seam still need review.

For lease/timeout tests, inject both the clock and its scheduler. `LifecycleClock.spec.ts` passes
`time.schedule` to `scheduleExecutionClaimWake`, starts the blocked transition, advances to just before
the lease deadline, and then reaches the exact deadline. It never waits for real time to cross that boundary.

Native timer, browser and provider lifecycle tests may need real I/O or scheduling. Keep their business clock
controlled, explain the native behavior being observed, and limit any real-time checker exception to the
specific expression with a reason. A real PostgreSQL connection does not require an ambient domain clock.
Do not increase timeouts, move fixture dates far into the future, or remove assertions to hide clock mixing.

## Audit and conversion scope

The #3674 review at `d262273e6a757a2953ad3f4a4c2c90e9b0c6b216` followed callable `clock`, `now` and scheduler declarations and their direct test
constructors, fixed-date fixtures, TTL/retention tests and real-timer expiry tests. The search found 114
matching declaration lines and 139 test files with ambient `Date.now()` or zero-argument `new Date()`.
These counts describe the inspected search set, not a proof that every ambient timestamp is a defect.
The existing test inventory remains the source for executable test ownership and lanes; this document is
not a second test registry.

| Area                                                          | Result                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Research service, engagement integration and admin operations | Bound research fixture owns readers and permission variants; integrations explicitly pass that timeline. PostgreSQL service factories also pass fixed business time. The original reader already passed `f.clock` before this change; the bound factory and static negative fixture prevent recurrence.                                                                                                                   |
| Billing checkout reservation                                  | Service, billing store and idempotency store share fixture time, including the abandoned-reservation retry.                                                                                                                                                                                                                                                                                                               |
| Campaign retry integration                                    | Execution, snapshot, broadcast and replacement engagement/store instances receive one fixture clock.                                                                                                                                                                                                                                                                                                                      |
| Metric read freshness                                         | Default fixture time is fixed; reports expire relative to that scenario instead of relying on year 2099. Explicit expiry tests retain their separate boundary clock.                                                                                                                                                                                                                                                      |
| Lifecycle command retention / execution leases                | Existing injected command-retention clock is retained; execution-lease tests use `TestClock` with the existing wake scheduler and exact boundary assertions.                                                                                                                                                                                                                                                              |
| Retry circuit recovery / idle TTL                             | Business recovery and idle expiry advance injected clocks. Event-loop lock sequencing remains a native lifecycle observation.                                                                                                                                                                                                                                                                                             |
| Rate-limit windows                                            | Fixture/reset assertions and custom-window progression use the injected clock. Native prune-scheduler argument and timer-limit tests retain adapter timing controls with local reasons.                                                                                                                                                                                                                                   |
| Additional inspected controls                                 | FactHistory authorization/validation cases supply query timestamps or reject before the clock is used; the timestamp-capture test injects its spy. Existing BillingStore lease tests inject time; subscription-provider fixtures use explicit state, while Polar webhook freshness tests already control their protocol clock with existing fake-time fixtures. These are not additional uncontrolled expiry regressions. |
| Existing deterministic controls                               | ContactPolicyPushLifecycle, OfferService/ReferralService restart factories, WorkflowClock, and injected TaskRunner scheduling already share explicit clocks; they retain their current contracts.                                                                                                                                                                                                                         |
| Native lifecycle coverage                                     | TaskRunner's int32 timer chunking and rate-limit prune scheduling test actual Node adapter behavior. Provider/browser I/O remains real. These exceptions do not justify ambient business expiry assertions.                                                                                                                                                                                                               |
| Unavailable injection seam                                    | InvitationManager and RateLimitedInvitationService have no existing clock dependency. This change does not add a production API solely for testing or claim those paths are statically enforced.                                                                                                                                                                                                                          |

The static detector deliberately enforces the marked fixture contract rather than guessing arbitrary optional
constructor arguments. It runs through the existing repository verification/CI static-misuse gate; its fixture
suite includes missing clocks, ambient reads, valid date parsing, complete bindings and scoped real-time
exceptions. TestClock's concurrent-driver policy and running-callback leak detection belong to separate
issues #3900 and #3894; this change does not alter either runtime contract.
