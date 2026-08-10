import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { extractRouteIR, type RouteIR } from "@croco/protocols-core";
import { Project, type SourceFile, ts as tsMorph } from "ts-morph";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateClientFiles } from "../libs/generate";

type Constructor = new (...args: unknown[]) => unknown;

const importAttempts = 5;
const importDelayMs = 20;

let tempRoot: string;
let sourceDir: string;
let emitDir: string;
let outDir: string;

describe("rpc-codegen e2e", () => {
  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "opencode-e2e-rpc-codegen-"));
    sourceDir = path.join(tempRoot, "src");
    emitDir = path.join(tempRoot, "emit");
    outDir = path.join(tempRoot, "client");

    fs.mkdirSync(sourceDir, { recursive: true });
    fs.mkdirSync(emitDir, { recursive: true });
    fs.mkdirSync(outDir, { recursive: true });
    linkNodeModules(tempRoot);
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("generates client types from a decorated controller", async () => {
    const sourcePath = path.join(sourceDir, "TestController.ts");
    fs.writeFileSync(sourcePath, getControllerSource());

    const sourceFile = emitController(sourcePath);
    const emittedPath = getEmittedFilePath(sourceDir, emitDir, sourceFile);
    const controllerCtor = await importController(emittedPath, "TestController");

    const routes = extractRouteIR(controllerCtor);
    const files = generateClientFiles(routes, outDir);

    expect(routes).toHaveLength(3);
    expect(files).toEqual([
      path.join(outDir, "test.ts"),
      path.join(outDir, "rpc.ts"),
      path.join(outDir, "index.ts"),
    ]);

    const getUser = findRoute(routes, "getUser");
    expect(getUser.inputSchemas.body).toBeNull();
    expect(getUser.inputSchemas.path).toBeTruthy();
    expect(getUser.inputSchemas.query).toBeTruthy();
    expect(getUser.inputSchemas.headers).toBeTruthy();
    expect(getUser.outputSchema).toBeNull();

    const createUser = findRoute(routes, "createUser");
    expect(createUser.inputSchemas.body).toBeTruthy();
    expect(createUser.inputSchemas.path).toBeNull();
    expect(createUser.inputSchemas.query).toBeNull();
    expect(createUser.inputSchemas.headers).toBeNull();
    expect(createUser.outputSchema).toBeTruthy();

    const health = findRoute(routes, "health");
    expect(health.inputSchemas).toEqual({ body: null, path: null, query: null, headers: null });
    expect(health.outputSchema).toBeNull();

    const content = fs.readFileSync(files[0], "utf-8");
    const rpcContent = fs.readFileSync(path.join(outDir, "rpc.ts"), "utf-8");
    expect(content).toContain(
      "import { createRpcClientRequest, handleRpcRequestError, handleJsonResponse, handleJsonResult, readOptionalJsonResponse, readOptionalJsonResult, toRpcFormProblem, serializeRpcQueryKeyInput, type RpcClientRequestOptions, type RpcClientResult, type RpcDeclaredProblem, type RpcDomainProblem, type RpcFormFieldProblem, type RpcFormGlobalProblem, type RpcFormModel, type RpcProblemDetailsFor, type RpcValidationProblem } from './rpc';",
    );
    expect(content).toContain(
      "export type GetUserInput = { path: { id: string; }; query: { include?: string | undefined; }; headers: { 'x-request-id': string; }; };",
    );
    expect(content).toContain("export type CreateUserInput = { name: string; };");
    expect(content).toContain("export type CreateUserOutput = { id: string; name: string; };");
    expect(content).toContain("export type CreateUserFormValues = { name: string; };");
    expect(content).toContain("export const createUserFormModel = {");
    expect(content).toContain(
      "export function buildCreateUserFormPayload(values: CreateUserFormValues): CreateUserSubmitPayload",
    );
    expect(content).toContain(
      "getUser: (input: GetUserInput, cacheScope?: unknown) => [...testKeys.all(), 'getUser', serializeRpcQueryKeyInput({ path: input.path, query: input.query }), serializeRpcQueryKeyInput(cacheScope)] as const,",
    );
    expect(content).toContain(
      "createUser: { route: testContractRoutes[1], invalidates: [testKeys.all()] },",
    );
    expect(content).toContain(
      "const path = `/users/${encodeURIComponent(String(input.path.id))}`;",
    );
    expect(content).toContain("const query = serializeQueryParams(input.query);");
    expect(content).toContain(
      "const request = createRpcClientRequest(testContractRoutes[0], 'query', url, { method: 'GET', headers: serializeHeaders(input.headers) }, options);",
    );
    expect(content).toContain(
      "return fetch(request.url, request.init).then((response) => readOptionalJsonResponse(response, request.telemetry)).catch((error) => handleRpcRequestError(error, request.telemetry));",
    );
    expect(content).toContain(
      "return fetch(request.url, request.init).then((response) => readOptionalJsonResult<GetUserProblem>(response, getUserProblemDeclarations, request.telemetry)).catch((error) => handleRpcRequestError(error, request.telemetry));",
    );
    expect(content).toContain(
      "const request = createRpcClientRequest(testContractRoutes[1], 'mutation', '/users', { method: 'POST', body: JSON.stringify(input), headers: { 'Content-Type': 'application/json' } }, options);",
    );
    expect(content).toContain(
      "health: (options?: RpcClientRequestOptions): Promise<unknown | undefined> => {",
    );
    expect(content).toContain(
      "healthResult: (options?: RpcClientRequestOptions): Promise<HealthResult> => {",
    );
    expect(content).not.toContain("zod");
    assertGeneratedClientTypechecks(
      `${content}
async function exerciseGeneratedClient() {
  const formValues: CreateUserFormValues = {
    ...createUserFormModel.initialValues,
    name: 'Ada Lovelace',
  };
  const createPayload = buildCreateUserFormPayload(formValues);
  const created = await testClient.createUser(createPayload);
  const createdResult = await testClient.createUserResult(createPayload);
  const tracedCreated = await testClient.createUser(createPayload, {
    correlationId: 'correlation-1',
  });
  const createdId: string = created.id;
  const createdName: string = created.name;
  const createdResultBranch: CreateUserResult = createdResult;
  const tracedCreatedId: string = tracedCreated.id;

  if (createdResult.ok) {
    const resultId: string = createdResult.data.id;
    void resultId;
  }

  await testClient.getUser({
    path: { id: createdId },
    query: { include: undefined },
    headers: { 'x-request-id': 'request-1' },
  });
  const getUserResult: Promise<GetUserResult> = testClient.getUserResult({
    path: { id: createdId },
    query: { include: undefined },
    headers: { 'x-request-id': 'request-1' },
  }, {
    correlationId: 'correlation-2',
  });
  const getUserKey = testKeys.getUser({
    path: { id: createdId },
    query: { include: undefined },
    headers: { 'x-request-id': 'request-1' },
  });
  const createUserInvalidationKey = testInvalidationManifest.createUser.invalidates[0];
  const createUserInvalidationRouteId: 'TestController.createUser' = testInvalidationManifest.createUser.route.routeId;

  // @ts-expect-error generated path params expose id, not userId.
  void testClient.getUser({ path: { userId: createdId }, query: { include: undefined }, headers: { 'x-request-id': 'request-1' } });

  // @ts-expect-error generated request bodies must match the controller body schema.
  void testClient.createUser({ name: 123 });

  // @ts-expect-error generated response fields keep their controller response schema types.
  const badCreatedId: number = created.id;

  void createdName;
  void createdResultBranch;
  void tracedCreatedId;
  void getUserResult;
  void getUserKey;
  void createUserInvalidationKey;
  void createUserInvalidationRouteId;
  void badCreatedId;
}
void exerciseGeneratedClient;
`,
      rpcContent,
    );
  }, 60_000);

  it("rejects extracted @All controller routes before generating clients", async () => {
    const sourcePath = path.join(sourceDir, "HooksController.ts");
    fs.writeFileSync(sourcePath, getAllControllerSource());

    const sourceFile = emitController(sourcePath);
    const emittedPath = getEmittedFilePath(sourceDir, emitDir, sourceFile);
    const controllerCtor = await importController(emittedPath, "HooksController");

    const routes = extractRouteIR(controllerCtor);

    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({
      controllerName: "HooksController",
      methodName: "handleHook",
      httpMethod: "ALL",
      path: "/hooks/:id",
    });
    expect(() => generateClientFiles(routes, outDir)).toThrow(
      "Cannot generate RPC client for @All route HooksController.handleHook (/hooks/:id): @All is runtime-only and cannot be represented as a concrete generated client request. Use explicit HTTP method decorators for generated contracts.",
    );
    expect(fs.existsSync(path.join(outDir, "hooks.ts"))).toBe(false);
  }, 60_000);
});

