import "reflect-metadata";
import type { AddressInfo } from "node:net";
import { Body, Controller, Get, Param, Post, Raw } from "@croco/protocols-rest";
import { createTRPCClient, httpBatchLink, type TRPCClientError } from "@trpc/client";
import type { AnyRouter } from "@trpc/server";
import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { createTrpcRouter } from "../libs/createTrpcRouter";

type User = {
  readonly id: string;
  readonly name: string;
};

type UserRouterClient = {
  readonly user: {
    readonly list: { query: () => Promise<User[]> };
    readonly getById: {
      query: (input: { readonly path: { readonly id: string } }) => Promise<User | undefined>;
    };
    readonly create: { mutate: (input: { readonly name: string }) => Promise<User> };
    readonly inspectRaw: {
      mutate: (input: { readonly name: string }) => Promise<{
        readonly input: { readonly name: string };
        readonly raw: TrpcContext;
      }>;
    };
  };
};

type TrpcContext = {
  readonly requestId: string;
  readonly source: "trpc";
};

const createUserSchema = z.object({ name: z.string().min(1) });
const trpcContext: TrpcContext = { requestId: "raw-request", source: "trpc" };

@Controller("/users")
class UserController {
  private readonly users: User[] = [
    { id: "1", name: "Alice" },
    { id: "2", name: "Bob" },
  ];

  @Get("/")
  list(): User[] {
    return this.users;
  }

  @Get("/:id")
  getById(@Param("id") id: string): User | undefined {
    return this.users.find((user) => user.id === id);
  }

  @Post("/")
  create(@Body(createUserSchema) data: z.infer<typeof createUserSchema>): User {
    const newUser = { id: String(this.users.length + 1), name: data.name };

    this.users.push(newUser);

    return newUser;
  }

  @Post("/raw")
  inspectRaw(
    @Raw() raw: TrpcContext,
    @Body(createUserSchema) input: z.infer<typeof createUserSchema>,
  ): { readonly input: z.infer<typeof createUserSchema>; readonly raw: TrpcContext } {
    return { input, raw };
  }
}

describe("tRPC round trip", () => {
  let server: ReturnType<typeof createHTTPServer>;
  let client: UserRouterClient;

  beforeAll(async () => {
    const router = createTrpcRouter([UserController]);

    server = createHTTPServer({ router, createContext: () => trpcContext });
    await new Promise<void>((resolve) => server.listen(0, resolve));

    client = createTRPCClient<typeof router>({
      links: [httpBatchLink({ url: `http://127.0.0.1:${getPort(server)}` })],
    }) as unknown as UserRouterClient;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  });

  it("should return data from a GET query", async () => {
    await expect(client.user.list.query()).resolves.toEqual([
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ]);
  });

  it("should create data through a POST mutation", async () => {
    await expect(client.user.create.mutate({ name: "Carol" })).resolves.toEqual({
      id: "3",
      name: "Carol",
    });
  });

  it("should resolve raw parameters to the tRPC procedure context without shifting body arguments", async () => {
    await expect(client.user.inspectRaw.mutate({ name: "Raw" })).resolves.toEqual({
      input: { name: "Raw" },
      raw: trpcContext,
    });
  });

  it("should resolve path parameters through the tRPC input envelope", async () => {
    await expect(client.user.getById.query({ path: { id: "1" } })).resolves.toEqual({
      id: "1",
      name: "Alice",
    });
  });

  it("should reject invalid input with BAD_REQUEST", async () => {
    await expect(client.user.create.mutate({ name: "" })).rejects.toMatchObject({
      data: expect.objectContaining({ code: "BAD_REQUEST" }),
    } satisfies Partial<TRPCClientError<AnyRouter>>);
  });

  it("should report both decorator locations for duplicate procedures", () => {
    const ExistingUserController = createExistingUserController();
    const ConflictingUserController = createConflictingUserController();
    Object.defineProperty(ExistingUserController, "name", { value: "UserController" });
    Object.defineProperty(ConflictingUserController, "name", { value: "UserController" });
    let thrown: unknown;

    try {
      createTrpcRouter([ExistingUserController, ConflictingUserController]);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeDefined();
    const problem = (thrown as { readonly toJSON: () => Record<string, unknown> }).toJSON();

    expect(problem).toMatchObject({
      code: "protocols-trpc/duplicate-procedure-name",
      domain: "user",
      procedureName: "listUsers",
      existingRoute: {
        controllerName: "UserController",
        methodName: "listUsers",
        path: "/existing-users",
        sourceLocation: {
          path: expect.stringContaining("round-trip.spec.ts"),
          line: expect.any(Number),
          column: expect.any(Number),
        },
      },
      conflictingRoute: {
        controllerName: "UserController",
        methodName: "listUsers",
        path: "/conflicting-users",
        sourceLocation: {
          path: expect.stringContaining("round-trip.spec.ts"),
          line: expect.any(Number),
          column: expect.any(Number),
        },
      },
    });
  });
});

function createExistingUserController(): Function {
  @Controller("/existing-users")
  class UserController {
    @Get()
    listUsers(): string[] {
      return [];
    }
  }

  return UserController;
}

function createConflictingUserController(): Function {
  @Controller("/conflicting-users")
  class UserController {
    @Get()
    listUsers(): string[] {
      return [];
    }
  }

  return UserController;
}

function getPort(server: ReturnType<typeof createHTTPServer>): number {
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new TypeError("tRPC test server address is not available");
  }

  return (address as AddressInfo).port;
}
