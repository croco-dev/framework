import "reflect-metadata";
import { createRequire } from "node:module";
import { Container } from "@croco/framework-context";
import {
  Field,
  FieldResolver,
  ObjectType,
  Mutation,
  Query,
  Resolver,
  Roles,
  Subscription,
  UseGuards,
  UseInterceptors,
} from "@croco/protocols-graphql";
import type { GraphQLInterceptor, GraphQLInterceptorContext } from "@croco/protocols-graphql";
import type * as GraphQL from "graphql";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SchemaCompiler } from "../libs/SchemaCompiler";

const {
  graphql,
  parse,
  subscribe: subscribeGraphQL,
} = createRequire(import.meta.url)("graphql") as typeof GraphQL;
const calls: string[] = [];

class Uppercase implements GraphQLInterceptor {
  async intercept(_context: GraphQLInterceptorContext, next: { handle(): Promise<unknown> }) {
    calls.push("uppercase");
    return String(await next.handle()).toUpperCase();
  }
}

class ChildTransform implements GraphQLInterceptor {
  async intercept(_context: GraphQLInterceptorContext, next: { handle(): Promise<unknown> }) {
    calls.push("child");
    return `child:${String(await next.handle())}`;
  }
}

async function execute(resolvers: Function[], source = "{ inherited }") {
  const schema = await SchemaCompiler.compileSchema({ resolvers, autoDiscover: false });
  return graphql({ schema, source });
}

