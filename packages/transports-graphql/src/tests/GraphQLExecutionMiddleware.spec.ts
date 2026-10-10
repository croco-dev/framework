import "reflect-metadata";
import { createRequire } from "node:module";
import { Container } from "@croco/framework-context";
import {
  Field,
  FieldResolver,
  ObjectType,
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

const { graphql } = createRequire(import.meta.url)("graphql") as typeof GraphQL;
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
      @FieldResolver(() => String, { name: "name" })
      @UseInterceptors(Uppercase)
      displayName() {
        return "person";
      }
    }
    @Resolver(() => InheritedPerson)
    class ChildPersonResolver extends BasePersonResolver {}
    @Resolver(() => UnrelatedOrganization)
    class OrganizationResolver {
      @FieldResolver(() => String, { name: "name" })
      @UseInterceptors(ChildTransform)
      displayName() {
        return "organization";
      }
    }
    @Resolver()
    class QueryResolver {
      @Query(() => InheritedPerson)
      person() {
        return { name: "person" };
      }
      @Query(() => UnrelatedOrganization)
      organization() {
        return { name: "organization" };
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
    expect(calls.sort()).toEqual(["child", "uppercase"]);
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

  it("enforces inherited roles before a subscription acquires an iterator", async () => {
    @Resolver()
    class BaseResolver {
      @Query(() => String)
      health() {
        return "ok";
      }
      @Subscription(() => String, { topics: "update" })
      @Roles("admin")
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
  });
});
