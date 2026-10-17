# Standalone acquisition comparison

Synthetic first-party browser → server validator → PostgreSQL receipts → the shared attribution
engine → AcquisitionInspector. No survey, referral program, event catalog or identity graph is required.

```bash
# Use a disposable PostgreSQL database named acquisition on loopback only.
# Apply the package migration explicitly before accepting traffic (the demo does this at startup).
ANALYTICS_POSTGRES_URL=postgres://postgres:local-password@127.0.0.1:5432/acquisition pnpm --filter @croco-example/acquisition dev
```

Open `http://127.0.0.1:4187/?utm_source=newsletter&token=synthetic-secret#synthetic-fragment`.
Choose **Collect this visit**, **Link authenticated demo user**, then collect a direct visit on `/`.
First touch selects the newsletter; last observed selects the later unknown/direct visit with credit 0.
Import conflicting customer responses to see their separate provenance and an unchanged conversion
count. Logout rotates the anonymous session. Deletion erases linked observations and report references.

The button is an explicit synthetic collection opt-in. The helper clears query and fragment before
its POST and sends only registered codes, landing references and allowlisted referrer origins. The
server sets no-store/no-referrer, never logs request URLs, headers, bodies or private causes, rejects
query-bearing API URLs and cross-origin POSTs, revalidates the context, and derives scope and identity
from server state. Arbitrary client identity/scope/source fields cannot override those values.

This loopback demo has one illustrative operator and one synthetic user, in-memory session cookies,
and a durable local database. It is not a production authentication, consent, retention scheduler or
access-log configuration. A production application must authenticate both the subject and ownership
of the anonymous session in `policy.authorize`, apply CSRF controls, rotate sessions on logout and
principal changes, restrict read/write/export/delete separately, implement field masking, run retention
purges, and prevent raw URL collection by its proxy, CDN, analytics and logging middleware **before**
this page is served. The browser cannot erase a URL already logged by an upstream server.

`createAcquisition` is an additive transactional migration. It owns two new tables and performs no
changes to existing analytics data. Service and adapter constructors run no DDL. Reverting application
code does not erase data; use authorized deletion and retention operations before a separately reviewed
destructive schema removal. No production tracking, external advertising account or causal inference
is exercised here.

With the server running against a fresh disposable database, `pnpm --filter @croco-example/acquisition test:browser`
uses the repository's headless Chrome/Playwright installation. It verifies first/last credits, separate
responses, keyboard refresh, narrow-screen layout, all Inspector states, URL sanitization before POST,
server validation and logout isolation. Screenshots and assertions are written to the OS temporary
directory (`croco-2827-browser`), outside the worktree. The synthetic fixtures are local only.
