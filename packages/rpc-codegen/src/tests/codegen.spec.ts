import * as fs from 'node:fs';
import * as path from 'node:path';
import type { RouteIR } from '@croco/protocols-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateClientFiles } from '../libs/generate';

const TEMP_DIR = path.join(__dirname, 'codegen-temp');

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
        outputSchema: null,
        domain: null,
      },
    ];

    const files = generateClientFiles(routes, TEMP_DIR);

    const content = fs.readFileSync(files[0], 'utf-8');
    expect(content).toContain('create: (input: CreateInput) =>');
    expect(content).toContain("fetch('/users', { method: 'POST', body: JSON.stringify(input) })");
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
});
