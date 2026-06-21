import "reflect-metadata";
import { Container, MetadataStorage } from "@croco/framework-context";
import { Problem } from "@croco/problems-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GRAPHQL_GUARDS_KEY, GRAPHQL_ROLES_KEY, RESOLVERS_KEY } from "../libs/constants";
import { GraphQLResolver } from "../libs/decorators";
import { GraphQLAuthGuard } from "../libs/guards/AuthGuard";
import { GuardChain } from "../libs/guards/GuardChain";
import { GraphQLRolesGuard, type UserWithRoles } from "../libs/guards/RolesGuard";
import type { GraphQLGuardContext } from "../libs/types/GuardTypes";

const createMockContext = (overrides: Partial<GraphQLGuardContext> = {}): GraphQLGuardContext => ({
  root: {},
  args: {},
  context: {},
  info: {
    fieldName: "test",
    fieldNodes: [],
    returnType: {} as any,
    parentType: {} as any,
    path: { key: "test", typename: "Test" } as any,
    schema: {} as any,
    fragments: {},
    rootValue: {},
    operation: { kind: "OperationDefinition", operation: "query" } as any,
    variableValues: {},
  },
  ...overrides,
});

describe("GraphQLAuthGuard", () => {
  beforeEach(() => {
    MetadataStorage.clear();
  });

  it("should throw error when authorization header is missing", async () => {
    const guard = new GraphQLAuthGuard({
      verifier: (token) => ({ id: "1", token }),
    });

    const context = createMockContext({
      context: { headers: {} },
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(Problem);
    await expect(guard.canActivate(context)).rejects.toThrow("Missing authorization header");
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 401,
      code: "protocols-graphql/auth-missing-header",
    });
  });

  it("should throw error when request context headers are unavailable", async () => {
    const guard = new GraphQLAuthGuard({
      verifier: (token) => ({ id: "1", token }),
    });

    await expect(guard.canActivate(createMockContext())).rejects.toMatchObject({
      status: 400,
      code: "protocols-graphql/auth-invalid-request",
    });
  });

  it("should throw error when token format is invalid", async () => {
    const guard = new GraphQLAuthGuard({
      verifier: (token) => ({ id: "1", token }),
    });

    const context = createMockContext({
      context: { headers: { authorization: "InvalidFormat" } },
    });

    await expect(guard.canActivate(context)).rejects.toThrow("Invalid authorization header format");
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 400,
      code: "protocols-graphql/auth-invalid-header-format",
    });
  });

  it("should throw error when token verification fails", async () => {
    const tokenError = Object.assign(new Error("Token expired"), { name: "ERR_JWT_EXPIRED" });
    const guard = new GraphQLAuthGuard({
      verifier: vi.fn().mockRejectedValue(tokenError),
    });

    const context = createMockContext({
      context: { headers: { authorization: "Bearer invalid-token" } },
    });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 401,
      code: "protocols-graphql/auth-invalid-token",
    });
  });

  it("should surface verifier outages separately from invalid tokens", async () => {
    const guard = new GraphQLAuthGuard({
      verifier: vi.fn().mockRejectedValue(new Error("ECONNRESET")),
    });

    const context = createMockContext({
      context: { headers: { authorization: "Bearer service-token" } },
    });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 500,
      code: "protocols-graphql/auth-verifier-unavailable",
    });
  });

  it("should set user on context when token is valid", async () => {
    const mockUser = { id: "1", name: "Test User" };
    const guard = new GraphQLAuthGuard({
      verifier: () => mockUser,
    });

    const ctx: { headers: Record<string, string>; user?: unknown } = {
      headers: { authorization: "Bearer valid-token" },
    };

    const context = createMockContext({
      context: ctx,
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(ctx.user).toBe(mockUser);
  });
});

describe("GraphQLRolesGuard", () => {
  beforeEach(() => {
    MetadataStorage.clear();
  });

  it("should allow access when no roles are required", () => {
    const guard = new GraphQLRolesGuard();

    const resolver = {};
    const context = createMockContext({
      root: resolver,
      context: { user: { roles: ["admin"] } },
    });

    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it("should allow access when user has required role", () => {
    const guard = new GraphQLRolesGuard();

    class TestResolver {
      testMethod() {}
    }
    const resolver = new TestResolver();

    Reflect.defineMetadata(GRAPHQL_ROLES_KEY, ["admin"], TestResolver.prototype, "testMethod");

    const context = createMockContext({
      root: resolver,
      context: { user: { roles: ["admin", "user"] } as UserWithRoles },
      info: {
        fieldName: "testMethod",
        fieldNodes: [],
        returnType: {} as any,
        parentType: {} as any,
        path: { key: "testMethod", typename: "Test" } as any,
        schema: {} as any,
        fragments: {},
        rootValue: {},
        operation: { kind: "OperationDefinition", operation: "query" } as any,
        variableValues: {},
      },
    });

    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it("should deny access when user lacks required role", () => {
    const guard = new GraphQLRolesGuard();

    class TestResolver {
      testMethod() {}
    }
    const resolver = new TestResolver();

    Reflect.defineMetadata(GRAPHQL_ROLES_KEY, ["admin"], TestResolver.prototype, "testMethod");

    const context = createMockContext({
      root: resolver,
      context: { user: { roles: ["user"] } as UserWithRoles },
      info: {
        fieldName: "testMethod",
        fieldNodes: [],
        returnType: {} as any,
        parentType: {} as any,
        path: { key: "testMethod", typename: "Test" } as any,
        schema: {} as any,
        fragments: {},
        rootValue: {},
        operation: { kind: "OperationDefinition", operation: "query" } as any,
        variableValues: {},
      },
    });

    const result = guard.canActivate(context);
    expect(result).toBe(false);
  });
});

describe("GuardChain", () => {
  it("should return true when all guards pass", async () => {
    const guard1 = { canActivate: vi.fn().mockResolvedValue(true) };
    const guard2 = { canActivate: vi.fn().mockResolvedValue(true) };

    const chain = new GuardChain([guard1, guard2]);
    const context = createMockContext();

    const result = await chain.canActivate(context);

    expect(result).toBe(true);
    expect(guard1.canActivate).toHaveBeenCalledWith(context);
    expect(guard2.canActivate).toHaveBeenCalledWith(context);
  });

  it("should return false when any guard fails", async () => {
    const guard1 = { canActivate: vi.fn().mockResolvedValue(true) };
    const guard2 = { canActivate: vi.fn().mockResolvedValue(false) };
    const guard3 = { canActivate: vi.fn() };

    const chain = new GuardChain([guard1, guard2, guard3]);
    const context = createMockContext();

    const result = await chain.canActivate(context);

    expect(result).toBe(false);
    expect(guard1.canActivate).toHaveBeenCalledWith(context);
    expect(guard2.canActivate).toHaveBeenCalledWith(context);
    expect(guard3.canActivate).not.toHaveBeenCalled();
  });

  it("should execute static method", async () => {
    const guard = { canActivate: vi.fn().mockResolvedValue(true) };
    const context = createMockContext();

    const result = await GuardChain.execute([guard], context);

    expect(result).toBe(true);
  });
});
