---
"@croco/framework-context": minor
"@croco/events-core": patch
"@croco/problems-core": patch
"@croco/testing": minor
"@croco/transports-http": minor
"create-croco-app": patch
---

Boot production application definitions in isolated, runner-neutral test kernels with explicit application or adapter fidelity.

Each kernel now owns its DI instances, event configuration, test transaction evidence, request state, scoped production shutdown hooks, and one-time cleanup lifecycle without replacing the application's production transaction provider. Node and Lambda adapter requests run through their real handler paths without opening a public network port, while the existing lightweight testing app is reported as isolated fidelity.
