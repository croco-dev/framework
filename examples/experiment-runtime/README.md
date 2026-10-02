# Local experiment runtime

Run `pnpm --filter @croco-example/experiment-runtime dev` after `pnpm install` and building workspace dependencies. Open http://127.0.0.1:4182. No credentials or external services are used. This example binds to loopback and uses a fixed local operator; replace that boundary with authenticated, server-resolved access before deploying.

1. Preview the registered samples. The missing-identity sample produces `not_assigned`; preview never saves an assignment or exposure.
2. Enter a change reason and start the experiment. Process a demo checkout to run the privately registered handler and record an actual server-treatment exposure.
3. Repeat checkout: assignment identity stays stable; each actual treatment has a distinct exposure.
4. Pause, then process checkout. Admission is blocked. Resume permits treatment again. Stop is terminal.
5. Configure a new revision with unit, weights, registered eligibility rule, UTC period, hypothesis, and observation plan. The new revision begins as a draft. Earlier assignments retain their original revision.

The server constructs app/environment/tenant, actor, and subject from its local trusted demo session. API input cannot set a handler, tenant, subject, assignment receipt, or exposure receipt. The Console uses server-owned sample IDs and public definition projections, with no raw context, private handlers, salt, or provider credentials.

The in-memory reference store is intentionally single-process and resets on restart. Use the features-drizzle transactional store and migrations for durable multi-worker assignment and receipts. Treatment admission is checked immediately before the handler; a handler already admitted may finish after a concurrent pause. This example records server treatment, not browser visibility or SDK evaluation events. It does not exercise the SSR/browser display bridge.
