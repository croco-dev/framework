import { createOperation, defineOperation } from "@croco/protocols-core";
import { z } from "zod";
import { createRestOperationController } from "../index";

function checkBindingTypes() {
  const command = createOperation(
    defineOperation({
      id: "checkout.start",
      kind: "command",
      input: z.object({ id: z.string() }),
      output: z.string(),
      authorize(_context: { tenantId: string }) {},
    }),
    ({ id }) => id,
  );
  const binding = {
    path: "/checkout",
    input: "body" as const,
    createContext: () => ({ tenantId: "verified" }),
  };
  createRestOperationController(command, { ...binding, method: "POST" });
  // @ts-expect-error A command cannot be exported as GET.
  createRestOperationController(command, { ...binding, method: "GET" });
  createRestOperationController(command, {
    ...binding,
    method: "POST",
    // @ts-expect-error Binding context must satisfy the operation's server authority contract.
    createContext: () => ({ tenantId: 7 }),
  });
}
void checkBindingTypes;
