# @croco/admin-generated

Contract Graph driven admin resource configuration generator for Croco.

The package groups conservative REST route shapes into admin resources, preserves declared route
Problems and generated input/output type names, and fails unsupported or ambiguous route shapes with
stable diagnostics instead of guessing.

```typescript
import { generateAdminResourceSourceFromContractGraph } from "@croco/admin-generated";
import { buildContractGraph } from "@croco/protocols-core";

const source = generateAdminResourceSourceFromContractGraph(buildContractGraph([UsersController]));
```
