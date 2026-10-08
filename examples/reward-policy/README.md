# Reward policy example

A standalone report achievement grants non-monetary points or badges through the persisted reward service. The local server resolves a demo session; request data cannot choose the subject, scope, evidence, or random draw. This loopback-only example is not a production authentication provider.

Use a disposable PostgreSQL database, then run:

```sh
export REWARD_EXAMPLE_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/rewards
pnpm --filter @croco-example/reward-policy setup
pnpm --filter @croco-example/reward-policy dev
```

Open http://127.0.0.1:4321. Setup applies the explicit reward migration and the example-owned reports table once. Server restarts retain grants and budgets. Save the first report to confirm achievement on the server and receive a receipt. Repeating the action uses the same evidence and cannot redraw or award twice. Policy edits require a new version and reason; weighted selection requires explicit opt-in. Both points and badges are non-transferable achievement records with no cash value.

The server uses a fixed test tenant and local operator. Production applications must replace that demo session with their authenticated authorization boundary and retain server-owned achievement verification. The domain does not require onboarding, engagement, or experimentation packages.