function emitController(sourcePath: string): SourceFile {
  const project = new Project({
    compilerOptions: {
      module: tsMorph.ModuleKind.CommonJS,
      target: tsMorph.ScriptTarget.ES2020,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      noEmitOnError: false,
      rootDir: sourceDir,
      outDir: emitDir,
    },
  });
  const sourceFile = project.addSourceFileAtPath(sourcePath);

  project.emitSync();

  return sourceFile;
}

async function importController(filePath: string, exportName: string): Promise<Constructor> {
  let lastError: unknown;

  for (let attempt = 0; attempt < importAttempts; attempt += 1) {
    try {
      const module = (await import(`${pathToFileURL(filePath).href}?attempt=${attempt}`)) as Record<
        string,
        unknown
      >;
      const exported = module[exportName];

      if (typeof exported !== "function") {
        throw new Error(`Controller class '${exportName}' is not exported from ${filePath}`);
      }

      return exported as Constructor;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, importDelayMs));
    }
  }

  throw lastError;
}

function getEmittedFilePath(rootDir: string, targetDir: string, sourceFile: SourceFile): string {
  const relativePath = path
    .relative(rootDir, sourceFile.getFilePath())
    .replace(/\.[cm]?tsx?$/, ".js");

  return path.join(targetDir, relativePath);
}

