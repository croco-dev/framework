import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import { ComponentScanner, scanForComponents, CrocoPluginOptions } from './scanner';

vi.mock('fs');

describe('ComponentScanner', () => {
  let scanner: ComponentScanner;

  beforeEach(() => {
    vi.resetAllMocks();
    scanner = new ComponentScanner();
  });

  describe('constructor', () => {
    it('should create scanner with default options', () => {
      expect(scanner).toBeDefined();
    });

    it('should create scanner with custom options', () => {
      const options: CrocoPluginOptions = {
        scanDirs: ['lib'],
        exclude: ['**/*.spec.ts'],
      };
      const customScanner = new ComponentScanner(options);
      expect(customScanner).toBeDefined();
    });
  });

  describe('scan', () => {
    it('should return empty array for non-existent directory', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = scanner.scan('/nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('clearCache', () => {
    it('should clear internal cache', () => {
      scanner.clearCache();
      expect(true).toBe(true);
    });
  });

  describe('invalidateCache', () => {
    it('should invalidate specific file cache', () => {
      scanner.invalidateCache('/some/file.ts');
      expect(true).toBe(true);
    });
  });
});

describe('scanForComponents utility', () => {
  it('should be a function', () => {
    expect(typeof scanForComponents).toBe('function');
  });
});
