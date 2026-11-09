---
"@croco/rpc-codegen": patch
"@croco/problems-core": patch
"create-croco-app": patch
---

Generated RPC clients typecheck and run in native NodeNext ESM consumers using explicit JavaScript module extensions. Regeneration continues to recognize existing extensionless outputs and preserves generated-file ownership.
Fresh scaffold RPC clients use the same relative module specifiers, keeping generated contract checks aligned before the first regeneration.
Problem recovery references point to the current generated client definitions.
