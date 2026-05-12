import * as fs from 'node:fs';
import * as path from 'node:path';
import type { RouteIR } from '@croco/protocols-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { generateClientFiles } from '../libs/generate';

const TEMP_DIR = path.join(__dirname, 'codegen-temp');
const EMPTY_INPUT_SCHEMAS = { body: null, path: null, query: null };
const BODY_INPUT_SCHEMAS = { body: {} as RouteIR['inputSchemas']['body'], path: null, query: null };
const PATH_INPUT_SCHEMAS = { body: null, path: z.object({ id: z.string() }) as any, query: null };
const QUERY_INPUT_SCHEMAS = { body: null, path: null, query: z.object({ page: z.string() }) as any };
const COMBINED_INPUT_SCHEMAS = {
  body: z.object({ name: z.string() }) as any,
  path: z.object({ id: z.string() }) as any,
  query: z.object({ filter: z.string() }) as any,
};

describe('generateClientFiles', () => {
  beforeEach(() => {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  });

  it('should generate a GET fetch client', () => {
    const routes: RouteIR[] = [
      {
        controllerName: 'UserController',
        methodName: 'list',
        httpMethod: 'GET',
        path: '/users',
        params: [],
        inputSchema: null,
        inputSchemas: EMPTY_INPUT_SCHEMAS,
        outputSchema: null,
        domain: null,
      },
    ];

    const files = generateClientFiles(routes, TEMP_DIR);

    expect(files).toEqual([path.join(TEMP_DIR, 'user.ts')]);
    const content = fs.readFileSync(files[0], 'utf-8');
    expect(content).toContain('export const userClient = {');
    expect(content).toContain("list: () => fetch('/users', { method: 'GET' }).then((response) => response.json()),");
  });

  it('should serialize POST body input', () => {
    const routes: RouteIR[] = [
      {
        controllerName: 'UserController',
        methodName: 'create',
        httpMethod: 'POST',
        path: '/users',
        params: [{ kind: 'body', name: '', schema: null }],
        inputSchema: null,
        inputSchemas: BODY_INPUT_SCHEMAS,
        outputSchema: null,
        domain: null,
      },
    ];

    const files = generateClientFiles(routes, TEMP_DIR);

    const content = fs.readFileSync(files[0], 'utf-8');
    expect(content).toContain('create: (input: CreateInput) =>');
    expect(content).toContain(
      "fetch('/users', { method: 'POST', body: JSON.stringify(input), headers: { 'Content-Type': 'application/json' } })"
    );
  });

  it('should generate one file per controller domain', () => {
    const routes: RouteIR[] = [
      {
        controllerName: 'UserController',
        methodName: 'list',
        httpMethod: 'GET',
        path: '/users',
        params: [],
        inputSchema: null,
        inputSchemas: EMPTY_INPUT_SCHEMAS,
        outputSchema: null,
        domain: null,
      },
      {
        controllerName: 'OrderController',
        methodName: 'list',
        httpMethod: 'GET',
        path: '/orders',
        params: [],
        inputSchema: null,
        inputSchemas: EMPTY_INPUT_SCHEMAS,
        outputSchema: null,
        domain: null,
      },
    ];

    const files = generateClientFiles(routes, TEMP_DIR);

    expect(files).toEqual([path.join(TEMP_DIR, 'order.ts'), path.join(TEMP_DIR, 'user.ts')]);
    expect(fs.existsSync(path.join(TEMP_DIR, 'user.ts'))).toBe(true);
    expect(fs.existsSync(path.join(TEMP_DIR, 'order.ts'))).toBe(true);
  });

  it('should generate React Query hooks when enabled', () => {
    const routes: RouteIR[] = [
      {
        controllerName: 'UserController',
        methodName: 'create',
        httpMethod: 'POST',
        path: '/users',
        params: [{ kind: 'body', name: '', schema: null }],
        inputSchema: null,
        inputSchemas: BODY_INPUT_SCHEMAS,
        outputSchema: null,
        domain: null,
      },
    ];

    const files = generateClientFiles(routes, TEMP_DIR, { reactQuery: true });

    const content = fs.readFileSync(files[0], 'utf-8');
    expect(content).toContain("import { useMutation, useQuery } from '@tanstack/react-query';");
    expect(content).toContain('export function useCreate()');
    expect(content).toContain('return useMutation({ mutationFn: userClient.create });');
  });

  it('should generate query input types from inputSchemas', () => {
    const routes: RouteIR[] = [
      {
        controllerName: 'UserController',
        methodName: 'list',
        httpMethod: 'GET',
        path: '/users',
        params: [{ kind: 'query', name: 'page', schema: null }],
        inputSchema: null,
        inputSchemas: QUERY_INPUT_SCHEMAS,
        outputSchema: null,
        domain: null,
      },
    ];

    const files = generateClientFiles(routes, TEMP_DIR);

    const content = fs.readFileSync(files[0], 'utf-8');
    expect(content).toContain('export type ListInput = { query: { page: string; }; };');
  });

  it('should generate path input types from inputSchemas', () => {
    const routes: RouteIR[] = [
      {
        controllerName: 'UserController',
        methodName: 'get',
        httpMethod: 'GET',
        path: '/users/:id',
        params: [{ kind: 'path', name: 'id', schema: null }],
        inputSchema: null,
        inputSchemas: PATH_INPUT_SCHEMAS,
        outputSchema: null,
        domain: null,
      },
    ];

    const files = generateClientFiles(routes, TEMP_DIR);

    const content = fs.readFileSync(files[0], 'utf-8');
    expect(content).toContain('export type GetInput = { path: { id: string; }; };');
  });

  it('should generate combined input types from inputSchemas', () => {
    const routes: RouteIR[] = [
      {
        controllerName: 'UserController',
        methodName: 'update',
        httpMethod: 'PATCH',
        path: '/users/:id',
        params: [
          { kind: 'path', name: 'id', schema: null },
          { kind: 'query', name: 'filter', schema: null },
          { kind: 'body', name: '', schema: null },
        ],
        inputSchema: null,
        inputSchemas: COMBINED_INPUT_SCHEMAS,
        outputSchema: null,
        domain: null,
      },
    ];

    const files = generateClientFiles(routes, TEMP_DIR);

    const content = fs.readFileSync(files[0], 'utf-8');
    expect(content).toContain(
      'export type UpdateInput = { body: { name: string; }; path: { id: string; }; query: { filter: string; }; };'
    );
  });

  it('should generate output types from outputSchema', () => {
    const routes: RouteIR[] = [
      {
        controllerName: 'UserController',
        methodName: 'get',
        httpMethod: 'GET',
        path: '/users/:id',
        params: [{ kind: 'path', name: 'id', schema: null }],
        inputSchema: null,
        inputSchemas: PATH_INPUT_SCHEMAS,
        outputSchema: z.object({ id: z.string(), name: z.string() }) as any,
        domain: null,
      },
    ];

    const files = generateClientFiles(routes, TEMP_DIR);

    const content = fs.readFileSync(files[0], 'utf-8');
    expect(content).toContain('export type GetOutput = { id: string; name: string; };');
    expect(content).toContain('response.json() as Promise<GetOutput>');
  });

  it('should not emit zod references for body-only routes', () => {
    const routes: RouteIR[] = [
      {
        controllerName: 'UserController',
        methodName: 'create',
        httpMethod: 'POST',
        path: '/users',
        params: [{ kind: 'body', name: '', schema: null }],
        inputSchema: null,
        inputSchemas: { body: z.object({ name: z.string() }) as any, path: null, query: null },
        outputSchema: null,
        domain: null,
      },
    ];

    const files = generateClientFiles(routes, TEMP_DIR);

    const content = fs.readFileSync(files[0], 'utf-8');
    expect(content).not.toContain('z.');
  });

  it('should use path input when generating path parameter fetch calls', () => {
    const routes: RouteIR[] = [
      {
        controllerName: 'UserController',
        methodName: 'get',
        httpMethod: 'GET',
        path: '/users/:id',
        params: [{ kind: 'path', name: 'id', schema: null }],
        inputSchema: null,
        inputSchemas: PATH_INPUT_SCHEMAS,
        outputSchema: null,
        domain: null,
      },
    ];

    const files = generateClientFiles(routes, TEMP_DIR);

    const content = fs.readFileSync(files[0], 'utf-8');
    expect(content).toContain('const path = `/users/${input.path.id}`;');
    expect(content).toContain("return fetch(path, { method: 'GET' }).then((response) => response.json());");
  });

  it('should serialize query input when generating query parameter fetch calls', () => {
    const routes: RouteIR[] = [
      {
        controllerName: 'UserController',
        methodName: 'list',
        httpMethod: 'GET',
        path: '/users',
        params: [{ kind: 'query', name: 'page', schema: null }],
        inputSchema: null,
        inputSchemas: QUERY_INPUT_SCHEMAS,
        outputSchema: null,
        domain: null,
      },
    ];

    const files = generateClientFiles(routes, TEMP_DIR);

    const content = fs.readFileSync(files[0], 'utf-8');
    expect(content).toContain('const query = new URLSearchParams(input.query).toString();');
    expect(content).toContain('const url = query ? `${path}?${query}` : path;');
    expect(content).toContain("return fetch(url, { method: 'GET' }).then((response) => response.json());");
  });

  it('should serialize body, path, and query input when generating combined fetch calls', () => {
    const routes: RouteIR[] = [
      {
        controllerName: 'UserController',
        methodName: 'update',
        httpMethod: 'PATCH',
        path: '/users/:id',
        params: [
          { kind: 'path', name: 'id', schema: null },
          { kind: 'query', name: 'filter', schema: null },
          { kind: 'body', name: '', schema: null },
        ],
        inputSchema: null,
        inputSchemas: COMBINED_INPUT_SCHEMAS,
        outputSchema: null,
        domain: null,
      },
    ];

    const files = generateClientFiles(routes, TEMP_DIR);

    const content = fs.readFileSync(files[0], 'utf-8');
    expect(content).toContain('const path = `/users/${input.path.id}`;');
    expect(content).toContain('const query = new URLSearchParams(input.query).toString();');
    expect(content).toContain('const url = query ? `${path}?${query}` : path;');
    expect(content).toContain(
      "return fetch(url, { method: 'PATCH', body: JSON.stringify(input.body), headers: { 'Content-Type': 'application/json' } })"
    );
  });
});
