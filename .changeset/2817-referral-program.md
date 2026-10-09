---
"@croco/referral-core": minor
"@croco/referral-drizzle": minor
"@croco/admin-core": minor
"@croco/admin-react": minor
"@croco/frontend-react": minor
"@croco/problems-core": patch
"create-croco-app": patch
---

Add explicit referral attribution from a shared link through qualification to dual-side benefits. Programs pin benefit snapshots, conversion windows, and qualifying actions; the first valid claim for a recipient inside a program family wins, and later claims are held as duplicates. Qualification and novelty come from authoritative app-owned server sources, never from client assertions or IP/device similarity. Benefits fulfill per side with deterministic idempotency keys, so one side may succeed while the other stays pending without re-paying the completed side on retry. Trial credits fulfill through the existing credit ledger adapter (server-only `@croco/referral-core/credit-grant` subpath) with an explicit account-mapping resolver; link tokens are issued via `@croco/referral-core/link-token` with hash-only persistence. The browser-safe root barrel depends only on problems-core so generated console-web Vite builds no longer pull node-only modules.
