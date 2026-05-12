import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { extractRouteIR, type RouteIR } from "@croco/protocols-core";
import { Project, type SourceFile, ts } from "ts-morph";
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
    expect(files).toEqual([path.join(outDir, "test.ts")]);

    const getUser = findRoute(routes, "getUser");
    expect(getUser.inputSchemas.body).toBeNull();
    expect(getUser.inputSchemas.path).toBeTruthy();
    expect(getUser.inputSchemas.query).toBeTruthy();
    expect(getUser.outputSchema).toBeNull();

    const createUser = findRoute(routes, "createUser");
    expect(createUser.inputSchemas.body).toBeTruthy();
    expect(createUser.inputSchemas.path).toBeNull();
    expect(createUser.inputSchemas.query).toBeNull();
    expect(createUser.outputSchema).toBeTruthy();

    const health = findRoute(routes, "health");
    expect(health.inputSchemas).toEqual({ body: null, path: null, query: null });
    expect(health.outputSchema).toBeNull();

    const content = fs.readFileSync(files[0], "utf-8");
    expect(content).toContain(
      "export type GetUserInput = { path: { id: string; }; query: { include: string | undefined; }; };",
    );
    expect(content).toContain("export type CreateUserInput = { name: string; };");
    expect(content).toContain("export type CreateUserOutput = { id: string; name: string; };");
    expect(content).toContain("const path = `/users/${input.path.id}`;");
    expect(content).toContain("const query = new URLSearchParams(input.query).toString();");
    expect(content).toContain(
      "return fetch(url, { method: 'GET' }).then((response) => response.json());",
    );
    expect(content).toContain(
      "fetch('/users', { method: 'POST', body: JSON.stringify(input), headers: { 'Content-Type': 'application/json' } })",
    );
    expect(content).toContain(
      "health: () => fetch('/health', { method: 'GET' }).then((response) => response.json()),",
    );
    expect(content).not.toContain("zod");
  });
});

function emitController(sourcePath: string): SourceFile {
  const project = new Project({
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
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
    @Query('include', z.string().optional()) include?: string | undefined
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
