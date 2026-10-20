import { buildSchema, isObjectType } from "graphql";
import { GraphQLAuthGuard } from "@croco/protocols-graphql/fetch";
import { createGraphQLFetchHandler } from "@croco/transports-graphql/fetch";
import { ProblemFactory } from "@croco/problems-core";

// Synthetic credentials and data for this loopback-only example. No production authentication.
export function createApi(schemaSDL: string) {
  const schema = buildSchema(schemaSDL);
  const guard = new GraphQLAuthGuard({
    verifier: (token) => (["alice", "bob"].includes(token) ? { id: token } : undefined),
  });
  type Context = { user?: { id: string }; request: Request; headers: Record<string, string> };
  const discounts = new Set<string>();
  const tenant = (context: Context) =>
    context.request.headers.get("cookie")?.includes("tenant=south") ? "south" : "north";
  const discountOwner = (context: Context) => `${context.user?.id}:${tenant(context)}`;
  const query = schema.getQueryType()?.getFields();
  const product = schema.getType("Product");
  const mutation = schema.getMutationType()?.getFields();
  if (!query || !mutation || !product || !isObjectType(product))
    throw ProblemFactory.internalServerError("apollo-example/schema", "Invalid fixture schema");
  query.product.resolve = async (root, args, context, info) => {
    await guard.canActivate({ root, args, context, info });
    return args.id === "p1" ? { id: "p1", name: "Field notebook" } : null;
  };
  product.getFields().quote.resolve = async (root, args, context: Context, info) => {
    await guard.canActivate({ root, args, context, info });
    if (!["member", "standard"].includes(args.variant))
      throw ProblemFactory.forbidden("apollo-example/variant", "Variant is not available");
    const amount =
      (context.user?.id === "alice" ? 17 : 31) +
      (args.variant === "standard" ? 9 : 0) +
      (tenant(context) === "south" ? 7 : 0) -
      (discounts.has(discountOwner(context)) ? 3 : 0);
    return { amount: amount.toFixed(2), currency: "USD" };
  };
  query.serverOnly.resolve = async (root, args, context, info) => {
    await guard.canActivate({ root, args, context, info });
    return "server-only-secret";
  };
  const deny = () => {
    throw ProblemFactory.forbidden("apollo-example/denied", "Not allowed");
  };
  query.denied.resolve = deny;
  query.requiredDenied.resolve = deny;
  mutation.discount.resolve = async (root, args, context: Context, info) => {
    await guard.canActivate({ root, args, context, info });
    if (args.id !== "p1" || !["member", "standard"].includes(args.variant))
      throw ProblemFactory.badRequest("apollo-example/discount", "Invalid discount target");
    discounts.add(discountOwner(context));
    return { id: "p1", name: "Field notebook" };
  };
  const handler = createGraphQLFetchHandler({ schema, cors: false });
  return (request: Request) => {
    const headers = new Headers(request.headers);
    // Only this synthetic fixture translates its HttpOnly session cookie into the common guard input.
    if (!headers.get("authorization")) {
      const user = headers.get("cookie")?.match(/(?:^|; )session=(alice|bob)(?:;|$)/)?.[1];
      if (user) headers.set("authorization", `Bearer ${user}`);
    }
    return handler(new Request(request, { headers }));
  };
}
