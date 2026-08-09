import "reflect-metadata";
import { ServerResponse } from "node:http";
import { connect } from "node:net";
import { Container } from "@croco/framework-context";
import { Logger } from "@croco/framework-logger";
import { Problem, ProblemCategory } from "@croco/problems-core";
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
import type {
  GraphQLGuard,
  GraphQLInterceptor,
  GraphQLInterceptorContext,
} from "@croco/protocols-graphql";
import { GraphQLError } from "graphql";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GraphQLServer } from "../libs/GraphQLServer";
import { SchemaCompiler } from "../libs/SchemaCompiler";
import {
  GraphQLResolversNotConfiguredProblem,
  GraphQLSchemaNotConfiguredProblem,
  GraphQLServerNotInitializedProblem,
} from "../libs/problems/GraphQLTransportProblems";

@ObjectType()
class User {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  email!: string;
}

@Resolver(() => User)
class UserResolver {
  private readonly userList = [
    { id: "1", name: "Alice", email: "alice@example.com" },
    { id: "2", name: "Bob", email: "bob@example.com" },
  ];

  @Query(() => [User])
  async getUsers(): Promise<User[]> {
    return this.userList;
  }

  @Query(() => String)
  async hello(): Promise<string> {
    return "Hello, GraphQL!";
  }
}

class TestGraphQLProblem extends Problem {
  constructor(
    code: string,
    category: ProblemCategory,
    detail: string,
    extensions?: Record<string, unknown>,
  ) {
    super(code, category, detail, { extensions });
  }
}

@Resolver()
class ProblemResolver {
  @Query(() => String)
  publicProblem(): string {
    throw new TestGraphQLProblem(
      "GRAPHQL_INPUT_INVALID",
      ProblemCategory.ValidationError,
      "Email is invalid",
      {
        field: "email",
        requestId: "request-secret",
        traceId: "trace-secret",
        diagnostics: "provider-secret",
      },
    );
  }

  @Query(() => String)
  safeMessageProblem(): string {
    throw new TestGraphQLProblem(
      "ACCESS_DENIED",
      ProblemCategory.Forbidden,
      "You cannot access this tenant",
      {
        reason: "tenant mismatch",
        providerSecret: "secret",
      },
    );
  }

  @Query(() => String)
  operatorOnlyProblem(): string {
    throw new TestGraphQLProblem(
      "transports-graphql/schema-not-configured",
      ProblemCategory.InternalServerError,
      "Database password is invalid",
      {
        reason: "database password is invalid",
      },
    );
  }

  @Query(() => String)
  unknownProblem(): string {
    throw new TestGraphQLProblem(
      "example/user-not-found",
      ProblemCategory.NotFound,
      "User 123 was not found",
      {
        reason: "deleted",
        diagnostics: "store:primary",
      },
    );
  }

  @Query(() => String)
  wrappedProblem(): string {
    throw new GraphQLError("Wrapped provider secret", {
      originalError: new TestGraphQLProblem(
        "GRAPHQL_INPUT_INVALID",
        ProblemCategory.ValidationError,
        "Wrapped email is invalid",
        {
          field: "email",
          diagnostics: "provider-secret",
        },
      ),
    });
  }

  @Query(() => String)
  unhandledProblem(): string {
    throw Object.assign(new Error("Unhandled provider secret"), {
      code: "ACCESS_DENIED",
      category: ProblemCategory.Forbidden,
    });
  }
}

const policyEvents: string[] = [];

class HeaderGuard implements GraphQLGuard {
  constructor(private readonly requiredAuthorization: string) {}

  canActivate(context: GraphQLInterceptorContext): boolean {
    policyEvents.push("guard");
    const headers = context.context.headers as Record<string, string> | undefined;
    return headers?.authorization === this.requiredAuthorization;
  }
}

class FirstPolicyInterceptor implements GraphQLInterceptor {
  async intercept(
    _context: GraphQLInterceptorContext,
    next: { handle(): Promise<unknown> },
  ): Promise<unknown> {
    policyEvents.push("first:before");
    const result = await next.handle();
    policyEvents.push("first:after");
    return result;
  }
}

