import 'reflect-metadata';
import { Container, Context } from '@croco/framework-context';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Auditable } from '../libs/Auditable';
import type { AuditLogRepository } from '../libs/AuditLogRepository';
import type { AuditLogEntry } from '../libs/types';

type RequestContextStub = {
  requestId: string;
  tenantId: string;
  user: {
    id: string;
  };
};

function createPersistedEntry(entry: Omit<AuditLogEntry, 'id' | 'createdAt'>): AuditLogEntry {
  return {
    id: 'audit-log-1',
    createdAt: new Date(),
    ...entry,
  };
}

describe('@Auditable', () => {
  beforeEach(() => {
    Container.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Container.reset();
  });

  it('should wrap method and call AuditLogRepository.create after method execution', async () => {
    const events: string[] = [];
    const createSpy = vi.fn(async (entry: Omit<AuditLogEntry, 'id' | 'createdAt'>) => {
      events.push('audit');
      return createPersistedEntry(entry);
    });

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

    class TestService {
      private readonly prefix = 'wrapped';

      @Auditable({
        action: 'project.update',
        resourceType: 'Project',
        resourceIdParam: 'resourceId',
        payloadParam: 'payload',
      })
      async update(resourceId: string, payload: { name: string; diff: Record<string, unknown> }): Promise<string> {
        events.push('method');
        return `${this.prefix}:${resourceId}:${payload.name}`;
      }
    }

    const service = new TestService();
    const result = await service.update('project-1', {
      name: 'croco',
      diff: { name: { before: 'legacy', after: 'croco' } },
    });

    await Promise.resolve();

    expect(result).toBe('wrapped:project-1:croco');
    expect(events).toEqual(['method', 'audit']);
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        actorId: 'actor-1',
        action: 'project.update',
        resourceType: 'Project',
        resourceId: 'project-1',
        payload: expect.objectContaining({
          arguments: ['project-1', { name: 'croco', diff: { name: { before: 'legacy', after: 'croco' } } }],
          input: { name: 'croco', diff: { name: { before: 'legacy', after: 'croco' } } },
          result: 'wrapped:project-1:croco',
        }),
        diff: { name: { before: 'legacy', after: 'croco' } },
      })
    );
  });

  it('should call audit repository in fire-and-forget mode without awaiting', async () => {
    const createDeferred: { resolve: ((value: AuditLogEntry) => void) | null } = {
      resolve: null,
    };
    const createSpy = vi.fn(
      () =>
        new Promise<AuditLogEntry>((resolve) => {
          createDeferred.resolve = resolve;
        })
    );

    const repository = {
      create: createSpy,
      find: vi.fn(),
    } as unknown as AuditLogRepository;

    vi.spyOn(Container, 'get').mockReturnValue(repository);
    vi.spyOn(Context, 'get').mockReturnValue({
      requestId: 'req-2',
      tenantId: 'tenant-2',
      user: { id: 'actor-2' },
    } as RequestContextStub);

    class TestService {
      @Auditable({
        action: 'project.create',
        resourceType: 'Project',
        resourceIdParam: 'resourceId',
        payloadParam: 'payload',
      })
      async create(
        resourceId: string,
        payload: Record<string, unknown>
      ): Promise<{ ok: boolean; resourceId: string; payload: Record<string, unknown> }> {
        return { ok: true, resourceId, payload };
      }
    }

    const service = new TestService();
    const result = await Promise.race([
      service.create('project-2', { name: 'new-project' }),
      new Promise<'timeout'>((resolve) => {
        setTimeout(() => resolve('timeout'), 50);
      }),
    ]);

    await Promise.resolve();

    expect(result).not.toBe('timeout');
    expect(createSpy).toHaveBeenCalledTimes(1);

    if (createDeferred.resolve) {
      createDeferred.resolve(
        createPersistedEntry({
          tenantId: 'tenant-2',
          actorId: 'actor-2',
          action: 'project.create',
          resourceType: 'Project',
          resourceId: 'project-2',
          payload: {
            arguments: ['project-2', { name: 'new-project' }],
            input: { name: 'new-project' },
            result: { ok: true, resourceId: 'project-2', payload: { name: 'new-project' } },
          },
          diff: null,
          metadata: {},
        })
      );
    }
  });

  it('should write failure audit log when decorated method throws', async () => {
    const createSpy = vi.fn(async (entry: Omit<AuditLogEntry, 'id' | 'createdAt'>) => createPersistedEntry(entry));
    const repository = {
      create: createSpy,
      find: vi.fn(),
    } as unknown as AuditLogRepository;

    vi.spyOn(Container, 'get').mockReturnValue(repository);
    vi.spyOn(Context, 'get').mockReturnValue({
      requestId: 'req-3',
      tenantId: 'tenant-3',
      user: { id: 'actor-3' },
    } as RequestContextStub);

    class TestService {
      @Auditable({
        action: 'project.delete',
        resourceType: 'Project',
        resourceIdParam: 'resourceId',
        payloadParam: 'payload',
      })
      async remove(resourceId: string, payload: { reason: string; diff: Record<string, unknown> }): Promise<void> {
        void payload;
        throw new Error(`delete failed: ${resourceId}`);
      }
    }

    const service = new TestService();

    await expect(
      service.remove('project-3', {
        reason: 'permission denied',
        diff: { status: { before: 'ACTIVE', after: 'DELETED' } },
      })
    ).rejects.toThrow('delete failed: project-3');

    await Promise.resolve();

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-3',
        actorId: 'actor-3',
        action: 'project.delete',
        resourceType: 'Project',
        resourceId: 'project-3',
        payload: expect.objectContaining({
          arguments: [
            'project-3',
            {
              reason: 'permission denied',
              diff: { status: { before: 'ACTIVE', after: 'DELETED' } },
            },
          ],
          input: {
            reason: 'permission denied',
            diff: { status: { before: 'ACTIVE', after: 'DELETED' } },
          },
          error: 'delete failed: project-3',
        }),
        diff: { status: { before: 'ACTIVE', after: 'DELETED' } },
      })
    );
  });
});
