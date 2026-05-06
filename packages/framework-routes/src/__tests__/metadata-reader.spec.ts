import 'reflect-metadata';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'tsup';
import { describe, expect, it } from 'vitest';
import { readControllerMetadata } from '../metadata-reader';
import { SampleController } from './fixtures/SampleController';

describe('readControllerMetadata', () => {
  it('reads controller metadata from a class', () => {
    const controllerKey = Symbol.for('croco:rest:controller');
    const routesKey = Symbol.for('croco:rest:routes');

    const controllerMeta = Reflect.getMetadata(controllerKey, SampleController);
    const routesMeta = Reflect.getMetadata(routesKey, SampleController);

    expect(controllerMeta).toBeDefined();
    expect(controllerMeta.path).toBe('/api');
    expect(routesMeta).toHaveLength(2);
    expect(routesMeta[0].method).toBe('GET');
    expect(routesMeta[0].path).toBe('/hello');
    expect(routesMeta[1].method).toBe('POST');
    expect(routesMeta[1].path).toBe('/users');
  });

  it('imports a controller module file and returns route info', async () => {
    const moduleUrl = new URL('./fixtures/SampleController.ts', import.meta.url).href;
    const info = await readControllerMetadata(moduleUrl);

    expect(info).toEqual({
      basePath: '/api',
      className: 'SampleController',
      routes: [
        { method: 'GET', path: '/hello', handlerName: 'hello' },
        { method: 'POST', path: '/users', handlerName: 'createUser' },
      ],
    });
  });

  it('reads metadata from a compiled controller module', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'croco-framework-routes-fixture-'));

    try {
      await build({
        entry: [new URL('./fixtures/SampleController.ts', import.meta.url).pathname],
        format: ['esm'],
        outDir: outputDir,
        clean: true,
        dts: false,
        silent: true,
        external: ['reflect-metadata'],
        noExternal: ['@croco/framework-context', '@croco/protocols-rest', '@croco/problems-core'],
      });

      const info = await readControllerMetadata(new URL(`file://${join(outputDir, 'SampleController.mjs')}`).href);

      expect(info?.basePath).toBe('/api');
      expect(info?.className).toBe('SampleController');
      expect(info?.routes).toEqual([
        { method: 'GET', path: '/hello', handlerName: 'hello' },
        { method: 'POST', path: '/users', handlerName: 'createUser' },
      ]);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });
});
