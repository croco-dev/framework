import "reflect-metadata";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { Container } from "@croco/framework-context";
import { Logger } from "@croco/framework-logger";
import { Problem, ProblemCategory } from "@croco/problems-core";
import { assertContractGraphHasNoErrors, buildContractGraph } from "@croco/protocols-core";
import {
  Body,
  Controller,
  Get,
  Header,
  HttpMethod,
  Param,
  Post,
  ProblemResponses,
  Query,
  type RouteBody,
  type RouteMethodReturn,
  type RouteParam,
  type RouteQueryParam,
  defineRouteContract,
  defineRouteProblem,
  routeProblemResponses,
} from "@croco/protocols-rest";
import {
  createApp,
  ErrorHandler,
  HealthCheckRegistry,
  type CrocoApp,
} from "@croco/transports-http";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { generateClientFilesFromContractGraph } from "../libs/generate";

const outDir = path.join(os.tmpdir(), "croco-rpc-codegen-real-app-e2e");
const moduleDir = path.join(os.tmpdir(), "croco-rpc-codegen-real-app-e2e-modules");
const requestIdSchema = z.string().min(1);

class UserNotFoundProblem extends Problem {
  readonly code = "USER_NOT_FOUND";
  readonly category = ProblemCategory.NotFound;

  constructor(id: string) {
    super(undefined, undefined, `User '${id}' was not found.`);
  }
}

const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  includeProfile: z.boolean(),
  requestId: z.string(),
});

const createdUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  requestId: z.string(),
});

const getUserContract = defineRouteContract({
  id: "real-app.users.get",
  method: HttpMethod.GET,
  path: "/users/:id",
  operationId: "getUser",
  params: z.object({ id: z.string() }),
  query: z.object({
    includeProfile: z.coerce.boolean().optional(),
    tag: z.string().optional(),
  }),
  response: userSchema,
  problems: [
    defineRouteProblem(UserNotFoundProblem, {
      code: "USER_NOT_FOUND",
      category: ProblemCategory.NotFound,
    }),
  ],
});

const createUserContract = defineRouteContract({
  id: "real-app.users.create",
  method: HttpMethod.POST,
  path: "/users",
  operationId: "createUser",
  body: z.object({ name: z.string().min(1) }),
  response: createdUserSchema,
});

type RecordedRequest = {
  readonly url: string;
  readonly init: {
    readonly method?: string;
    readonly headers?: Record<string, string>;
    readonly body?: BodyInit | null;
  };
};

type GeneratedUsersModule = {
  readonly usersClient: {
    readonly getUser: (
      input: {
        readonly path: { readonly id: string };
        readonly query?: { readonly includeProfile?: boolean; readonly tag?: string };
        readonly headers: { readonly "x-request-id": string };
      },
      options?: unknown,
    ) => Promise<unknown>;
    readonly getUserResult: (
      input: {
        readonly path: { readonly id: string };
        readonly query?: { readonly includeProfile?: boolean; readonly tag?: string };
        readonly headers: { readonly "x-request-id": string };
      },
      options?: unknown,
    ) => Promise<
      | {
          readonly ok: true;
          readonly data: unknown;
          readonly response: Response;
        }
      | {
          readonly ok: false;
          readonly kind: "problem";
          readonly code: string;
          readonly category: string;
          readonly status: number;
          readonly problem: unknown;
          readonly declaration: unknown;
          readonly response: Response;
        }
      | {
          readonly ok: false;
          readonly kind: "external";
          readonly error: { readonly name: string };
          readonly response: Response;
          readonly body?: unknown;
        }
    >;
    readonly createUser: (
      input: {
        readonly body: { readonly name: string };
        readonly headers: { readonly "x-request-id": string };
      },
      options?: unknown,
    ) => Promise<unknown>;
  };
};

