# Targeting impact: synthetic historical replay

Run from the repository root after `pnpm install`:

```sh
pnpm --filter @croco-example/targeting-impact dev
pnpm --filter @croco-example/targeting-impact test
pnpm --filter @croco-example/targeting-impact typecheck
```

Open http://127.0.0.1:4185/. Compare filters, save and re-read the report, then export the saved aggregate JSON. Changing the unknown policy changes the definition revision and hash. The server holds the synthetic scope and authority; requests cannot supply permissions or replace its tenant.

The `ready` fixture seeds an actual `InMemoryCampaignStore` with 100 recipients and explicit `{ policyReplayRow }` decision-time history envelopes. The bounded campaign adapter reads four pages. Removing 20 subjects with one observed 10 KRW dispatch each yields 200 KRW in observed dispatch costs. Visits before send, after click, and after send without a click are distinct observations. Tests repeat one financial event across messages and verify single credit.

Use `?state=partial`, `empty`, `unavailable`, `denied`, or `error` for deterministic source states. Partial history includes 10 unknown subjects and one missing dispatch cost. Missing evidence is not replaced with current traits or zero cost. Loading reflects pending server requests; use browser network throttling to inspect it.

`POST /compare`, `/save`, `/get`, and `/export` call the same server-side operations service. Compare uses the campaign adapter. Save uses the same immutable synthetic history input and re-read validates stored evidence; get/export are scope authorized. Bodies are limited to 4 KiB. Browser responses and exports contain aggregates, not subject rows.

This is a local synthetic fixture, not authentication or durable production storage. Reports reset on server restart. No messages are sent. Observed revenue and crediting scenarios do not establish causal loss or incremental lift. No real growth outcomes or provider certification are claimed. The example adds no LLM dependency.
