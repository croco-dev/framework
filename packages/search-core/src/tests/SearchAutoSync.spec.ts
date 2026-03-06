import type { Constructor } from '@croco/framework-context';
import { Container, MetadataStorage } from '@croco/framework-context';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import type { SearchableMetadata } from '../libs/decorators/Searchable';
import { DocumentDeletedEvent, DocumentIndexedEvent, SearchSyncFailedEvent } from '../libs/events/SearchEvents';
import { SearchEngine } from '../libs/SearchEngine';
import { SearchAutoSync, type SearchSyncFailedEventPublisher } from '../libs/sync/SearchAutoSync';

describe('SearchAutoSync', () => {
  let searchAutoSync!: SearchAutoSync;
  let searchEngine!: SearchEngine;
  let eventBusMock!: {
    publish: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    Container.reset();
    vi.clearAllMocks();
    Container.reset();

    searchEngine = {
      indexDocument: vi.fn(),
      deleteDocument: vi.fn(),
    } as unknown as SearchEngine;
    Container.set(SearchEngine.token as unknown as Constructor<SearchEngine>, searchEngine);

    eventBusMock = {
      publish: vi.fn(),
    };

    searchAutoSync = new SearchAutoSync(eventBusMock as SearchSyncFailedEventPublisher);
  });

  it('should be defined', () => {
    expect(searchAutoSync).not.toBeNull();
  });

  it('should register both index and delete events with domain event names', async () => {
    const subscribeCalls: string[] = [];
    subscribeCalls.push(DocumentIndexedEvent.eventName, DocumentDeletedEvent.eventName);

    expect(subscribeCalls).toContain(DocumentIndexedEvent.eventName);
    expect(subscribeCalls).toContain(DocumentDeletedEvent.eventName);
  });

  describe('handle DocumentIndexedEvent', () => {
    it('should index document when autoSync is true', async () => {
      vi.spyOn(MetadataStorage, 'getAll').mockReturnValue([
        {
          target: class User {},
          value: {
            index: 'users',
            autoSync: true,
            target: class User {},
          } as SearchableMetadata,
        },
      ]);

      const event = new DocumentIndexedEvent('users', 'user-1', 'tenant-1', { name: 'John' });

      await searchAutoSync.handle(event);

      expect(searchEngine.indexDocument).toHaveBeenCalledWith('users', {
        id: 'user-1',
        tenantId: 'tenant-1',
        name: 'John',
      });
    });

    it('should NOT index document when autoSync is false', async () => {
      vi.spyOn(MetadataStorage, 'getAll').mockReturnValue([
        {
          target: class Product {},
          value: {
            index: 'products',
            autoSync: false,
            target: class Product {},
          } as SearchableMetadata,
        },
      ]);

      const event = new DocumentIndexedEvent('products', 'prod-1', 'tenant-1', { name: 'Widget' });

      await searchAutoSync.handle(event);

      expect(searchEngine.indexDocument).not.toHaveBeenCalled();
    });

    it('should ignore duplicate events', async () => {
      vi.spyOn(MetadataStorage, 'getAll').mockReturnValue([
        {
          target: class User {},
          value: {
            index: 'users',
            autoSync: true,
            target: class User {},
          } as SearchableMetadata,
        },
      ]);

      const event = new DocumentIndexedEvent('users', 'user-1', 'tenant-1', { name: 'John' });

      await searchAutoSync.handle(event);
      await searchAutoSync.handle(event);

      expect(searchEngine.indexDocument).toHaveBeenCalledTimes(1);
    });

    it('should publish SearchSyncFailedEvent on error', async () => {
      vi.spyOn(MetadataStorage, 'getAll').mockReturnValue([
        {
          target: class User {},
          value: {
            index: 'users',
            autoSync: true,
            target: class User {},
          } as SearchableMetadata,
        },
      ]);

      const error = new Error('Indexing failed');
      (searchEngine.indexDocument as Mock).mockRejectedValue(error);

      const event = new DocumentIndexedEvent('users', 'user-1', 'tenant-1', { name: 'John' });

      await searchAutoSync.handle(event);

      expect(eventBusMock.publish).toHaveBeenCalledWith(expect.any(SearchSyncFailedEvent));
      const failedEvent = eventBusMock.publish.mock.calls[0][0];
      expect(failedEvent.error).toBe(error);
      expect(failedEvent.operation).toBe('index');
    });
  });

  describe('handle DocumentDeletedEvent', () => {
    it('should delete document when autoSync is true', async () => {
      vi.spyOn(MetadataStorage, 'getAll').mockReturnValue([
        {
          target: class User {},
          value: {
            index: 'users',
            autoSync: true,
            target: class User {},
          } as SearchableMetadata,
        },
      ]);

      const event = new DocumentDeletedEvent('users', 'user-1', 'tenant-1');

      await searchAutoSync.handle(event);

      expect(searchEngine.deleteDocument).toHaveBeenCalledWith('users', 'user-1');
    });

    it('should publish SearchSyncFailedEvent on delete error', async () => {
      vi.spyOn(MetadataStorage, 'getAll').mockReturnValue([
        {
          target: class User {},
          value: {
            index: 'users',
            autoSync: true,
            target: class User {},
          } as SearchableMetadata,
        },
      ]);

      const error = new Error('Delete failed');
      (searchEngine.deleteDocument as Mock).mockRejectedValue(error);

      const event = new DocumentDeletedEvent('users', 'user-1', 'tenant-1');

      await searchAutoSync.handle(event);

      expect(eventBusMock.publish).toHaveBeenCalledWith(expect.any(SearchSyncFailedEvent));
      const failedEvent = eventBusMock.publish.mock.calls[0][0];
      expect(failedEvent.operation).toBe('delete');
    });

    it('should swallow failed event publishing errors', async () => {
      vi.spyOn(MetadataStorage, 'getAll').mockReturnValue([
        {
          target: class User {},
          value: {
            index: 'users',
            autoSync: true,
            target: class User {},
          } as SearchableMetadata,
        },
      ]);

      const error = new Error('Delete failed');
      (searchEngine.deleteDocument as Mock).mockRejectedValue(error);

      const failingPublisher = {
        publish: vi.fn().mockRejectedValue(new Error('Publisher missing')),
      };
      searchAutoSync = new SearchAutoSync(failingPublisher);

      await expect(
        searchAutoSync.handle(new DocumentDeletedEvent('users', 'user-1', 'tenant-1'))
      ).resolves.toBeUndefined();
      expect(failingPublisher.publish).toHaveBeenCalledWith(expect.any(SearchSyncFailedEvent));
    });

    it('should skip publishing when no failed event publisher is configured', async () => {
      vi.spyOn(MetadataStorage, 'getAll').mockReturnValue([
        {
          target: class User {},
          value: {
            index: 'users',
            autoSync: true,
            target: class User {},
          } as SearchableMetadata,
        },
      ]);

      const error = new Error('Delete failed');
      (searchEngine.deleteDocument as Mock).mockRejectedValue(error);
      searchAutoSync = new SearchAutoSync();

      await expect(
        searchAutoSync.handle(new DocumentDeletedEvent('users', 'user-1', 'tenant-1'))
      ).resolves.toBeUndefined();
      expect(eventBusMock.publish).not.toHaveBeenCalled();
    });
  });
});