@Controller("")
class UsersController {
  @Get(getUserContract)
  @ProblemResponses(...routeProblemResponses(getUserContract))
  getUser(
    @Param(getUserContract, "id") id: RouteParam<typeof getUserContract, "id">,
    @Query(getUserContract, "includeProfile")
    includeProfile: RouteQueryParam<typeof getUserContract, "includeProfile">,
    @Query(getUserContract, "tag") tag: RouteQueryParam<typeof getUserContract, "tag">,
    @Header("x-request-id", requestIdSchema) requestId: string,
  ): RouteMethodReturn<typeof getUserContract> {
    if (id === "missing") {
      throw new UserNotFoundProblem(id);
    }

    return {
      id,
      name: tag ?? "Ada",
      includeProfile: includeProfile ?? false,
      requestId,
    };
  }

  @Post(createUserContract)
  createUser(
    @Body(createUserContract) body: RouteBody<typeof createUserContract>,
    @Header("x-request-id", requestIdSchema) requestId: string,
  ): RouteMethodReturn<typeof createUserContract> {
    return {
      id: `user_${body.name.toLowerCase()}`,
      name: body.name,
      requestId,
    };
  }
}

describe("rpc-codegen real app e2e", () => {
  let app!: CrocoApp;
  let requests!: RecordedRequest[];

  beforeEach(() => {
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.rmSync(moduleDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    fs.mkdirSync(moduleDir, { recursive: true });

    Container.reset();
    const logger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      fatal: vi.fn(),
      child: () => logger,
    } as unknown as Logger;
    Container.set(Logger, logger);
    Container.set(ErrorHandler, new ErrorHandler(logger));
    Container.set(HealthCheckRegistry, new HealthCheckRegistry());

    requests = [];
    app = createApp({ controllers: [UsersController], securityValidation: "off" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.rmSync(moduleDir, { recursive: true, force: true });
  });

  it("runs the generated RPC client against a real Croco HTTP app", async () => {
    const graph = buildContractGraph([UsersController], { strictSchemas: true });
    expect(graph.diagnostics).toEqual([]);
    assertContractGraphHasNoErrors(graph);

    const files = generateClientFilesFromContractGraph(graph, outDir);
    const usersFile = files.find((file) => path.basename(file) === "users.ts");
    if (!usersFile) {
      throw new Error("Expected generated users.ts client file.");
    }
    expect(fs.readdirSync(outDir).sort()).toEqual([
      ".croco-rpc-codegen.json",
      "index.ts",
      "rpc.ts",
      "users.ts",
    ]);

    const usersModule = await importGeneratedUsersClient(
      "users-real-app.mjs",
      fs.readFileSync(usersFile, "utf-8"),
    );

    vi.stubGlobal("fetch", createRealAppFetch(app, requests));

    await expect(
      usersModule.usersClient.getUser({
        path: { id: "user@example.com" },
        query: { includeProfile: true, tag: "vip" },
        headers: { "x-request-id": "req-success-get" },
      }),
    ).resolves.toEqual({
      id: "user@example.com",
      name: "vip",
      includeProfile: true,
      requestId: "req-success-get",
    });
    expect(requests[0]).toEqual({
      url: "/users/user%40example.com?includeProfile=true&tag=vip",
      init: {
        method: "GET",
        headers: { "x-request-id": "req-success-get" },
      },
    });

    await expect(
      usersModule.usersClient.createUser({
        body: { name: "Ada" },
        headers: { "x-request-id": "req-success-post" },
      }),
    ).resolves.toEqual({
      id: "user_ada",
      name: "Ada",
      requestId: "req-success-post",
    });
    expect(requests[1]).toEqual({
      url: "/users",
      init: {
        method: "POST",
        body: JSON.stringify({ name: "Ada" }),
        headers: {
          "content-type": "application/json",
          "x-request-id": "req-success-post",
        },
      },
    });

    const validationError = await getRejectedError(
      usersModule.usersClient.createUser({
        body: { name: "" },
        headers: { "x-request-id": "req-validation" },
      }),
    );
    expect(validationError).toMatchObject({
      name: "RpcClientProblemError",
      problem: {
        status: 422,
        code: "protocols-rest/request-validation-failed",
        issues: expect.arrayContaining([
          expect.objectContaining({
            path: "body.name",
          }),
        ]),
      },
    });

    const result = await usersModule.usersClient.getUserResult({
      path: { id: "missing" },
      query: { includeProfile: false },
      headers: { "x-request-id": "req-problem" },
    });
    expect(result).toMatchObject({
      ok: false,
      kind: "problem",
      code: "USER_NOT_FOUND",
      category: "NotFound",
      status: 404,
      problem: {
        status: 404,
        code: "USER_NOT_FOUND",
      },
      declaration: {
        code: "USER_NOT_FOUND",
        category: "NotFound",
        status: 404,
      },
    });
    expect(requests[3]).toEqual({
      url: "/users/missing?includeProfile=false",
      init: {
        method: "GET",
        headers: { "x-request-id": "req-problem" },
      },
    });
  });
});

async function importGeneratedUsersClient(
  fileName: string,
  source: string,
): Promise<GeneratedUsersModule> {
  const rpcSource = fs.readFileSync(path.join(outDir, "rpc.ts"), "utf-8");
  const rpcOutput = ts.transpileModule(rpcSource, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
    reportDiagnostics: true,
  });
  const output = ts.transpileModule(source.replace("from './rpc';", "from './rpc.mjs';"), {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
    reportDiagnostics: true,
  });

  expect(rpcOutput.diagnostics).toEqual([]);
  expect(output.diagnostics).toEqual([]);

  const modulePath = path.join(moduleDir, fileName);
  writeProblemsCoreRuntime(moduleDir);
  fs.writeFileSync(path.join(moduleDir, "rpc.mjs"), rpcOutput.outputText);
  fs.writeFileSync(modulePath, output.outputText);

  return import(pathToFileURL(modulePath).href) as Promise<GeneratedUsersModule>;
}

function createRealAppFetch(app: CrocoApp, requests: RecordedRequest[]) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const requestUrl = readRequestUrl(url);
    const requestInit = url instanceof Request ? url : init;

    requests.push({
      url: requestUrl,
      init: serializeRequestInit(requestInit),
    });

    const request =
      url instanceof Request
        ? url.clone()
        : new Request(new URL(requestUrl, "http://localhost"), requestInit);

    return app.fetch(request);
  });
}

