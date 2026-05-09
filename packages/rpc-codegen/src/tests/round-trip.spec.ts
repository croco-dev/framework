import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { RouteIR } from '@croco/protocols-core';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { generateClientFiles } from '../libs/generate';

const outDir = path.join(os.tmpdir(), 'opencode-roundtrip-rpc-codegen');
const moduleDir = path.join(os.tmpdir(), 'opencode-roundtrip-rpc-codegen-modules');
const EMPTY_INPUT_SCHEMAS = { body: null, path: null, query: null };
const BODY_INPUT_SCHEMAS = { body: {} as RouteIR['inputSchemas']['body'], path: null, query: null };
const PATH_QUERY_INPUT_SCHEMAS = {
  body: null,
  path: z.object({ id: z.string() }) as any,
  query: z.object({ includePosts: z.string() }) as any,
};

describe('rpc-codegen round trip', () => {
  beforeEach(() => {
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.rmSync(moduleDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    fs.mkdirSync(moduleDir, { recursive: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.rmSync(moduleDir, { recursive: true, force: true });
  });

  it('generates domain clients that can call a mocked server', async () => {
    const routeIRs: RouteIR[] = [
      {
        controllerName: 'UserController',
        methodName: 'listUsers',
        httpMethod: 'GET',
        path: '/users',
        params: [],
        inputSchema: null,
        inputSchemas: EMPTY_INPUT_SCHEMAS,
        outputSchema: null,
        domain: 'user',
      },
      {
        controllerName: 'UserController',
        methodName: 'createUser',
        httpMethod: 'POST',
        path: '/users',
        params: [{ kind: 'body', name: '', schema: null }],
        inputSchema: null,
        inputSchemas: BODY_INPUT_SCHEMAS,
        outputSchema: null,
        domain: 'user',
      },
      {
        controllerName: 'OrderController',
        methodName: 'listOrders',
        httpMethod: 'GET',
        path: '/orders',
        params: [],
        inputSchema: null,
        inputSchemas: EMPTY_INPUT_SCHEMAS,
        outputSchema: null,
        domain: 'order',
      },
    ];

    const files = generateClientFiles(routeIRs, outDir);

    expect(files).toEqual([path.join(outDir, 'order.ts'), path.join(outDir, 'user.ts')]);
    expect(fs.readdirSync(outDir).sort()).toEqual(['order.ts', 'user.ts']);

    const userContent = fs.readFileSync(path.join(outDir, 'user.ts'), 'utf-8');
    const orderContent = fs.readFileSync(path.join(outDir, 'order.ts'), 'utf-8');

    expect(userContent).toContain('export const userClient = {');
    expect(userContent).toContain("listUsers: () => fetch('/users', { method: 'GET' })");
    expect(userContent).toContain('createUser: (input: CreateUserInput) =>');
    expect(userContent).toContain(
      "fetch('/users', { method: 'POST', body: JSON.stringify(input), headers: { 'Content-Type': 'application/json' } })"
    );
    expect(orderContent).toContain('export const orderClient = {');
    expect(orderContent).toContain("listOrders: () => fetch('/orders', { method: 'GET' })");

    const userModule = await importGeneratedClient('user-path-query.ts', userContent);
    const fetchMock = vi.fn(async (url: string, options: RequestInit) => {
      if (url === '/users' && options.method === 'GET') {
        return jsonResponse([{ id: '1', name: 'Alice' }]);
      }

      if (url === '/users' && options.method === 'POST') {
        return jsonResponse({ id: '2', name: JSON.parse(options.body as string).name });
      }

      return jsonResponse({ message: 'not found' }, 404);
    });

    vi.stubGlobal('fetch', fetchMock);

    await expect(userModule.userClient.listUsers()).resolves.toEqual([{ id: '1', name: 'Alice' }]);
    await expect(userModule.userClient.createUser({ name: 'Bob' })).resolves.toEqual({ id: '2', name: 'Bob' });
    expect(fetchMock).toHaveBeenCalledWith('/users', { method: 'GET' });
    expect(fetchMock).toHaveBeenCalledWith('/users', {
      method: 'POST',
      body: JSON.stringify({ name: 'Bob' }),
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('generates path and query inputs that can call a mocked server', async () => {
    const routeIRs: RouteIR[] = [
      {
        controllerName: 'UserController',
        methodName: 'getUser',
        httpMethod: 'GET',
        path: '/users/:id',
        params: [
          { kind: 'path', name: 'id', schema: null },
          { kind: 'query', name: 'includePosts', schema: null },
        ],
        inputSchema: null,
        inputSchemas: PATH_QUERY_INPUT_SCHEMAS,
        outputSchema: null,
        domain: 'user',
      },
    ];

    const files = generateClientFiles(routeIRs, outDir);
    const userContent = fs.readFileSync(files[0], 'utf-8');
    const userModule = await importGeneratedClient('user-output.ts', userContent);
    const fetchMock = vi.fn(async () => jsonResponse({ id: '1', includePosts: true }));

    vi.stubGlobal('fetch', fetchMock);

    await expect(
      userModule.userClient.getUser({ path: { id: '1' }, query: { includePosts: 'true' } })
    ).resolves.toEqual({ id: '1', includePosts: true });
    expect(fetchMock).toHaveBeenCalledWith('/users/1?includePosts=true', { method: 'GET' });
  });

  it('generates outputSchema types that compile', async () => {
    const routeIRs: RouteIR[] = [
      {
        controllerName: 'UserController',
        methodName: 'getUser',
        httpMethod: 'GET',
        path: '/users/:id',
        params: [{ kind: 'path', name: 'id', schema: null }],
        inputSchema: null,
        inputSchemas: { body: null, path: z.object({ id: z.string() }) as any, query: null },
        outputSchema: z.object({ id: z.string(), name: z.string() }) as any,
        domain: 'user',
      },
    ];

    const files = generateClientFiles(routeIRs, outDir);
    const userContent = fs.readFileSync(files[0], 'utf-8');
    const userModule = await importGeneratedClient('user.ts', userContent);
    const fetchMock = vi.fn(async () => jsonResponse({ id: '1', name: 'Alice' }));

    vi.stubGlobal('fetch', fetchMock);

    await expect(userModule.userClient.getUser({ path: { id: '1' } })).resolves.toEqual({ id: '1', name: 'Alice' });
  });
});

async function importGeneratedClient(fileName: string, source: string) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
    reportDiagnostics: true,
  });

  expect(output.diagnostics).toEqual([]);

  const modulePath = path.join(moduleDir, fileName.replace(/\.ts$/, '.mjs'));
  fs.writeFileSync(modulePath, output.outputText);

  return import(pathToFileURL(modulePath).href) as Promise<{
    readonly userClient: {
      readonly listUsers: () => Promise<unknown>;
      readonly createUser: (input: { readonly name: string }) => Promise<unknown>;
      readonly getUser: (input: {
        readonly path: { readonly id: string };
        readonly query?: { readonly includePosts: string };
      }) => Promise<unknown>;
    };
  }>;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
