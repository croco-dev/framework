---
"@croco/cache-core": major
---

Default decorator cache keys include a tenant or global scope segment, preventing cached and in-flight results from being shared across request tenants. The key format change causes one cache miss for existing entries; old external-store keys remain until their TTL expires. Use `scope: "global"` to share entries across tenants explicitly.