function readRequestUrl(url: string | URL | Request): string {
  if (typeof url === "string") {
    return url;
  }

  if (url instanceof URL) {
    return `${url.pathname}${url.search}`;
  }

  const requestUrl = new URL(url.url);

  return `${requestUrl.pathname}${requestUrl.search}`;
}

function serializeRequestInit(init: RequestInit | Request | undefined): RecordedRequest["init"] {
  if (!init) {
    return {};
  }

  const headers = new Headers(init.headers);
  const serializedHeaders = Object.fromEntries(headers.entries());

  return {
    ...(init.method ? { method: init.method } : {}),
    ...(Object.keys(serializedHeaders).length > 0 ? { headers: serializedHeaders } : {}),
    ...("body" in init && init.body ? { body: init.body } : {}),
  };
}

function writeProblemsCoreRuntime(parentDir: string): void {
  const packageDir = path.join(parentDir, "node_modules", "@croco", "problems-core");
  fs.mkdirSync(packageDir, { recursive: true });
  fs.writeFileSync(
    path.join(packageDir, "package.json"),
    JSON.stringify({ type: "module", exports: "./index.mjs" }),
  );
  fs.writeFileSync(
    path.join(packageDir, "index.mjs"),
    `export const ProblemCategory = {
  ValidationError: 'ValidationError',
};

export class Problem extends Error {
  constructor(code, category, detail, options = {}) {
    super(detail ?? code ?? 'Problem');
    this.name = this.constructor.name;
    this.code = this.code ?? code;
    this.category = this.category ?? category;
    this.detail = detail;
    this.extensions = options.extensions;
  }

  toJSON() {
    return {
      code: this.code,
      category: this.category,
      detail: this.detail,
      ...(this.extensions ?? {}),
    };
  }
}
`,
  );
}

async function getRejectedError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  throw new Error("Expected promise to reject.");
}
