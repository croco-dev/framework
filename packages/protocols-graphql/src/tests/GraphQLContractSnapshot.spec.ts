import "reflect-metadata";
import { ProblemCategory } from "@croco/problems-core";
import { beforeEach, describe, expect, it } from "vitest";
import { GRAPHQL_GUARDS_KEY, GRAPHQL_INTERCEPTORS_KEY, GRAPHQL_ROLES_KEY } from "../libs/constants";
import {
  createGraphQLContractSnapshot,
  diffGraphQLContractSnapshots,
  stringifyGraphQLContractSnapshot,
} from "../libs/contract";
import {
  Field,
  GraphQLProblemResponse,
  GraphQLResolver,
  Int,
  ObjectType,
  Query,
  Roles,
  UseGuards,
  UseInterceptors,
} from "../libs/decorators";
import { resolverRegistry } from "../libs/metadata/ResolverRegistry";

@ObjectType()
class HealthStatus {
  @Field(() => String)
  status!: string;
}

class AuthGuard {
  canActivate(): boolean {
    return true;
  }
}

class AuditInterceptor {
  intercept(): Promise<unknown> {
    return Promise.resolve(undefined);
  }
}

type ContractResolver = abstract new (...args: never[]) => unknown;

describe("GraphQL contract snapshots", () => {
  beforeEach(() => {
    resolverRegistry.clear();
  });

  it("creates a deterministic SDL and resolver metadata snapshot", async () => {
    @GraphQLResolver({ scope: "request" })
    class HealthResolver {
      @GraphQLProblemResponse({
        code: "GRAPHQL_HEALTH_UNAVAILABLE",
        category: ProblemCategory.InternalServerError,
      })
      @Roles("admin")
      @UseGuards(AuthGuard)
      @UseInterceptors(AuditInterceptor)
      @Query(() => HealthStatus)
      health(): HealthStatus {
        return { status: "ok" };
      }

      formatStatus(): string {
        return "ok";
      }
    }

    const schema = await buildContractSchema([HealthResolver]);
    const snapshot = createGraphQLContractSnapshot(schema, {
      resolvers: [HealthResolver],
    });

    expect(snapshot.snapshotVersion).toBe("croco.graphql-contract.snapshot.v2");
    expect(snapshot.sdl).toContain("type Query");
    expect(snapshot.sdl).toContain("health: HealthStatus!");
    expect(snapshot.operationCount).toBe(1);
    expect(snapshot.operations).toEqual([
      {
        args: [],
        kind: "query",
        name: "health",
        type: "HealthStatus!",
      },
    ]);
    expect(snapshot.resolvers).toEqual([
      {
        resolverName: "HealthResolver",
        diScope: "request",
        methods: [
          {
            methodName: "health",
            guards: ["AuthGuard"],
            interceptors: ["AuditInterceptor"],
            roles: ["admin"],
            problems: [
              {
                code: "GRAPHQL_HEALTH_UNAVAILABLE",
                category: ProblemCategory.InternalServerError,
                status: 500,
                redactionPolicy: "operator-only",
              },
            ],
          },
        ],
      },
    ]);
    expect(stringifyGraphQLContractSnapshot(snapshot)).toBe(
      stringifyGraphQLContractSnapshot(
        createGraphQLContractSnapshot(schema, { resolvers: [HealthResolver] }),
      ),
    );
  });

  it("classifies added and removed resolver operations in snapshot diffs", async () => {
    @GraphQLResolver()
    class HealthResolver {
      @Query(() => String)
      health(): string {
        return "ok";
      }
    }

    @GraphQLResolver()
    class ReadinessResolver {
      @Query(() => String)
      ready(): string {
        return "ready";
      }
    }

    const baselineSchema = await buildContractSchema([HealthResolver]);
    const currentSchema = await buildContractSchema([HealthResolver, ReadinessResolver]);
    const baseline = createGraphQLContractSnapshot(baselineSchema, {
      resolvers: [HealthResolver],
    });
    const current = createGraphQLContractSnapshot(currentSchema, {
      resolvers: [HealthResolver, ReadinessResolver],
    });

    const addedDiff = diffGraphQLContractSnapshots(baseline, current);
    expect(addedDiff.hasBreakingChanges).toBe(false);
    expect(addedDiff.nonBreakingChanges.map((change) => change.code)).toContain(
      "graphql-operation-added",
    );
    expect(addedDiff.nonBreakingChanges.map((change) => change.code)).toContain(
      "graphql-resolver-added",
    );

    const removedDiff = diffGraphQLContractSnapshots(current, baseline);
    expect(removedDiff.hasBreakingChanges).toBe(true);
    expect(removedDiff.breakingChanges.map((change) => change.code)).toEqual(
      expect.arrayContaining(["graphql-operation-removed", "graphql-resolver-removed"]),
    );
  });

  it("flags GraphQL field type changes as breaking drift", async () => {
    @GraphQLResolver()
    class StringHealthResolver {
      @Query(() => String, { name: "health" })
      health(): string {
        return "ok";
      }
    }

    @GraphQLResolver()
    class IntHealthResolver {
      @Query(() => Int, { name: "health" })
      health(): number {
        return 1;
      }
    }

    const baselineSchema = await buildContractSchema([StringHealthResolver]);
    const currentSchema = await buildContractSchema([IntHealthResolver]);
    const baseline = createGraphQLContractSnapshot(baselineSchema, {
      resolvers: [StringHealthResolver],
    });
    const current = createGraphQLContractSnapshot(currentSchema, {
      resolvers: [IntHealthResolver],
    });

    const diff = diffGraphQLContractSnapshots(baseline, current);

    expect(diff.hasBreakingChanges).toBe(true);
    expect(diff.breakingChanges.map((change) => change.code)).toContain(
      "graphql-schema-breaking-change",
    );
  });

  it("flags resolver metadata changes as breaking drift", async () => {
    let baselineSnapshot: ReturnType<typeof createGraphQLContractSnapshot>;
    let currentSnapshot: ReturnType<typeof createGraphQLContractSnapshot>;

    {
      @GraphQLResolver({ scope: "request" })
      class HealthResolver {
        @GraphQLProblemResponse({
          code: "GRAPHQL_HEALTH_UNAVAILABLE",
          category: ProblemCategory.InternalServerError,
        })
        @Query(() => String, { name: "health" })
        health(): string {
          return "ok";
        }
      }

      Reflect.defineMetadata(GRAPHQL_GUARDS_KEY, [AuthGuard], HealthResolver.prototype, "health");
      Reflect.defineMetadata(
        GRAPHQL_INTERCEPTORS_KEY,
        [AuditInterceptor],
        HealthResolver.prototype,
        "health",
      );
      Reflect.defineMetadata(GRAPHQL_ROLES_KEY, ["admin"], HealthResolver.prototype, "health");

      const schema = await buildContractSchema([HealthResolver]);
      baselineSnapshot = createGraphQLContractSnapshot(schema, {
        resolvers: [HealthResolver],
      });
    }

    {
      @GraphQLResolver()
      class HealthResolver {
        @Query(() => String, { name: "health" })
        health(): string {
          return "ok";
        }
      }

      const schema = await buildContractSchema([HealthResolver]);
      currentSnapshot = createGraphQLContractSnapshot(schema, {
        resolvers: [HealthResolver],
      });
    }

    const diff = diffGraphQLContractSnapshots(baselineSnapshot, currentSnapshot);

    expect(diff.hasBreakingChanges).toBe(true);
    expect(diff.breakingChanges.map((change) => change.code)).toEqual(
      expect.arrayContaining([
        "graphql-resolver-di-scope-changed",
        "graphql-resolver-guards-changed",
        "graphql-resolver-interceptors-changed",
        "graphql-resolver-roles-changed",
        "graphql-resolver-problems-changed",
      ]),
    );
  });

  it("ignores implementation-only resolver helper methods", async () => {
    let baselineSnapshot: ReturnType<typeof createGraphQLContractSnapshot>;
    let currentSnapshot: ReturnType<typeof createGraphQLContractSnapshot>;

    {
      @GraphQLResolver()
      class HealthResolver {
        @Query(() => String)
        health(): string {
          return this.formatStatus();
        }

        formatStatus(): string {
          return "ok";
        }
      }

      const schema = await buildContractSchema([HealthResolver]);
      baselineSnapshot = createGraphQLContractSnapshot(schema, {
        resolvers: [HealthResolver],
      });
    }

    {
      @GraphQLResolver()
      class HealthResolver {
        @Query(() => String)
        health(): string {
          return "ok";
        }
      }

      const schema = await buildContractSchema([HealthResolver]);
      currentSnapshot = createGraphQLContractSnapshot(schema, {
        resolvers: [HealthResolver],
      });
    }

    expect(baselineSnapshot.resolvers[0]?.methods.map((method) => method.methodName)).toEqual([
      "health",
    ]);
    expect(diffGraphQLContractSnapshots(baselineSnapshot, currentSnapshot).changes).toEqual([]);
  });

  it("isolates inherited resolver method metadata with clone-on-write problem responses", async () => {
    class BaseGuard {
      canActivate(): boolean {
        return true;
      }
    }

    class DerivedGuard {
      canActivate(): boolean {
        return true;
      }
    }

    class BaseInterceptor {
      intercept(): Promise<unknown> {
        return Promise.resolve(undefined);
      }
    }

    class DerivedInterceptor {
      intercept(): Promise<unknown> {
        return Promise.resolve(undefined);
      }
    }

    @GraphQLResolver()
    class BaseResolver {
      @GraphQLProblemResponse({
        code: "GRAPHQL_BASE_UNAVAILABLE",
        category: ProblemCategory.InternalServerError,
      })
      @Roles("base")
      @UseGuards(BaseGuard)
      @UseInterceptors(BaseInterceptor)
      value(): string {
        return "base";
      }
    }

    @GraphQLResolver()
    class DerivedResolver extends BaseResolver {
      @GraphQLProblemResponse({
        code: "GRAPHQL_DERIVED_UNAVAILABLE",
        category: ProblemCategory.NotImplemented,
      })
      @Roles("derived")
      @UseGuards(DerivedGuard)
      @UseInterceptors(DerivedInterceptor)
      override value(): string {
        return "derived";
      }
    }

    @GraphQLResolver()
    class ContractSchemaResolver {
      @Query(() => String)
      contractSchema(): string {
        return "ok";
      }
    }

    const schema = await buildContractSchema([ContractSchemaResolver]);
    const baseSnapshot = createGraphQLContractSnapshot(schema, { resolvers: [BaseResolver] });
    const derivedSnapshot = createGraphQLContractSnapshot(schema, {
      resolvers: [DerivedResolver],
    });

    expect(baseSnapshot.resolvers[0]?.methods).toEqual([
      expect.objectContaining({
        methodName: "value",
        guards: ["BaseGuard"],
        interceptors: ["BaseInterceptor"],
        roles: ["base"],
        problems: [expect.objectContaining({ code: "GRAPHQL_BASE_UNAVAILABLE" })],
      }),
    ]);
    expect(derivedSnapshot.resolvers[0]?.methods).toEqual([
      expect.objectContaining({
        methodName: "value",
        guards: ["DerivedGuard"],
        interceptors: ["DerivedInterceptor"],
        roles: ["derived"],
        problems: [
          expect.objectContaining({ code: "GRAPHQL_BASE_UNAVAILABLE" }),
          expect.objectContaining({ code: "GRAPHQL_DERIVED_UNAVAILABLE" }),
        ],
      }),
    ]);
  });
});

async function buildContractSchema(resolvers: [ContractResolver, ...ContractResolver[]]) {
  const { buildSchema } = await import("type-graphql");

  return buildSchema({
    resolvers,
    validate: false,
  });
}