function findRoute(routes: RouteIR[], methodName: string): RouteIR {
  const route = routes.find((candidate) => candidate.methodName === methodName);

  if (!route) {
    throw new Error(`Route '${methodName}' was not extracted.`);
  }

  return route;
}

function assertGeneratedClientTypechecks(source: string, rpcSource: string): void {
  const fileName = "generated-client.ts";
  const supportFileName = "rpc.ts";
  const sources = new Map([
    [fileName, source],
    [supportFileName, rpcSource],
  ]);
  const compilerOptions: ts.CompilerOptions = {
    lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    skipLibCheck: true,
    strict: true,
    target: ts.ScriptTarget.ES2022,
    types: [],
  };
  const host = ts.createCompilerHost(compilerOptions);

  host.getSourceFile = (name, languageVersion) => {
    const text = sources.get(name) ?? sources.get(path.basename(name));

    if (text !== undefined) {
      return ts.createSourceFile(name, text, languageVersion, true);
    }

    const fileText = ts.sys.readFile(name);

    return fileText === undefined
      ? undefined
      : ts.createSourceFile(name, fileText, languageVersion, true);
  };
  host.fileExists = (name) =>
    sources.has(name) || sources.has(path.basename(name)) || ts.sys.fileExists(name);
  host.readFile = (name) =>
    sources.get(name) ?? sources.get(path.basename(name)) ?? ts.sys.readFile(name);

  const program = ts.createProgram([fileName], compilerOptions, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  const messages = diagnostics.map((diagnostic) =>
    ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
  );

  expect(messages).toEqual([]);
}

function linkNodeModules(targetDir: string): void {
  const nodeModules = findNodeModules(process.cwd());

  if (!fs.existsSync(nodeModules)) {
    return;
  }

  fs.symlinkSync(nodeModules, path.join(targetDir, "node_modules"), "dir");
}

function findNodeModules(startDir: string): string {
  let currentDir = startDir;

  while (true) {
    const nodeModules = path.join(currentDir, "node_modules");

    if (fs.existsSync(path.join(nodeModules, "zod"))) {
      return nodeModules;
    }

    const parentDir = path.dirname(currentDir);

    if (parentDir === currentDir) {
      return nodeModules;
    }

    currentDir = parentDir;
  }
}

function getControllerSource(): string {
  return `import { z } from 'zod';

const REST_CONTROLLER_KEY = Symbol.for('croco:rest:controller');
const REST_ROUTES_KEY = Symbol.for('croco:rest:routes');
const REST_PARAMS_KEY = Symbol.for('croco:rest:params');
const RESPONSE_SCHEMA_KEY = Symbol.for('croco:rest:responseSchema');

enum ParamType {
  PARAM = 'param',
  QUERY = 'query',
  BODY = 'body',
  HEADER = 'header',
}

type RouteMetadata = {
  readonly method: string;
  readonly path: string;
  readonly methodName: string | symbol;
};

function Controller(controllerPath: string): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(REST_CONTROLLER_KEY, { path: controllerPath, target }, target);
  };
}

function Get(routePath: string): MethodDecorator {
  return createRouteDecorator('GET', routePath);
}

function Post(routePath: string): MethodDecorator {
  return createRouteDecorator('POST', routePath);
}

function Param(name: string, schema?: unknown): ParameterDecorator {
  return createParamDecorator(ParamType.PARAM, name, schema);
}

function Query(name: string, schema?: unknown): ParameterDecorator {
  return createParamDecorator(ParamType.QUERY, name, schema);
}

function Body(schema?: unknown): ParameterDecorator {
  return createParamDecorator(ParamType.BODY, undefined, schema);
}

function Header(name: string, schema?: unknown): ParameterDecorator {
  return createParamDecorator(ParamType.HEADER, name, schema);
}

function createRouteDecorator(method: string, routePath: string): MethodDecorator {
  return (target, propertyKey) => {
    const ctor = target.constructor;
    const routes = (Reflect.getMetadata(REST_ROUTES_KEY, ctor) as RouteMetadata[] | undefined) ?? [];

    Reflect.defineMetadata(REST_ROUTES_KEY, [...routes, { method, path: routePath, methodName: propertyKey }], ctor);
  };
}

function createParamDecorator(type: ParamType, name: string | undefined, schema: unknown): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    if (!propertyKey) return;

    const ctor = target.constructor;
    const paramsMap = (Reflect.getMetadata(REST_PARAMS_KEY, ctor) as Map<string | symbol, unknown[]> | undefined) ?? new Map();
    const methodParams = paramsMap.get(propertyKey) ?? [];

    paramsMap.set(propertyKey, [...methodParams, { type, index: parameterIndex, name, pipes: schema ? [{ schema }] : undefined }]);
    Reflect.defineMetadata(REST_PARAMS_KEY, paramsMap, ctor);
  };
}

@Controller('')
export class TestController {
  @Get('/users/:id')
  getUser(
    @Param('id', z.string()) id: string,
    @Query('include', z.string().optional()) include: string | undefined,
    @Header('x-request-id', z.string()) _requestId: string
  ) {
    return { id: '1', name: include ?? 'test' };
  }

  @Post('/users')
  createUser(@Body(z.object({ name: z.string() })) body: { name: string }) {
    return { id: '1', name: body.name };
  }

  @Get('/health')
  health() {
    return { status: 'ok' };
  }
}

Reflect.defineMetadata(RESPONSE_SCHEMA_KEY, z.object({ id: z.string(), name: z.string() }), TestController, 'createUser');
`;
}

function getAllControllerSource(): string {
  return `const REST_CONTROLLER_KEY = Symbol.for('croco:rest:controller');
const REST_ROUTES_KEY = Symbol.for('croco:rest:routes');
const REST_PARAMS_KEY = Symbol.for('croco:rest:params');

enum ParamType {
  PARAM = 'param',
}

type RouteMetadata = {
  readonly method: string;
  readonly path: string;
  readonly methodName: string | symbol;
};

function Controller(controllerPath: string): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(REST_CONTROLLER_KEY, { path: controllerPath, target }, target);
  };
}

function All(routePath: string): MethodDecorator {
  return createRouteDecorator('ALL', routePath);
}

function Param(name: string): ParameterDecorator {
  return createParamDecorator(ParamType.PARAM, name);
}

function createRouteDecorator(method: string, routePath: string): MethodDecorator {
  return (target, propertyKey) => {
    const ctor = target.constructor;
    const routes = (Reflect.getMetadata(REST_ROUTES_KEY, ctor) as RouteMetadata[] | undefined) ?? [];

    Reflect.defineMetadata(REST_ROUTES_KEY, [...routes, { method, path: routePath, methodName: propertyKey }], ctor);
  };
}

function createParamDecorator(type: ParamType, name: string): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    if (!propertyKey) return;

    const ctor = target.constructor;
    const paramsMap = (Reflect.getMetadata(REST_PARAMS_KEY, ctor) as Map<string | symbol, unknown[]> | undefined) ?? new Map();
    const methodParams = paramsMap.get(propertyKey) ?? [];

    paramsMap.set(propertyKey, [...methodParams, { type, index: parameterIndex, name }]);
    Reflect.defineMetadata(REST_PARAMS_KEY, paramsMap, ctor);
  };
}

@Controller('/hooks')
export class HooksController {
  @All('/:id')
  handleHook(@Param('id') id: string) {
    return { id };
  }
}
`;
}
