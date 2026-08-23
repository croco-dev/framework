# @croco/admin-generated

Contract Graph driven admin resource configuration generator for Croco.

The package groups conservative REST route shapes into admin resources, preserves declared route
Problems and generated input/output type names, and fails unsupported or ambiguous route shapes with
stable diagnostics instead of guessing.

Every generated operation, action, and client binding includes a normalized `entitlements` array.
Downstream admin adapters can use this route policy input when deciding which protected operations to
present, but entitlement evaluation remains outside the generator.

```typescript
import { generateAdminResourceSourceFromContractGraph } from "@croco/admin-generated";
import { buildContractGraph } from "@croco/protocols-core";

const source = generateAdminResourceSourceFromContractGraph(buildContractGraph([UsersController]));
```
