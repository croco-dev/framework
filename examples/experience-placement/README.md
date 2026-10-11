# In-app experience example

This example uses `@croco/experience-core`, `@croco/experience-drizzle`, the
`ExperienceConsole`, and `ExperienceSlot` against a disposable PostgreSQL database.
The default path uses registered context and a static subject list. Set
`EXPERIENCE_AUDIENCE_MODE=cohort` on a fresh database to select the same placement
through the existing `PublishedCohortReader` and a synthetic published snapshot.
The cohort fixture is an executable reader integration, not a warehouse producer.

```bash
docker run --rm -d --name croco-experience-demo \
  -e POSTGRES_PASSWORD=demo -e POSTGRES_DB=experience -p 5543:5432 postgres:16-alpine
EXPERIENCE_DATABASE_URL=postgres://postgres:demo@127.0.0.1:5543/experience \
  pnpm --filter @croco-example/experience-placement dev
```

Open `http://127.0.0.1:4177`. Edit the allowed fields, preview the real registered
renderer, enter an audit reason, and publish. The checkout panel uses the server
decision sent in the HTML and hydrated unchanged. Its view observation confirms the
server-issued receipt; Dismiss stores a durable subject/configuration dismissal. A
pause takes effect for subsequent decisions after its transaction commits. Already
rendered content is not recalled. The adapter does not cache active configuration,
so there is no additional in-process pause propagation delay.

The example fixes a synthetic operator, subject, and tenant to make it runnable
without credentials. A production host must authenticate the operator and subject,
authorize every request, provide its own PostgreSQL migration lifecycle, and supply
its own privacy reader and published cohort store. The included cohort fixture is
valid for one hour from server start and intentionally has no warehouse dependency.
No HTML/RSC bridge is claimed; that separate integration is tracked in #2838.