class SecondPolicyInterceptor implements GraphQLInterceptor {
  async intercept(
    _context: GraphQLInterceptorContext,
    next: { handle(): Promise<unknown> },
  ): Promise<unknown> {
    policyEvents.push("second:before");
    const result = await next.handle();
    policyEvents.push("second:after");
    return result;
  }
}

@Resolver()
class PolicyResolver {
  @Query(() => String)
  @Roles("admin")
  @UseGuards(HeaderGuard)
  @UseInterceptors(FirstPolicyInterceptor, SecondPolicyInterceptor)
  protectedValue(): string {
    policyEvents.push("resolver");
    return "authorized";
  }
}

@ObjectType()
class PolicyPerson {
  @Field(() => String)
  id!: string;
}

@ObjectType()
class PolicyOrganization {
  @Field(() => String)
  id!: string;
}

class AllowFieldGuard implements GraphQLGuard {
  canActivate(): boolean {
    return true;
  }
}

class DenyFieldGuard implements GraphQLGuard {
  canActivate(): boolean {
    return false;
  }
}

class AllowSubscriptionGuard implements GraphQLGuard {
  canActivate(): boolean {
    return true;
  }
}

@Resolver()
class PolicyFieldQueryResolver {
  @Query(() => PolicyPerson)
  person(): PolicyPerson {
    return { id: "person" };
  }

  @Query(() => PolicyOrganization, { nullable: true })
  organization(): PolicyOrganization {
    return { id: "organization" };
  }
}

@Resolver(() => PolicyPerson)
class PolicyPersonFieldResolver {
  @FieldResolver(() => String)
  @UseGuards(AllowFieldGuard)
  id(): string {
    return "person";
  }
}

@Resolver(() => PolicyOrganization)
class PolicyOrganizationFieldResolver {
  @FieldResolver(() => String)
  @UseGuards(DenyFieldGuard)
  id(): string {
    return "organization";
  }
}

@Resolver()
class PolicySubscriptionResolver {
  @Query(() => String)
  policyHealth(): string {
    return "ok";
  }

  @Subscription(() => String, { topics: "policy-update" })
  @UseGuards(AllowSubscriptionGuard)
  @Roles("admin")
  policyUpdate(): string {
    return "authorized";
  }
}

