import 'reflect-metadata';
import { Container, Context } from '@croco/framework-context';
import type { CallHandler, ExecutionContext } from '@croco/protocols-rest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditInterceptor } from '../libs/AuditInterceptor';
import type { AuditLogRepository } from '../libs/AuditLogRepository';
import { AUDIT_METADATA_KEY } from '../libs/constants';
import type { AuditLogEntry } from '../libs/types';

type RequestContextStub = {
  requestId: string;
  tenantId: string;
  user: {
    id: string;
  };
};

type MockHttpRequest = {
  headers?: Headers | Record<string, string | undefined>;
  body?: unknown;
  header?: Record<string, string | undefined> | ((name: string) => string | undefined);
};

type ExecutionContextInput = {
  controller: Function;
  handler: string | symbol;
  method: string;
  path: string;
  request: MockHttpRequest;
};

function createPersistedEntry(entry: Omit<AuditLogEntry, 'id' | 'createdAt'>): AuditLogEntry {
  return {
    id: 'audit-log-1',
    createdAt: new Date(),
    ...entry,
  };
}

function createExecutionContext(input: ExecutionContextInput): ExecutionContext {
  return {
    getRequest: () => input.request as unknown as Request,
    getClass: () => input.controller as never,
    getHandler: () => input.handler,
    getPath: () => input.path,
    getMethod: () => input.method,
  } as unknown as ExecutionContext;
}

function createCallHandler(result: unknown): CallHandler {
  return {
    handle: vi.fn(async () => result),
  } as unknown as CallHandler;
}

describe('AuditInterceptor', () => {
  let interceptor!: AuditInterceptor;

  beforeEach(() => {
    Container.reset();
    interceptor = new AuditInterceptor();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Container.reset();
  });

  it('should extract request metadata (URL, IP, method) and persist audit log', async () => {
    const createSpy = vi.fn(async (entry: Omit<AuditLogEntry, 'id' | 'createdAt'>) => createPersistedEntry(entry));
    const repository = {
      create: createSpy,
      find: vi.fn(),
    } as unknown as AuditLogRepository;

    vi.spyOn(Container, 'get').mockReturnValue(repository);
    vi.spyOn(Context, 'get').mockReturnValue({
      requestId: 'req-1',
      tenantId: 'tenant-1',
      user: { id: 'actor-1' },
    } as RequestContextStub);

    class TestController {
      update() {}
    }

    const context = createExecutionContext({
      controller: TestController,
      handler: 'update',
      method: 'PATCH',
      path: '/projects/project-1',
      request: {
        headers: {
          'x-forwarded-for': '203.0.113.10, 70.41.3.18',
        },
        body: { name: 'croco' },
      },
    });

    const expectedResult = { ok: true, projectId: 'project-1' };
    const next = createCallHandler(expectedResult);

    const result = await interceptor.intercept(context, next);

    await Promise.resolve();

    expect(result).toEqual(expectedResult);
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        actorId: 'actor-1',
        action: 'TestController.update',
        resourceType: 'TestController',
        resourceId: '/projects/project-1',
        metadata: {
          http: {
            method: 'PATCH',
            path: '/projects/project-1',
            ip: '203.0.113.10',
            body: { name: 'croco' },
          },
        },
      })
    );
  });

  it('should skip creating a new audit entry when @Auditable metadata already exists', async () => {
    const createSpy = vi.fn(async (entry: Omit<AuditLogEntry, 'id' | 'createdAt'>) => createPersistedEntry(entry));
    const repository = {
      create: createSpy,
      find: vi.fn(),
    } as unknown as AuditLogRepository;

    vi.spyOn(Container, 'get').mockReturnValue(repository);

    class TestController {
      create() {}
    }

    Reflect.defineMetadata(
      AUDIT_METADATA_KEY,
      {
        source: 'decorator',
      },
      TestController,
      'create'
    );

    const context = createExecutionContext({
      controller: TestController,
      handler: 'create',
      method: 'POST',
      path: '/projects',
      request: {
        headers: {},
        header: {
          'x-real-ip': '198.51.100.20',
        },
        body: { name: 'new-project' },
      },
    });

    const next = createCallHandler({ created: true });

    const result = await interceptor.intercept(context, next);

    const metadata = Reflect.getMetadata(AUDIT_METADATA_KEY, TestController, 'create') as Record<string, unknown>;

    expect(result).toEqual({ created: true });
    expect(createSpy).not.toHaveBeenCalled();
    expect(metadata).toEqual({
      source: 'decorator',
    });
  });

  it('should work standalone without @Auditable metadata', async () => {
    const createSpy = vi.fn(async (entry: Omit<AuditLogEntry, 'id' | 'createdAt'>) => createPersistedEntry(entry));
    const repository = {
      create: createSpy,
      find: vi.fn(),
    } as unknown as AuditLogRepository;

    vi.spyOn(Container, 'get').mockReturnValue(repository);
    vi.spyOn(Context, 'get').mockReturnValue(null);

    class PublicController {
      health() {}
    }

    const context = createExecutionContext({
      controller: PublicController,
      handler: 'health',
      method: 'GET',
      path: '/health',
      request: {
        headers: {
          'x-forwarded-for': '127.0.0.1',
        },
      },
    });

    const next = createCallHandler({ ok: true });

    const result = await interceptor.intercept(context, next);

    await Promise.resolve();

    expect(result).toEqual({ ok: true });
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'unknown',
        actorId: 'unknown',
        action: 'PublicController.health',
        resourceType: 'PublicController',
      })
    );
  });
});
