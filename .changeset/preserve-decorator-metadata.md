---
"@croco/analytics-posthog": patch
"@croco/auth-better-auth": patch
"@croco/billing-core": patch
"@croco/billing-polar": patch
"@croco/customer-health-core": patch
"@croco/customer-health-drizzle": patch
"@croco/entitlements-core": patch
"@croco/entitlements-drizzle": patch
"@croco/features-posthog": patch
"@croco/framework-config": patch
"@croco/framework-context": patch
"@croco/framework-logger": patch
"@croco/impersonation-core": patch
"@croco/integrations-posthog": patch
"@croco/invitation-core": patch
"@croco/invitation-drizzle": patch
"@croco/llm-core": patch
"@croco/membership-core": patch
"@croco/membership-drizzle": patch
"@croco/metering-core": patch
"@croco/metrics-billing": patch
"@croco/notifications-core": patch
"@croco/notifications-resend": patch
"@croco/onboarding-core": patch
"@croco/onboarding-drizzle": patch
"@croco/problems-core": patch
"@croco/protocols-graphql": patch
"@croco/search-core": patch
"@croco/search-drizzle": patch
"@croco/search-meilisearch": patch
"@croco/storage-cloudflare": patch
"@croco/storage-cloudinary": patch
"@croco/storage-r2": patch
"@croco/transports-http": patch
---

Preserve runtime class-decorator metadata in published ESM and CJS bundles so Croco can resolve concrete constructor dependencies from installed packages.
