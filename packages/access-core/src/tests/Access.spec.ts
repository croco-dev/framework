import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { ACCESS_METADATA_KEY } from '../libs/constants';
import { Access } from '../libs/decorators/Access';

describe('Access', () => {
  it('should store metadata with objectType and relation', () => {
    class TestController {
      @Access('document', 'editor')
      testMethod() {}
    }

    const metadata = Reflect.getMetadata(ACCESS_METADATA_KEY, TestController, 'testMethod');

    expect(metadata).toBeDefined();
    expect(metadata.objectType).toBe('document');
    expect(metadata.relation).toBe('editor');
  });

  it('should store different metadata for different methods', () => {
    class TestController {
      @Access('document', 'editor')
      editMethod() {}

      @Access('document', 'viewer')
      viewMethod() {}
    }

    const editMetadata = Reflect.getMetadata(ACCESS_METADATA_KEY, TestController, 'editMethod');
    const viewMetadata = Reflect.getMetadata(ACCESS_METADATA_KEY, TestController, 'viewMethod');

    expect(editMetadata.relation).toBe('editor');
    expect(viewMetadata.relation).toBe('viewer');
  });

  it('should store metadata with different object types', () => {
    class TestController {
      @Access('document', 'owner')
      documentMethod() {}

      @Access('folder', 'owner')
      folderMethod() {}
    }

    const documentMetadata = Reflect.getMetadata(ACCESS_METADATA_KEY, TestController, 'documentMethod');
    const folderMetadata = Reflect.getMetadata(ACCESS_METADATA_KEY, TestController, 'folderMethod');

    expect(documentMetadata.objectType).toBe('document');
    expect(folderMetadata.objectType).toBe('folder');
  });

  it('should preserve method functionality', () => {
    class TestController {
      @Access('document', 'editor')
      testMethod(value: number): number {
        return value * 2;
      }
    }

    const instance = new TestController();
    expect(instance.testMethod(5)).toBe(10);
  });
});
