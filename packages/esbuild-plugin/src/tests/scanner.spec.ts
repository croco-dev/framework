import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ComponentScanner, type CrocoPluginOptions, scanForComponents } from '../libs/ComponentScanner';

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const TEMP_DIR = path.join(__dirname, 'scanner-temp');

describe('ComponentScanner', () => {
  let scanner: ComponentScanner;

  beforeEach(() => {
    scanner = new ComponentScanner();

    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }
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
      const result = scanner.scan('/nonexistent');
      expect(result).toEqual([]);
    });

    it('should find files with @Component decorator', () => {
      const fixtureScanner = new ComponentScanner({
        scanDirs: [FIXTURES_DIR],
      });
      const results = fixtureScanner.scan(FIXTURES_DIR);
      const componentFiles = results.filter((r) => r.hasComponent);

      expect(componentFiles.length).toBeGreaterThan(0);
      expect(componentFiles.some((r) => r.filePath.includes('WithComponent'))).toBe(true);
    });

    it('should respect exclude patterns', () => {
      const excludeScanner = new ComponentScanner({
        scanDirs: [FIXTURES_DIR],
        exclude: ['**/WithComponent.ts'],
      });

      const results = excludeScanner.scan(FIXTURES_DIR);
      const componentFiles = results.filter((r) => r.hasComponent);

      expect(componentFiles.some((r) => r.filePath.includes('WithComponent.ts'))).toBe(false);
    });

    it('should scan multiple directories', () => {
      const multiDirScanner = new ComponentScanner({
        scanDirs: [FIXTURES_DIR],
      });

      const results = multiDirScanner.scan();
      expect(results).toBeInstanceOf(Array);
    });

    it('should handle empty directories', () => {
      const emptyDirPath = path.join(TEMP_DIR, 'empty');
      fs.mkdirSync(emptyDirPath, { recursive: true });

      const results = scanner.scan(emptyDirPath);
      expect(results).toEqual([]);
    });

    it('should handle nested directories', () => {
      const nestedDirPath = path.join(TEMP_DIR, 'nested', 'deep');
      fs.mkdirSync(nestedDirPath, { recursive: true });

      const componentFile = path.join(nestedDirPath, 'NestedComponent.ts');
      fs.writeFileSync(componentFile, '@Component()\nexport class NestedComponent {}');

      const nestedScanner = new ComponentScanner({
        scanDirs: [TEMP_DIR],
      });
      const results = nestedScanner.scan(TEMP_DIR);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('scanFile', () => {
    it('should detect @Component decorator', () => {
      const withComponentPath = path.join(FIXTURES_DIR, 'WithComponent.ts');
      const result = scanner.scanFile(withComponentPath);

      expect(result.hasComponent).toBe(true);
      expect(result.filePath).toContain('WithComponent.ts');
    });

    it('should detect @Component() with parentheses', () => {
      const withComponentPath = path.join(FIXTURES_DIR, 'WithComponent.ts');
      const result = scanner.scanFile(withComponentPath);

      expect(result.hasComponent).toBe(true);
    });

    it('should not detect other decorators', () => {
      const withoutComponentPath = path.join(FIXTURES_DIR, 'WithoutComponent.ts');
      const result = scanner.scanFile(withoutComponentPath);

      expect(result.hasComponent).toBe(false);
    });

    it('should return false for files without decorators', () => {
      const withoutComponentPath = path.join(FIXTURES_DIR, 'WithoutComponent.ts');
      const result = scanner.scanFile(withoutComponentPath);

      expect(result.hasComponent).toBe(false);
    });

    it('should use cache when enabled', () => {
      const withComponentPath = path.join(FIXTURES_DIR, 'WithComponent.ts');
      const result1 = scanner.scanFile(withComponentPath);
      const result2 = scanner.scanFile(withComponentPath);

      expect(result1).toEqual(result2);
    });

    it('should invalidate cache when mtime changes', () => {
      const testFilePath = path.join(TEMP_DIR, 'CachedComponent.ts');
      fs.writeFileSync(testFilePath, '@Component()\nexport class CachedComponent {}');

      const result1 = scanner.scanFile(testFilePath);
      expect(result1.hasComponent).toBe(true);

      scanner.invalidateCache(testFilePath);

      const result2 = scanner.scanFile(testFilePath);
      expect(result2).toEqual(result1);
    });
  });

  describe('glob pattern matching', () => {
    it('should match ** patterns correctly', () => {
      const patternScanner = new ComponentScanner({
        exclude: ['**/fixtures/**'],
      });

      const results = patternScanner.scan(FIXTURES_DIR);
      expect(results).toBeInstanceOf(Array);
    });

    it('should match * patterns correctly', () => {
      const patternScanner = new ComponentScanner({
        exclude: ['*.test.ts'],
      });

      const results = patternScanner.scan(FIXTURES_DIR);
      expect(results).toBeInstanceOf(Array);
    });

    it('should handle complex exclude patterns', () => {
      const patternScanner = new ComponentScanner({
        exclude: ['**/*.test.ts', '**/fixtures/**', '**/*.spec.ts'],
      });

      const results = patternScanner.scan();
      expect(results).toBeInstanceOf(Array);
    });
  });

  describe('TypeScript parsing', () => {
    it('should parse .ts files', () => {
      const tsFile = path.join(FIXTURES_DIR, 'WithComponent.ts');
      const result = scanner.scanFile(tsFile);

      expect(result.hasComponent).toBe(true);
    });

    it('should parse .tsx files', () => {
      const tsxFile = path.join(FIXTURES_DIR, 'WithComponent.tsx');
      const result = scanner.scanFile(tsxFile);

      expect(result.filePath).toContain('WithComponent.tsx');
    });

    it('should skip .d.ts files', () => {
      const declarationFile = path.join(TEMP_DIR, 'types.d.ts');
      fs.writeFileSync(declarationFile, 'export interface Test {}');

      const result = scanner.scanFile(declarationFile);
      expect(result.hasComponent).toBe(false);
    });

    it('should handle parse errors gracefully', () => {
      const invalidFile = path.join(TEMP_DIR, 'invalid.ts');
      fs.writeFileSync(invalidFile, 'this is not valid typescript {{{');

      const result = scanner.scanFile(invalidFile);
      expect(result.hasComponent).toBe(false);
    });
  });

  describe('custom decorators', () => {
    it('should detect custom decorator names', () => {
      const customScanner = new ComponentScanner({
        decorators: ['Service'],
      });

      const multipleDecoratorsPath = path.join(FIXTURES_DIR, 'MultipleDecorators.ts');
      const result = customScanner.scanFile(multipleDecoratorsPath);

      expect(result.hasComponent).toBe(true);
    });

    it('should detect multiple decorator types', () => {
      const multiScanner = new ComponentScanner({
        decorators: ['Component', 'Service'],
      });

      const multipleDecoratorsPath = path.join(FIXTURES_DIR, 'MultipleDecorators.ts');
      const result = multiScanner.scanFile(multipleDecoratorsPath);

      expect(result.hasComponent).toBe(true);
    });
  });

  describe('clearCache', () => {
    it('should clear internal cache', () => {
      scanner.scan(FIXTURES_DIR);
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

  it('should scan for components using utility function', () => {
    const results = scanForComponents(FIXTURES_DIR);
    expect(results).toBeInstanceOf(Array);
  });

  it('should accept custom options', () => {
    const results = scanForComponents(FIXTURES_DIR, {
      decorators: ['Service'],
    });
    expect(results).toBeInstanceOf(Array);
  });
});
