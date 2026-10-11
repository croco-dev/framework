---
editUrl: false
next: false
prev: false
title: "PERSONALIZED_CACHE_DIMENSION_ALLOWLIST"
---

> `const` **PERSONALIZED_CACHE_DIMENSION_ALLOWLIST**: readonly \[`"region"`, `"currency"`, `"pricePolicy"`, `"locale"`, `"channel"`, `"surface"`, `"experiment"`, `"variant"`, `"representation"`, `"deploy"`\]

Dimension names that may influence cache identity. Anything else,
including user ids, raw cookies, and credentials, is rejected so high
cardinality PII can never become part of a shared key.
