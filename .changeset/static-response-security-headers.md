---
"@croco/transports-http": patch
---

- fix(transports-http): send the headers configured by `securityHeadersMiddleware` (and other middleware that declares the `security-headers` capability) with static files and the SPA shell served by `listen({ staticDir })`. Apps that serve their UI this way now receive `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security` and, when enabled, `Content-Security-Policy` on HTML documents and assets. Review a custom `contentSecurityPolicy` value or `frameOptions` setting if the UI relies on inline styles, `data:` resources or being framed.
