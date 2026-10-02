# Growth analysis

Run the common registered read service without an LLM or credentials:

```bash
pnpm --filter @croco/analytics-core... build
pnpm --filter @croco-example/growth-analysis start
```

The synthetic September activation report contains a ratio of `0.42`, numerator `42`, and denominator `100`. The example passes a typed plan directly and asserts that the verified report supplies the answer with zero model or executor calls.

Run the real React panel and native OpenAI SDK against a deterministic **local HTTP provider fixture**:

```bash
pnpm --filter @croco/admin-react... build
pnpm --filter @croco-example/growth-analysis dev
```

Open `http://127.0.0.1:4179/` and ask “What is September activation?”. Review the version, unit, population, parameters, period, and assumptions, select the offered choice, then confirm. “Ambiguous activation?” offers two explicit choices. Unsupported questions return unavailable; “Slow activation?” exercises cancellation/timeout. The `state` query parameter selects `empty`, `partial`, `stale`, `denied`, `error`, or `missing` read fixtures. All values and identities are synthetic. This fixture never sends data to a hosted model.

`src/openai.ts` is the server-only native SDK reference, pinned to OpenAI Node `7.25.0`. It follows [Responses structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs) and [token limits](https://developers.openai.com/api/docs/guides/token-counting). `store: false`, no tools, strict selection JSON, request cancellation, timeout, and `maxRetries: 0` are explicit. HTTP integration tests cover the installed SDK, usage, privacy policy, matching reports, ambiguity, and cancellation. They validate transport/contracts rather than model interpretation accuracy or growth effects.

For a server application, inject `createOpenAIPlanProposal(yourServerSDKClient, yourModel)` into `GrowthAnalysisService`. Inject one shared `MetricReadService` with trusted per-invocation authority; confirmed reads pass an expected query version and invocation cancellation signal. Never obtain principal or tenant from browser/model arguments. Register bounded query inputs and windows in trusted application code, using the same query ID/version as the common registry. `contextRef` must bind the authenticated scope and authorization/privacy revision with an opaque server digest. Change it whenever that context changes.

Plans and registrations must contain plain JSON values, including finite numbers. Class instances, accessors, sparse arrays, and non-JSON values fail before a common read or model transmission.

`prepareQuestion` is the app's mandatory PII policy before transmission. The demo only blocks email/phone shapes; production needs its own domain-aware rejection/masking policy. Registrations, labels, assumptions, and parameters must also contain only approved non-PII metadata. Raw result rows, customer history, and credentials never go to the model. The model returns existing choice IDs; it cannot register an executor, SQL, connector, principal, or tool. Why questions display observed facts and an explicit causal limitation. There is no generated causal explanation.

The core creates no new catalog, query engine, durable plan store, or conversation history. `facts` projects only validated aggregate result fields on the server; null remains missing, while incomplete/stale evidence has no numeric answer. Read permissions, report matching, query cost/rows/bytes/window, and read audit remain owned by #2862's common service. Model input bytes, output bytes/tokens, time, and concurrent requests are separately bounded. Estimated and unknown usage are distinct from measured tokens, and response loss is never recorded as zero cost.

`settleUsage` must write idempotently to the application's existing execution/events/metering receipts, using `invocationId`. The demo uses the existing volatile `InMemoryBillableUsageJournal` for known tokens; it does not bill estimated/unknown usage. Production must retain unknown outcome evidence in its execution receipt and use an existing persistent journal adapter before enabling billing. A server-side `AnalysisSettlementProblem.resume()` retries receipt settlement and permission checks without another model call. Its recovery closure lives only in the current process; it is not restart recovery. Persist bounded receipt references/status through the existing execution boundary when restart recovery is required. Do not expose the error object or recovery closure; serialize `Problem.toJSON()` so original private causes never enter telemetry or public responses.

Standalone package consumption needs only `@croco/analytics-core`, its server `runtime` subpath, and `@croco/admin-react` for the optional panel. Install your vendor SDK in your server application; the core and browser declarations contain no vendor SDK dependency. No PostgreSQL, warehouse migration, deleted LLM packages, real customer data, paid provider call, or production access is required for the provided fixture.