describe("GraphQLServer integration", () => {
  const server = new GraphQLServer({
    schemaOptions: {
      resolvers: [UserResolver],
      autoDiscover: false,
    },
  });

  beforeAll(async () => {
    Container.reset();
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("should compile schema successfully", () => {
    expect(server).not.toBeNull();
  });

  it("should execute hello query", async () => {
    const handler = server.getHandler();
    const request = new Request("http://localhost/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          query {
            hello
          }
        `,
      }),
    });

    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.errors).toBeUndefined();
    expect(data.data.hello).toBe("Hello, GraphQL!");
  });

  it("should execute users query returning array", async () => {
    const handler = server.getHandler();
    const request = new Request("http://localhost/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          query {
            getUsers {
              id
              name
              email
            }
          }
        `,
      }),
    });

    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.errors).toBeUndefined();
    expect(Array.isArray(data.data.getUsers)).toBe(true);
    expect(data.data.getUsers.length).toBe(2);
    expect(data.data.getUsers[0].name).toBe("Alice");
    expect(data.data.getUsers[1].name).toBe("Bob");
  });

  it("should execute user query with arguments", async () => {
    const handler = server.getHandler();
    const request = new Request("http://localhost/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          query {
            getUsers {
              id
              name
              email
            }
          }
        `,
      }),
    });

    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.errors).toBeUndefined();
    expect(Array.isArray(data.data.getUsers)).toBe(true);
    expect(data.data.getUsers[0].id).toBe("1");
  });

  it("should handle invalid query gracefully", async () => {
    const handler = server.getHandler();
    const request = new Request("http://localhost/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          query {
            nonExistentField
          }
        `,
      }),
    });

    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.errors).not.toBeNull();
    expect(Array.isArray(data.errors)).toBe(true);
  });

  it("should start and stop server", async () => {
    const testServer = new GraphQLServer({
      schemaOptions: {
        resolvers: [UserResolver],
        autoDiscover: false,
      },
    });

    await testServer.initialize();
    await testServer.start(4001);

    const handler = testServer.getHandler();
    expect(typeof handler).toBe("function");

    await testServer.stop();
  });

  it("should preserve every Set-Cookie response header", async () => {
    const testServer = new GraphQLServer({
      schemaOptions: {
        resolvers: [UserResolver],
        autoDiscover: false,
      },
    });

    await testServer.initialize();

    const headers = new Headers({ "x-test-header": "preserved" });
    headers.append("set-cookie", "session=session-token; HttpOnly; Path=/");
    headers.append("set-cookie", "csrf=csrf-token; SameSite=Strict; Path=/");
    Reflect.set(testServer, "yogaHandler", async () => new Response("ok", { headers }));

    await testServer.start(4003);

    try {
      const response = await fetch("http://localhost:4003/graphql");

      expect(response.headers.getSetCookie()).toEqual([
        "session=session-token; HttpOnly; Path=/",
        "csrf=csrf-token; SameSite=Strict; Path=/",
      ]);
      expect(response.headers.get("x-test-header")).toBe("preserved");
    } finally {
      await testServer.stop();
    }
  });

  it("should throw a typed problem when no schema is configured", async () => {
    const testServer = new GraphQLServer();

    await expect(testServer.initialize()).rejects.toBeInstanceOf(GraphQLSchemaNotConfiguredProblem);
  });

  it("should throw a typed problem when handler is requested before initialize", () => {
    const testServer = new GraphQLServer();

    expect(() => testServer.getHandler()).toThrow(GraphQLServerNotInitializedProblem);
  });

  it("should throw a typed problem when schema compilation has no resolvers", async () => {
    const testServer = new GraphQLServer({
      schemaOptions: {
        autoDiscover: false,
      },
    });

    await expect(testServer.initialize()).rejects.toBeInstanceOf(
      GraphQLResolversNotConfiguredProblem,
    );
  });

  it("should reject oversized request bodies with 413", async () => {
    const testServer = new GraphQLServer({
      schemaOptions: {
        resolvers: [UserResolver],
        autoDiscover: false,
      },
      maxBodySizeBytes: 32,
    });

    await testServer.initialize();
    await testServer.start(4002);

    const response = await fetch("http://localhost:4002/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "{ hello }",
        padding: "x".repeat(128),
      }),
    });

    expect(response.status).toBe(413);
    expect(response.headers.get("content-type")).toContain("application/problem+json");

    const problem = (await response.json()) as { code: string; detail: string; title: string };

    expect(problem.code).toBe("transports-graphql/request-body-too-large");
    expect(problem.title).toBe("Payload Too Large");
    expect(problem.detail).toContain("Payload Too Large");

    await testServer.stop();
  });

  it("should convert malformed Node requests into a complete redacted response", async () => {
    const logger = { error: vi.fn() };
    Container.set(Logger, logger as unknown as Logger);
    const testServer = new GraphQLServer({
      schemaOptions: {
        resolvers: [UserResolver],
        autoDiscover: false,
      },
    });

    await testServer.start(4004);

    try {
      const response = await sendRawHttpRequest(
        4004,
        "GET /graphql HTTP/1.1\r\nHost: [\r\nConnection: close\r\n\r\n",
      );

      expect(response).toContain("HTTP/1.1 500 Internal Server Error");
      expect(response).toContain("application/problem+json");
      expect(response).toContain('"code":"transports-graphql/request-handling-failed"');
      expect(logger.error).toHaveBeenCalledWith("GraphQL request failed", {
        phase: "request-url",
        problemCode: "transports-graphql/request-handling-failed",
      });
    } finally {
      await testServer.stop();
      Container.reset();
    }
  });

  it("should preserve safe Problem details when Yoga rejects", async () => {
    const logger = { error: vi.fn() };
    Container.set(Logger, logger as unknown as Logger);
    const testServer = new GraphQLServer({
      schemaOptions: {
        resolvers: [UserResolver],
        autoDiscover: false,
      },
    });

    await testServer.initialize();
    Reflect.set(testServer, "yogaHandler", async () => {
      throw new TestGraphQLProblem(
        "ACCESS_DENIED",
        ProblemCategory.Forbidden,
        "You cannot access this tenant",
        { reason: "tenant mismatch", providerSecret: "secret" },
      );
    });
    await testServer.start(4005);

    try {
      const response = await fetch("http://localhost:4005/graphql");
      const problem = (await response.json()) as Record<string, unknown>;

      expect(response.status).toBe(403);
      expect(problem).toMatchObject({
        code: "ACCESS_DENIED",
        detail: "You cannot access this tenant",
        reason: "tenant mismatch",
        status: 403,
      });
      expect(problem).not.toHaveProperty("providerSecret");
      expect(logger.error).toHaveBeenCalledWith("GraphQL request failed", {
        phase: "yoga-execution",
        problemCode: "ACCESS_DENIED",
      });
    } finally {
      await testServer.stop();
      Container.reset();
    }
  });

  it("should replace Yoga rejections with one stable internal failure", async () => {
    const logger = { error: vi.fn() };
    Container.set(Logger, logger as unknown as Logger);
    const testServer = new GraphQLServer({
      schemaOptions: {
        resolvers: [UserResolver],
        autoDiscover: false,
      },
    });

    await testServer.initialize();
    Reflect.set(testServer, "yogaHandler", async () => {
      throw new Error("provider credential leaked");
    });
    await testServer.start(4006);

    try {
      const response = await fetch("http://localhost:4006/graphql");
      const responseBody = await response.text();

      expect(response.status).toBe(500);
      expect(JSON.parse(responseBody)).toEqual({
        type: "about:blank",
        title: "Internal Server Error",
        status: 500,
        code: "transports-graphql/request-handling-failed",
        detail: "An internal error occurred",
      });
      expect(responseBody).not.toContain("provider credential leaked");
      expect(logger.error).toHaveBeenCalledWith("GraphQL request failed", {
        phase: "yoga-execution",
        problemCode: "transports-graphql/request-handling-failed",
      });
    } finally {
      await testServer.stop();
      Container.reset();
    }
  });

  it("should replace response streaming failures without stale response headers", async () => {
    const logger = { error: vi.fn() };
    Container.set(Logger, logger as unknown as Logger);
    const testServer = new GraphQLServer({
      schemaOptions: {
        resolvers: [UserResolver],
        autoDiscover: false,
      },
    });

    await testServer.initialize();
    const yogaResponse = new Response("unused", {
      headers: {
        "content-length": "999",
        "set-cookie": "session=should-not-be-sent",
        "x-yoga-response": "should-not-be-sent",
      },
    });
    Reflect.set(yogaResponse, "text", async () => {
      throw new Error("stream provider secret");
    });
    Reflect.set(testServer, "yogaHandler", async () => yogaResponse);
    await testServer.start(4007);

    try {
      const response = await fetch("http://localhost:4007/graphql");
      const responseBody = await response.text();

      expect(response.status).toBe(500);
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(response.headers.get("x-yoga-response")).toBeNull();
      expect(responseBody).not.toContain("stream provider secret");
      expect(JSON.parse(responseBody)).toMatchObject({
        code: "transports-graphql/request-handling-failed",
        status: 500,
      });
      expect(logger.error).toHaveBeenCalledWith("GraphQL request failed", {
        phase: "response-body",
        problemCode: "transports-graphql/request-handling-failed",
      });
    } finally {
      await testServer.stop();
      Container.reset();
    }
  });

  it("should destroy a committed response after an asynchronous write failure", async () => {
    const logger = { error: vi.fn() };
    Container.set(Logger, logger as unknown as Logger);
    const destroySpy = vi.spyOn(ServerResponse.prototype, "destroy");
    const endSpy = vi
      .spyOn(ServerResponse.prototype, "end")
      .mockImplementationOnce(function (this: ServerResponse) {
        this.flushHeaders();
        Object.defineProperties(this, {
          writableEnded: { configurable: true, value: true },
          writableFinished: { configurable: true, value: false },
        });
        setImmediate(() => this.emit("error", new Error("socket write provider secret")));
        return this;
      });
    const testServer = new GraphQLServer({
      schemaOptions: {
        resolvers: [UserResolver],
        autoDiscover: false,
      },
    });

    await testServer.start(4008);

    try {
      await expect(
        fetch("http://localhost:4008/graphql").then((response) => response.text()),
      ).rejects.toThrow();
      await vi.waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith("GraphQL request failed", {
          phase: "response-write",
          problemCode: "transports-graphql/request-handling-failed",
        });
        expect(destroySpy).toHaveBeenCalled();
      });
    } finally {
      endSpy.mockRestore();
      destroySpy.mockRestore();
      await testServer.stop();
      Container.reset();
    }
  });

  describe("Problem masking", () => {
    const problemServer = new GraphQLServer({
      schemaOptions: {
        resolvers: [ProblemResolver],
        autoDiscover: false,
      },
    });

    beforeAll(async () => {
      await problemServer.initialize();
    });

    afterAll(async () => {
      await problemServer.stop();
    });

    it("should redact public resolver Problems", async () => {
      const { response, data } = await executeQuery(problemServer, "{ publicProblem }");

      expect(response.status).toBe(200);
      expect(data.errors[0].message).toBe("Email is invalid");
      expect(data.errors[0].extensions).toMatchObject({
        code: "GRAPHQL_INPUT_INVALID",
        status: 422,
        title: "Validation Error",
        field: "email",
      });
      expect(data.errors[0].extensions).not.toHaveProperty("requestId");
      expect(data.errors[0].extensions).not.toHaveProperty("traceId");
      expect(data.errors[0].extensions).not.toHaveProperty("diagnostics");
      expect(data.errors[0].extensions).not.toHaveProperty("redactionPolicy");
      expect(JSON.stringify(data.errors[0])).not.toContain("request-secret");
      expect(JSON.stringify(data.errors[0])).not.toContain("trace-secret");
      expect(JSON.stringify(data.errors[0])).not.toContain("provider-secret");
    });

    it("should retain safe-message resolver Problems", async () => {
      const { data } = await executeQuery(problemServer, "{ safeMessageProblem }");

      expect(data.errors[0].message).toBe("You cannot access this tenant");
      expect(data.errors[0].extensions).toMatchObject({
        code: "ACCESS_DENIED",
        status: 403,
        reason: "tenant mismatch",
      });
      expect(data.errors[0].extensions).not.toHaveProperty("providerSecret");
    });

    it("should redact operator-only resolver Problems", async () => {
      const { data } = await executeQuery(problemServer, "{ operatorOnlyProblem }");

      expect(data.errors[0].message).toBe("An internal error occurred");
      expect(data.errors[0].extensions).toEqual({
        code: "transports-graphql/schema-not-configured",
        status: 500,
        title: "Internal Server Error",
        type: "about:blank",
      });
    });

    it("should use category fallback for unknown resolver Problem codes", async () => {
      const { data } = await executeQuery(problemServer, "{ unknownProblem }");

      expect(data.errors[0].message).toBe("User 123 was not found");
      expect(data.errors[0].extensions).toMatchObject({
        code: "example/user-not-found",
        status: 404,
        reason: "deleted",
      });
      expect(data.errors[0].extensions).not.toHaveProperty("diagnostics");
    });

    it("should redact wrapped Problems and preserve their GraphQL path", async () => {
      const { data } = await executeQuery(problemServer, "{ wrappedProblem }");

      expect(data.errors[0].message).toBe("Wrapped email is invalid");
      expect(data.errors[0].path).toEqual(["wrappedProblem"]);
      expect(data.errors[0].extensions).toMatchObject({
        code: "GRAPHQL_INPUT_INVALID",
        field: "email",
      });
      expect(data.errors[0].extensions).not.toHaveProperty("diagnostics");
    });

    it("should keep Yoga masking for non-Problem errors", async () => {
      const { data } = await executeQuery(problemServer, "{ unhandledProblem }");

      expect(data.errors[0].message).toBe("Unexpected error.");
      expect(data.errors[0].message).not.toContain("provider secret");
    });

    it("should redact Problems thrown while creating context", async () => {
      const contextServer = new GraphQLServer({
        schemaOptions: {
          resolvers: [ProblemResolver],
          autoDiscover: false,
        },
        context: () => {
          throw new TestGraphQLProblem(
            "transports-graphql/schema-not-configured",
            ProblemCategory.InternalServerError,
            "Context provider secret",
            { diagnostics: "context-secret" },
          );
        },
      });

      await contextServer.initialize();

      try {
        const { data } = await executeQuery(contextServer, "{ publicProblem }");

        expect(data.errors[0].message).toBe("An internal error occurred");
        expect(data.errors[0].extensions).toEqual({
          code: "transports-graphql/schema-not-configured",
          status: 500,
          title: "Internal Server Error",
          type: "about:blank",
        });
        expect(JSON.stringify(data.errors[0])).not.toContain("context-secret");
      } finally {
        await contextServer.stop();
      }
    });

    it("should redact every Croco Problem before Yoga logs it", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const contextServer = new GraphQLServer({
        schemaOptions: {
          resolvers: [ProblemResolver],
          autoDiscover: false,
        },
        context: () => {
          throw new TestGraphQLProblem(
            "transports-graphql/schema-not-configured",
            ProblemCategory.InternalServerError,
            "Context provider secret",
            { diagnostics: "context-secret" },
          );
        },
      });

      await contextServer.initialize();

      try {
        await executeQuery(problemServer, "{ publicProblem }");
        await executeQuery(problemServer, "{ safeMessageProblem }");
        await executeQuery(problemServer, "{ operatorOnlyProblem }");
        await executeQuery(problemServer, "{ unknownProblem }");
        await executeQuery(problemServer, "{ wrappedProblem }");
        await executeQuery(contextServer, "{ publicProblem }");

        const loggedErrors = errorSpy.mock.calls
          .flat()
          .map((value) =>
            value instanceof GraphQLError
              ? JSON.stringify({
                  extensions: value.extensions,
                  message: value.message,
                  name: value.name,
                })
              : String(value),
          )
          .join("\n");

        expect(loggedErrors).toContain("An internal error occurred");
        for (const secret of [
          "request-secret",
          "trace-secret",
          "provider-secret",
          "providerSecret",
          "Database password is invalid",
          "database password is invalid",
          "store:primary",
          "Wrapped provider secret",
          "Context provider secret",
          "context-secret",
        ]) {
          expect(loggedErrors).not.toContain(secret);
        }
      } finally {
        await contextServer.stop();
        errorSpy.mockRestore();
      }
    });

    it("should preserve configured Yoga plugins", async () => {
      let pluginExecuted = false;
      const pluginServer = new GraphQLServer({
        schemaOptions: {
          resolvers: [ProblemResolver],
          autoDiscover: false,
        },
        plugins: [
          {
            onExecute() {
              pluginExecuted = true;
            },
          },
        ],
      });

      await pluginServer.initialize();

      try {
        await executeQuery(pluginServer, "{ publicProblem }");
        expect(pluginExecuted).toBe(true);
      } finally {
        await pluginServer.stop();
      }
    });
  });

  describe("Declared policy execution", () => {
    beforeEach(() => {
      Container.reset();
      policyEvents.length = 0;
      Container.set(HeaderGuard, new HeaderGuard("Bearer admin"));
      Container.set(FirstPolicyInterceptor, new FirstPolicyInterceptor());
      Container.set(SecondPolicyInterceptor, new SecondPolicyInterceptor());
      Container.set(AllowFieldGuard, new AllowFieldGuard());
      Container.set(DenyFieldGuard, new DenyFieldGuard());
      Container.set(AllowSubscriptionGuard, new AllowSubscriptionGuard());
    });

    afterEach(() => {
      Container.reset();
    });

    it("should execute declared guards, roles, and interceptors in order", async () => {
      const policyServer = new GraphQLServer({
        schemaOptions: {
          resolvers: [PolicyResolver],
          autoDiscover: false,
        },
        context: () => ({ user: { roles: ["admin"] } }),
      });

      await policyServer.initialize();

      try {
        const { data } = await executeQuery(policyServer, "{ protectedValue }", {
          authorization: "Bearer admin",
        });

        expect(data.errors).toBeUndefined();
        expect(data.data.protectedValue).toBe("authorized");
        expect(policyEvents).toEqual([
          "guard",
          "first:before",
          "second:before",
          "resolver",
          "second:after",
          "first:after",
        ]);
      } finally {
        await policyServer.stop();
      }
    });

    it("should preserve Croco Problem semantics when a declared guard denies access", async () => {
      const policyServer = new GraphQLServer({
        schemaOptions: {
          resolvers: [PolicyResolver],
          autoDiscover: false,
        },
        context: () => ({ user: { roles: ["admin"] } }),
      });

      await policyServer.initialize();

      try {
        const { data } = await executeQuery(policyServer, "{ protectedValue }");

        expect(data.data).toBeNull();
        expect(data.errors[0]).toMatchObject({
          message: "Access denied by guard",
          extensions: {
            code: "protocols-graphql/guard-denied",
            status: 403,
          },
        });
        expect(policyEvents).toEqual(["guard"]);
      } finally {
        await policyServer.stop();
      }
    });

    it("should deny access when declared roles do not match the request context", async () => {
      const policyServer = new GraphQLServer({
        schemaOptions: {
          resolvers: [PolicyResolver],
          autoDiscover: false,
        },
        context: () => ({ user: { roles: ["member"] } }),
      });

      await policyServer.initialize();

      try {
        const { data } = await executeQuery(policyServer, "{ protectedValue }", {
          authorization: "Bearer admin",
        });

        expect(data.data).toBeNull();
        expect(data.errors[0]).toMatchObject({
          message: "Access denied by guard",
          extensions: {
            code: "protocols-graphql/guard-denied",
            status: 403,
          },
        });
        expect(policyEvents).toEqual(["guard"]);
      } finally {
        await policyServer.stop();
      }
    });

    it("should match field-resolver policies to their parent GraphQL type", async () => {
      const policyServer = new GraphQLServer({
        schemaOptions: {
          resolvers: [
            PolicyFieldQueryResolver,
            PolicyPersonFieldResolver,
            PolicyOrganizationFieldResolver,
          ],
          autoDiscover: false,
        },
      });

      await policyServer.initialize();

      try {
        const { data } = await executeQuery(policyServer, "{ person { id } organization { id } }");

        expect(data.data).toEqual({ person: { id: "person" }, organization: null });
        expect(data.errors[0]).toMatchObject({
          path: ["organization", "id"],
          extensions: {
            code: "protocols-graphql/guard-denied",
            status: 403,
          },
        });
      } finally {
        await policyServer.stop();
      }
    });

    it("should enforce declared policy before a subscription acquires an iterator", async () => {
      let subscribeCalls = 0;
      const schema = await SchemaCompiler.compileSchema({
        resolvers: [PolicySubscriptionResolver],
        autoDiscover: false,
        pubSub: {
          publish: async () => undefined,
          subscribe: () => {
            subscribeCalls++;
            return {
              [Symbol.asyncIterator](): AsyncIterator<unknown> {
                return {
                  next: async () => new Promise<IteratorResult<unknown>>(() => undefined),
                };
              },
            };
          },
        },
      });

      const subscription = schema.getSubscriptionType()?.getFields()["policyUpdate"]?.subscribe;
      expect(subscription).toBeDefined();

      await expect(
        subscription?.(undefined, {}, { user: { roles: ["member"] } }, undefined as never),
      ).rejects.toMatchObject({
        code: "protocols-graphql/guard-denied",
        status: 403,
      });
      expect(subscribeCalls).toBe(0);
    });
  });
});

async function executeQuery(
  server: GraphQLServer,
  query: string,
  headers: Record<string, string> = {},
) {
  const response = await server.getHandler()(
    new Request("http://localhost/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ query }),
    }),
  );

  return {
    response,
    data: await response.json(),
  };
}

function sendRawHttpRequest(port: number, request: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = connect(port, "127.0.0.1", () => {
      socket.end(request);
    });
    let response = "";

    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      response += chunk;
    });
    socket.on("end", () => resolve(response));
    socket.on("error", reject);
  });
}
