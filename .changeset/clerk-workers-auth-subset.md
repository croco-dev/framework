---
"@croco/auth-clerk": minor
"create-croco-app": patch
---

Authenticate Clerk cookie and bearer sessions through an opt-in Workers entrypoint with audience, origin, tenant and fresh session status checks. Generated Cloudflare profiles expose the verified auth subset through an application-supplied lazy loader while retaining bootstrap-only host behavior and unavailable full SaaS/provider states.

Configured audience restrictions are enforced against signed claims for Node/Lambda and Workers, including missing and array-valued audiences.
