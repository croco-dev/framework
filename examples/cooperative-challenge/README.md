# Cooperative challenge

Two consenting members of the same tenant share a goal of four learning activities, with a cap of two per member. The participant controls and operator console call the same `ChallengeService`, backed by `DrizzleChallengeStore`. A server-side reader verifies durable activity receipts; callers do not supply contribution amounts. No mission, reward, referral, global ranking or social graph is required.

## Run

Run these commands from the monorepo root after installing dependencies. Supply a disposable PostgreSQL database. The migration command explicitly creates challenge tables and synthetic membership/activity fixtures; the server never performs startup DDL.

```bash
export CHALLENGE_EXAMPLE_DATABASE_URL=postgresql://localhost/challenge_example
pnpm --filter @croco-example/cooperative-challenge... build
pnpm --filter @croco-example/cooperative-challenge migrate
pnpm --filter @croco-example/cooperative-challenge dev
```

Open `http://127.0.0.1:4182/`. Join as Member A, complete several activities and observe that the group total stops at two. Switch to Member B, explicitly join and complete two activities to reach the shared goal. Each identity sees its own contribution and the group total. Leave and reload to inspect the retained-credit policy. The operator route exposes the fixed period, cap, minimum participation, visibility and settlement rules. Policies can be edited only before the start and before anyone consents.

The initial challenge lasts thirty minutes, starts one second after initialization and accepts late receipts for one minute after its exclusive end. Reaching the goal is provisional: `close` settles only after the late window ends and creates one durable completion intent when both the goal and minimum active membership are met. An application may deliver that intent through an existing idempotent event/outbox publisher; this example does not pay rewards. Retrying settlement or restarting the server preserves the final outcome.

## Application boundaries

This loopback example uses three allowlisted synthetic identities in an explicit request header. It is a runnable local fixture, not a production authentication adapter. A production host resolves the authenticated subject, actor and app/environment/tenant scope on the server and binds its authorization callback. Membership is read using the existing `membership-drizzle` tenant/user schema. Learning activities are persisted before contribution verification and scoped by app, environment and tenant.

An uncertain network or verification outcome preserves the pending activity key in session storage, including across reloads, for an explicit retry. Authorization loss also preserves the key because verification may already have registered a pending attempt; restore access and retry that activity. A confirmed eligibility or policy rejection clears the key and reloads current participation before another activity can be submitted. Unresolved evidence is shown as incomplete progress and prevents finalization; a known joined member can still withdraw participation. Activity receipts and delivery attempts have separate owners from the globally deduplicated accepted event.

The core owns participation intervals independently of current tenant membership. Events before joining, in a leave/rejoin gap or after leaving are ineligible. Under `retain`, previously accepted capped credit remains; under `remove`, credit from prior participation intervals stays removed on rejoin. Finalized aggregate outcomes are immutable.

For privacy deletion, invoke `eraseSubject` with authorization to delete that subject in the exact challenge scope, even if tenant membership has ended. Identifying participation, evidence and audit fields are removed; anonymous aggregate credit follows the fixed leave policy. Minimal pseudonymous suppression and replay digests remain to prevent cap resets and evidence replay, and the erased subject cannot rejoin that challenge. Those digests need an application retention/deletion policy; they are not anonymous personal-data deletion. Delete upstream learning receipts through their separate owning source policy. No cached response can restore erased raw activity.

Both new packages are alpha and have local PostgreSQL evidence; they are not provider-certified or published by this example. The current adapter loads and rewrites one challenge's records under a row lock, so it is intended for bounded organization groups. Public participant projections default to twenty rows, accept at most one hundred and expose consenting totals only to active participants; raw activity is never returned.