describe("GraphQL execution metadata inheritance", () => {
  beforeEach(() => {
    Container.reset();
    calls.length = 0;
    Container.set(Uppercase, new Uppercase());
    Container.set(ChildTransform, new ChildTransform());
  });

  afterEach(() => Container.reset());

  it("executes the interceptor once for both the base and child schemas", async () => {
    @Resolver()
    class BaseResolver {
      @Query(() => String, { name: "inherited" })
      @UseInterceptors(Uppercase)
      greeting() {
        return "hello";
      }
    }

    const baseSchema = await SchemaCompiler.compileSchema({
      resolvers: [BaseResolver],
      autoDiscover: false,
    });
    expect(await graphql({ schema: baseSchema, source: "{ inherited }" })).toEqual({
      data: { inherited: "HELLO" },
    });
    expect(calls).toEqual(["uppercase"]);

    @Resolver()
    class ChildResolver extends BaseResolver {}

    calls.length = 0;
    expect(await execute([ChildResolver])).toEqual({ data: { inherited: "HELLO" } });
    expect(calls).toEqual(["uppercase"]);
    calls.length = 0;
    expect(await graphql({ schema: baseSchema, source: "{ inherited }" })).toEqual({
      data: { inherited: "HELLO" },
    });
    expect(calls).toEqual(["uppercase"]);
  });

  it("uses the child's own interceptor on an inherited GraphQL declaration", async () => {
    @Resolver()
    class BaseResolver {
      @Query(() => String)
      @UseInterceptors(Uppercase)
      inherited() {
        return "hello";
      }
    }
    @Resolver()
    class ChildResolver extends BaseResolver {
      @UseInterceptors(ChildTransform)
      override inherited() {
        return "override";
      }
    }

    expect(await execute([ChildResolver])).toEqual({ data: { inherited: "child:override" } });
    expect(calls).toEqual(["child"]);
  });

  it("selects the concrete child when both base and child are registered", async () => {
    @Resolver()
    class BaseResolver {
      @Query(() => String)
      @UseInterceptors(Uppercase)
      inherited() {
        return "hello";
      }
    }
    @Resolver()
    class ChildResolver extends BaseResolver {
      @UseInterceptors(ChildTransform)
      override inherited() {
        return "override";
      }
    }

    expect(await execute([BaseResolver, ChildResolver])).toEqual({
      data: { inherited: "child:override" },
    });
    expect(calls).toEqual(["child"]);
    calls.length = 0;
    expect(await execute([ChildResolver, BaseResolver])).toEqual({
      data: { inherited: "child:override" },
    });
    expect(calls).toEqual(["child"]);
  });

  it("finds the nearest own metadata through multiple inheritance levels", async () => {
    @Resolver()
    class BaseResolver {
      @Query(() => String)
      @UseInterceptors(Uppercase)
      inherited() {
        return "hello";
      }
    }
    @Resolver()
    class MiddleResolver extends BaseResolver {
      @UseInterceptors(ChildTransform)
      override inherited() {
        return "middle";
      }
    }
    @Resolver()
    class LeafResolver extends MiddleResolver {}

    expect(await execute([LeafResolver])).toEqual({ data: { inherited: "child:middle" } });
    expect(calls).toEqual(["child"]);
  });

  it("matches the exposed schema field when a child declares a different method", async () => {
    @Resolver()
    class BaseResolver {
      @Query(() => String, { name: "inherited" })
      @UseInterceptors(Uppercase)
      original() {
        return "base";
      }
    }
    @Resolver()
    class ChildResolver extends BaseResolver {
      @Query(() => String, { name: "inherited" })
      @UseInterceptors(ChildTransform)
      replacement() {
        return "replacement";
      }
    }

    expect(await execute([ChildResolver])).toEqual({ data: { inherited: "child:replacement" } });
    expect(calls).toEqual(["child"]);
  });

  it("preserves interceptor execution on a noninherited resolver", async () => {
    @Resolver()
    class StandaloneResolver {
      @Query(() => String)
      @UseInterceptors(Uppercase)
      inherited() {
        return "hello";
      }
    }

    expect(await execute([StandaloneResolver])).toEqual({ data: { inherited: "HELLO" } });
    expect(calls).toEqual(["uppercase"]);
  });

  it("isolates inherited field interceptors by the parent object type", async () => {
    @ObjectType()
    class InheritedPerson {
      @Field(() => String)
      name!: string;
    }
    @ObjectType()
    class UnrelatedOrganization {
      @Field(() => String)
      name!: string;
    }
    @Resolver(() => InheritedPerson)
    class BasePersonResolver {
      @FieldResolver(() => String)
      @UseInterceptors(Uppercase)
      name() {
        calls.push("person:handler");
        return "person";
      }
    }
    @Resolver(() => InheritedPerson)
    class ChildPersonResolver extends BasePersonResolver {}
    @Resolver(() => UnrelatedOrganization)
    class OrganizationResolver {
      @FieldResolver(() => String)
      @UseInterceptors(ChildTransform)
      name() {
        calls.push("organization:handler");
        return "organization";
      }
    }
    @Resolver()
    class QueryResolver {
      @Query(() => InheritedPerson)
      person() {
        return { name: "person-property-sentinel" };
      }
      @Query(() => UnrelatedOrganization)
      organization() {
        return { name: "organization-property-sentinel" };
      }
    }

    expect(
      await execute(
        [QueryResolver, ChildPersonResolver, OrganizationResolver],
        "{ person { name } organization { name } }",
      ),
    ).toEqual({
      data: { person: { name: "PERSON" }, organization: { name: "child:organization" } },
    });
    expect(calls.sort()).toEqual(["child", "organization:handler", "person:handler", "uppercase"]);
  });

  it("keeps the actual root handler's guard when an unselected sibling owns inherited metadata", async () => {
    class DenyGuard {
      canActivate() {
        calls.push("guard");
        return false;
      }
    }
    Container.set(DenyGuard, new DenyGuard());
    @Resolver()
    class ActualResolver {
      @Query(() => String)
      @UseGuards(DenyGuard)
      value() {
        calls.push("actual:handler");
        return "secret";
      }
    }
    @Resolver()
    class BaseResolver {
      @Query(() => String)
      @UseInterceptors(Uppercase)
      value() {
        calls.push("base:handler");
        return "hello";
      }
    }
    Resolver()(class FirstResolver extends BaseResolver {});
    @Resolver()
    class SecondResolver extends BaseResolver {}

    const result = await execute([ActualResolver, SecondResolver], "{ value }");
    expect(result.data).toBeNull();
    expect(result.errors?.[0]?.originalError).toMatchObject({
      code: "protocols-graphql/guard-denied",
    });
    expect(calls).toEqual(["guard"]);
  });

  it("keeps the actual object handler's guard when another method aliases its field", async () => {
    class DenyGuard {
      canActivate() {
        calls.push("guard");
        return false;
      }
    }
    Container.set(DenyGuard, new DenyGuard());
    @ObjectType()
    class GuardedPerson {
      @Field(() => String)
      name!: string;
    }
    @Resolver(() => GuardedPerson)
    class BaseResolver {
      @FieldResolver(() => String, { name: "name" })
      @UseInterceptors(Uppercase)
      displayName() {
        calls.push("alias:handler");
        return "unused";
      }
    }
    @Resolver(() => GuardedPerson)
    class ChildResolver extends BaseResolver {}
    @Resolver(() => GuardedPerson)
    class ActualResolver {
      @FieldResolver(() => String)
      @UseGuards(DenyGuard)
      name() {
        calls.push("actual:handler");
        return "secret";
      }
    }
    @Resolver()
    class QueryResolver {
      @Query(() => GuardedPerson)
      person() {
        return { name: "source-property-sentinel" };
      }
    }

    const result = await execute(
      [QueryResolver, ChildResolver, ActualResolver],
      "{ person { name } }",
    );
    expect(result.data).toBeNull();
    expect(result.errors?.[0]?.originalError).toMatchObject({
      code: "protocols-graphql/guard-denied",
    });
    expect(calls).toEqual(["guard"]);
  });

  it("matches aliased and synthesized fields inherited from an object type", async () => {
    @ObjectType()
    class ParentFields {
      @Field(() => String, { name: "visible" })
      original!: string;
    }
    @ObjectType()
    class ChildFields extends ParentFields {}
    @Resolver(() => ParentFields)
    class BaseResolver {
      @FieldResolver(() => String, { name: "visible" })
      @UseInterceptors(Uppercase)
      original() {
        calls.push("original:handler");
        return "original";
      }
      @FieldResolver(() => String, { name: "generated" })
      @UseInterceptors(Uppercase)
      computed() {
        calls.push("computed:handler");
        return "computed";
      }
    }
    @Resolver(() => ParentFields)
    class ChildResolver extends BaseResolver {}
    @Resolver()
    class QueryResolver {
      @Query(() => ChildFields)
      item() {
        return { original: "property-sentinel" };
      }
    }

    expect(await execute([QueryResolver, ChildResolver], "{ item { visible generated } }")).toEqual(
      {
        data: { item: { visible: "ORIGINAL", generated: "COMPUTED" } },
      },
    );
    expect(calls.sort()).toEqual([
      "computed:handler",
      "original:handler",
      "uppercase",
      "uppercase",
    ]);
  });

  it("preserves inherited guard denial before executing a resolver", async () => {
    class DenyGuard {
      canActivate() {
        return false;
      }
    }
    Container.set(DenyGuard, new DenyGuard());
    @Resolver()
    class BaseResolver {
      @Query(() => String)
      @UseGuards(DenyGuard)
      inherited() {
        calls.push("resolver");
        return "hello";
      }
    }
    @Resolver()
    class ChildResolver extends BaseResolver {}

    const result = await execute([ChildResolver]);
    expect(result.data).toBeNull();
    expect(result.errors?.[0]?.originalError).toMatchObject({
      code: "protocols-graphql/guard-denied",
    });
    expect(calls).toEqual([]);
  });

  it("executes an inherited mutation interceptor once", async () => {
    @Resolver()
    class BaseResolver {
      @Query(() => String)
      health() {
        return "ok";
      }
      @Mutation(() => String)
      @UseInterceptors(Uppercase)
      inherited() {
        return "hello";
      }
    }
    @Resolver()
    class ChildResolver extends BaseResolver {}

    expect(await execute([ChildResolver], "mutation { inherited }")).toEqual({
      data: { inherited: "HELLO" },
    });
    expect(calls).toEqual(["uppercase"]);
  });

  it("enforces inherited roles before a subscription acquires an iterator", async () => {
    @Resolver()
    class BaseResolver {
      @Query(() => String)
      health() {
        return "ok";
      }
      @Subscription(() => String, { topics: "update" })
      @Roles("admin")
      @UseInterceptors(Uppercase)
      update() {
        return "hello";
      }
    }
    @Resolver()
    class ChildResolver extends BaseResolver {}

    const schema = await SchemaCompiler.compileSchema({
      resolvers: [ChildResolver],
      autoDiscover: false,
      pubSub: {
        publish: async () => undefined,
        subscribe: () => {
          calls.push("subscribe");
          return (async function* () {
            yield "hello";
          })();
        },
      },
    });
    const subscribe = schema.getSubscriptionType()?.getFields()["update"]?.subscribe;
    expect(subscribe).toBeDefined();
    await expect(
      Promise.resolve(
        subscribe?.(undefined, {}, { user: { roles: ["member"] } }, undefined as never),
      ),
    ).rejects.toMatchObject({
      code: "protocols-graphql/guard-denied",
    });
    expect(calls).toEqual([]);

    const result = await subscribeGraphQL({
      schema,
      document: parse("subscription { update }"),
      contextValue: { user: { roles: ["admin"] } },
    });
    if (!(Symbol.asyncIterator in result)) {
      throw new Error("Expected an authorized subscription iterator");
    }
    for await (const event of result) {
      expect(event).toEqual({ data: { update: "HELLO" } });
      break;
    }
    expect(calls).toEqual(["subscribe", "uppercase"]);
  });
});
