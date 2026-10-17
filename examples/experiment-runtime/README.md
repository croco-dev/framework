# Local experiment runtime

Run `pnpm --filter @croco-example/experiment-runtime dev` after `pnpm install` and building workspace dependencies. Open http://127.0.0.1:4182. No credentials or external services are used. This example binds to loopback and uses a fixed local operator; replace that boundary with authenticated, server-resolved access before deploying.

1. Preview the registered samples. The missing-identity sample produces `not_assigned`; preview never saves an assignment or exposure.
2. Enter a change reason and start the experiment. Process a demo checkout to run the privately registered handler and record an actual server-treatment exposure.
3. Repeat checkout: assignment identity stays stable; each actual treatment has a distinct exposure.
4. Pause, then process checkout. Admission is blocked. Resume permits treatment again. Stop is terminal.
5. Configure a new revision with unit, weights, registered eligibility rule, UTC period, hypothesis, and observation plan. The new revision begins as a draft. Earlier assignments retain their original revision.

The server constructs app/environment/tenant, actor, and subject from its local trusted demo session. API input cannot set a handler, tenant, subject, assignment receipt, or exposure receipt. The Console uses server-owned sample IDs and public definition projections, with no raw context, private handlers, salt, or provider credentials.

The in-memory reference store is intentionally single-process and resets on restart. Use the features-drizzle transactional store and migrations for durable multi-worker assignment and receipts. Treatment admission is checked immediately before the handler; a handler already admitted may finish after a concurrent pause. This example records server treatment, not browser visibility or SDK evaluation events. It does not exercise the SSR/browser display bridge.

## Private render delivery example

Run `pnpm --filter @croco-example/experiment-runtime... build`, then
`pnpm --filter @croco-example/experiment-runtime delivery:build` and
`pnpm --filter @croco-example/experiment-runtime delivery:serve`.
The localhost-only server listens on 4183. `/ssr` uses RenderServer SSR; `/rsc` uses its official
isolated Node Flight encoder and HTML decoder. Both hydrate the same frozen decision through
`ExperimentRegion`, preserve the variant on click, and record only an actually visible display.
`?prefetch` renders fallback without exposure; `?prefetch&consume` revalidates the receipt at use.
`?hidden` renders a region that does not satisfy view conditions. `demo-user=b` selects a second
synthetic local identity; a receipt for the other identity is rejected. This cookie is a fixture,
not an authentication implementation. No provider, source-system or customer traffic is contacted.

With the server running, `node examples/experiment-runtime/scripts/verify-delivery.cjs` checks both
routes at 1440×1000 and 390×844, hydration/click/exposure identity, private headers, hidden/prefetch
non-exposure and an in-flight admission across scope change. Screenshots go to
`/tmp/croco-2838-browser` (override with `DELIVERY_ARTIFACTS`). The source test
`DeliveryCohort.spec.ts` separately exercises the existing PublishedCohortReader with a fixed clock,
withdrawal, schema/hash/scope mismatch, privacy changes, expiry and compatible republishing.

This demonstrates plain server elements through Node Flight, then browser hydration; it does not
certify other hosts, deploy manifests, arbitrary client-reference modules or production receipt
persistence. Shared fragments may use only `experimentRegionFragment` output; enclosing personalized
HTML/Flight responses stay no-store. Existing CORS, action payload, SSR error and cancellation
contracts remain owned by their existing paths. The bridge does not execute purchase/benefit
commands or replace their current price, access, eligibility or balance authority.
