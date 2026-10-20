import { z } from "zod";
import { createOperation, defineOperation } from "../index";

const definition = defineOperation({
  id: "product.detail",
  kind: "query",
  input: z.object({ id: z.string(), count: z.string().transform(Number) }),
  output: z.object({ price: z.number().transform(String) }),
  authorize(_context: { tenantId: string }) {},
});
const operation = createOperation(definition, (input, context) => ({
  price: input.count + context.tenantId.length,
}));

function checkTypes() {
  const output: Promise<{ price: string }> = operation.invoke(
    { id: "p7", count: "2" },
    { tenantId: "verified" },
  );
  // @ts-expect-error Raw input is the schema input, not its transformed output.
  operation.invoke({ id: "p7", count: 2 }, { tenantId: "verified" });
  // @ts-expect-error Server authority is a separate required argument.
  operation.invoke({ id: "p7", count: "2", tenantId: "attacker" });
  // @ts-expect-error Handler output must fit the schema input before projection.
  createOperation(definition, () => ({ price: "not-a-number" }));
  // @ts-expect-error A different server context cannot satisfy the operation contract.
  operation.invoke({ id: "p7", count: "2" }, { userId: "p7" });
  return output;
}
void checkTypes;
