# Optional micro surveys

One local service completes report saving independently of survey collection, then connects PostgreSQL invitations and responses to the actual customer renderer and operator editor/preview/results. No external survey SaaS, ExperienceSlot, Cohort, or Goal is required. All records are synthetic.

## Run

Use a disposable PostgreSQL database. Set `RESEARCH_EXAMPLE_DATABASE_URL`, then run `pnpm --filter @croco-example/micro-surveys dev`. Open `http://127.0.0.1:4321/`. `RESEARCH_EXAMPLE_PORT` changes the loopback port.

The demo creates a unique schema, explicitly applies the migration for that schema, and drops that schema when stopped with SIGINT or SIGTERM. Never supply a production database. The HTTP server binds only loopback and rejects cross-origin requests. Its fixed demo-role header selects synthetic customer and operator principals; this is not deployable authentication. Real applications must replace that adapter with independent session verification and their existing CSRF controls. Body fields never replace the server scope or actor.

Save a report, submit or skip the follow-up, and inspect separate invitation/exposure/dismissal/submission counts. The modal restores focus and offers a return-to-product control independently of persistence. The editor supports all definition fields as validated JSON, including questions/options, period, registered target name, and frequency policy. Publish a new version rather than mutating an old one. The preview runs the same renderer and answer validator with no API write. Results use bounded pages and separate raw permissions; classification and deletion use reasons and revisions. Export shows only the first 100 current responses and marks that bound; CSV is escaped.

Report persistence is acknowledged before the separate invitation request. A slow or failed survey request cannot delay that acknowledgement or disable the next product action. Replacing an invitation in a mounted modal starts a new modal lifetime; an older submit or dismissal cannot close the replacement.

The result-state selector demonstrates loading, empty, partial, denied, error, and ready presentation. Actual ready data, submit, skip, publication, raw operations, and export use PostgreSQL API routes. Demonstration states do not fabricate successful collection.

## Validation

`pnpm --filter @croco-example/micro-surveys build` and `pnpm --filter @croco-example/micro-surveys typecheck` validate the consumer. `pnpm --filter @croco-example/micro-surveys build:browser` bundles the real React surface. Provider integration validation is described in [research-drizzle](../../packages/research-drizzle/README.md).

With a fresh disposable demo running, execute `RESEARCH_BROWSER_ORIGIN=http://127.0.0.1:4321 pnpm --filter @croco-example/micro-surveys verify:browser`. Verification uses the repository's existing Playwright dependency and local Chrome. It exercises actual API collection, preview isolation, permissions, deletion, keyboard/focus, responsive states and out-of-order acknowledgements. Separate real-component cases replace a mounted modal's invitation during submit and dismissal. Set `RESEARCH_BROWSER_EVIDENCE` to preserve screenshots and the evidence JSON outside the default temporary directory.
