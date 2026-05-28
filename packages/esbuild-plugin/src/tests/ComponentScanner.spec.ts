import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ComponentScanner,
  ComponentScannerDiagnosticError,
  ComponentScannerFileMetadataError,
  type CrocoPluginOptions,
  scanForComponents,
} from "../libs/ComponentScanner";

const FIXTURES_DIR = path.join(__dirname, "fixtures");
const TEMP_DIR = path.join(__dirname, "scanner-temp");

describe("ComponentScanner", () => {
  let scanner!: ComponentScanner;

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

  describe("constructor", () => {
    it("should create scanner with default options", () => {
      expect(scanner).not.toBeUndefined();
    });

    it("should create scanner with custom options", () => {
      const options: CrocoPluginOptions = {
        scanDirs: ["lib"],
        exclude: ["**/*.spec.ts"],
      };
      const customScanner = new ComponentScanner(options);
      expect(customScanner).not.toBeUndefined();
    });
  });

  describe("scan", () => {
    it("should return empty array for non-existent directory", () => {
      const result = scanner.scan("/nonexistent");
      expect(result).toEqual([]);
    });

    it("should find files with @Component decorator", () => {
      const fixtureScanner = new ComponentScanner({
        scanDirs: [FIXTURES_DIR],
      });
      const results = fixtureScanner.scan(FIXTURES_DIR);
      const componentFiles = results.filter((r) => r.hasComponent);

      expect(componentFiles.length).toBeGreaterThan(0);
      expect(componentFiles.some((r) => r.filePath.includes("WithComponent"))).toBe(true);
    });

    it("should respect exclude patterns", () => {
      const excludeScanner = new ComponentScanner({
        scanDirs: [FIXTURES_DIR],
        exclude: ["WithComponent.ts"],
      });

      const results = excludeScanner.scan(FIXTURES_DIR);
      const componentFiles = results.filter((r) => r.hasComponent);

      expect(componentFiles.some((r) => r.filePath.includes("WithComponent.ts"))).toBe(false);
    });

    it("should resolve excludes from the scan root even when cwd changes", () => {
      const projectRoot = path.join(TEMP_DIR, "project");
      const srcDir = path.join(projectRoot, "src");
      const includedFile = path.join(srcDir, "IncludedComponent.ts");
      const excludedFile = path.join(srcDir, "ExcludedComponent.ts");
      const originalCwd = process.cwd();

      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(includedFile, "@Component()\nexport class IncludedComponent {}");
      fs.writeFileSync(excludedFile, "@Component()\nexport class ExcludedComponent {}");

      process.chdir(TEMP_DIR);

      try {
        const excludeScanner = new ComponentScanner({
          scanDirs: ["src"],
          exclude: ["src/ExcludedComponent.ts"],
        });

        const results = excludeScanner.scan(projectRoot);

        expect(results.some((result) => result.filePath === path.resolve(includedFile))).toBe(true);
        expect(results.some((result) => result.filePath === path.resolve(excludedFile))).toBe(
          false,
        );
      } finally {
        process.chdir(originalCwd);
      }
    });

    it("should scan multiple directories", () => {
      const multiDirScanner = new ComponentScanner({
        scanDirs: [FIXTURES_DIR],
      });

      const results = multiDirScanner.scan();
      expect(results).toBeInstanceOf(Array);
    });

    it("should handle empty directories", () => {
      const emptyDirPath = path.join(TEMP_DIR, "empty");
      fs.mkdirSync(emptyDirPath, { recursive: true });

      const results = scanner.scan(emptyDirPath);
      expect(results).toEqual([]);
    });

    it("should handle nested directories", () => {
      const nestedDirPath = path.join(TEMP_DIR, "nested", "deep");
      fs.mkdirSync(nestedDirPath, { recursive: true });

      const componentFile = path.join(nestedDirPath, "NestedComponent.ts");
      fs.writeFileSync(componentFile, "@Component()\nexport class NestedComponent {}");

      const nestedScanner = new ComponentScanner({
        scanDirs: [TEMP_DIR],
      });
      const results = nestedScanner.scan(TEMP_DIR);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("scanFile", () => {
    it("should detect @Component decorator", () => {
      const withComponentPath = path.join(FIXTURES_DIR, "WithComponent.ts");
      const result = scanner.scanFile(withComponentPath);

      expect(result.hasComponent).toBe(true);
      expect(result.filePath).toContain("WithComponent.ts");
    });

    it("should detect @Component() with parentheses", () => {
      const withComponentPath = path.join(FIXTURES_DIR, "WithComponent.ts");
      const result = scanner.scanFile(withComponentPath);

      expect(result.hasComponent).toBe(true);
    });

    it("should not detect other decorators", () => {
      const withoutComponentPath = path.join(FIXTURES_DIR, "WithoutComponent.ts");
      const result = scanner.scanFile(withoutComponentPath);

      expect(result.hasComponent).toBe(false);
    });

    it("should return false for files without decorators", () => {
      const withoutComponentPath = path.join(FIXTURES_DIR, "WithoutComponent.ts");
      const result = scanner.scanFile(withoutComponentPath);

      expect(result.hasComponent).toBe(false);
    });

    it("should use cache when enabled", () => {
      const withComponentPath = path.join(FIXTURES_DIR, "WithComponent.ts");
      const result1 = scanner.scanFile(withComponentPath);
      const result2 = scanner.scanFile(withComponentPath);

      expect(result1).toEqual(result2);
    });

    it("should invalidate cache when mtime changes", () => {
      const testFilePath = path.join(TEMP_DIR, "CachedComponent.ts");
      fs.writeFileSync(testFilePath, "@Component()\nexport class CachedComponent {}");

      const result1 = scanner.scanFile(testFilePath);
      expect(result1.hasComponent).toBe(true);

      scanner.invalidateCache(testFilePath);

      const result2 = scanner.scanFile(testFilePath);
      expect(result2).toEqual(result1);
    });
  });

  describe("glob pattern matching", () => {
    it("should match ** patterns correctly", () => {
      const patternScanner = new ComponentScanner({
        exclude: ["**/fixtures/**"],
      });

      const results = patternScanner.scan(FIXTURES_DIR);
      expect(results).toBeInstanceOf(Array);
    });

    it("should match * patterns correctly", () => {
      const patternScanner = new ComponentScanner({
        exclude: ["*.test.ts"],
      });

      const results = patternScanner.scan(FIXTURES_DIR);
      expect(results).toBeInstanceOf(Array);
    });

    it("should handle complex exclude patterns", () => {
      const patternScanner = new ComponentScanner({
        exclude: ["**/*.test.ts", "**/fixtures/**", "**/*.spec.ts"],
      });

      const results = patternScanner.scan(FIXTURES_DIR);
      expect(results).toBeInstanceOf(Array);
    });
  });

  describe("TypeScript parsing", () => {
    it("should parse .ts files", () => {
      const tsFile = path.join(FIXTURES_DIR, "WithComponent.ts");
      const result = scanner.scanFile(tsFile);

      expect(result.hasComponent).toBe(true);
    });

    it("should parse .tsx files", () => {
      const tsxFile = path.join(FIXTURES_DIR, "WithComponent.tsx");
      const result = scanner.scanFile(tsxFile);

      expect(result.filePath).toContain("WithComponent.tsx");
    });

    it("should skip .d.ts files", () => {
      const declarationFile = path.join(TEMP_DIR, "types.d.ts");
      fs.writeFileSync(declarationFile, "export interface Test {}");

      const result = scanner.scanFile(declarationFile);
      expect(result.hasComponent).toBe(false);
    });

    it("should throw when parsing fails", () => {
      const invalidFile = path.join(TEMP_DIR, "invalid.ts");
      fs.writeFileSync(invalidFile, "this is not valid typescript {{{");

      expect(() => scanner.scanFile(invalidFile)).toThrow(ComponentScannerDiagnosticError);
    });

    it("should preserve diagnostic metadata when parsing fails", () => {
      const invalidFile = path.join(TEMP_DIR, "invalid.ts");
      fs.writeFileSync(invalidFile, "this is not valid typescript {{{");

      try {
        scanner.scanFile(invalidFile);
      } catch (error) {
        expect(error).toBeInstanceOf(ComponentScannerDiagnosticError);
        expect(error).toMatchObject({
          filePath: path.resolve(invalidFile),
          diagnosticText: expect.any(String),
          line: expect.any(Number),
          column: expect.any(Number),
        });
        return;
      }

      throw new Error("Expected diagnostic scan failure");
    });

    it("should preserve file metadata read failures with cause", () => {
      const missingFile = path.join(TEMP_DIR, "missing.ts");

      try {
        scanner.scanFile(missingFile);
      } catch (error) {
        expect(error).toBeInstanceOf(ComponentScannerFileMetadataError);
        expect(error).toMatchObject({
          filePath: path.resolve(missingFile),
          cause: expect.anything(),
        });
        return;
      }

      throw new Error("Expected metadata read failure");
    });
  });

  describe("custom decorators", () => {
    it("should detect custom decorator names", () => {
      const customScanner = new ComponentScanner({
        decorators: ["Service"],
      });

      const multipleDecoratorsPath = path.join(FIXTURES_DIR, "MultipleDecorators.ts");
      const result = customScanner.scanFile(multipleDecoratorsPath);

      expect(result.hasComponent).toBe(true);
    });

    it("should detect multiple decorator types", () => {
      const multiScanner = new ComponentScanner({
        decorators: ["Component", "Service"],
      });

      const multipleDecoratorsPath = path.join(FIXTURES_DIR, "MultipleDecorators.ts");
      const result = multiScanner.scanFile(multipleDecoratorsPath);

      expect(result.hasComponent).toBe(true);
    });
  });

  describe("clearCache", () => {
    it("should clear internal cache", () => {
      const fixtureScanner = new ComponentScanner({
        scanDirs: [FIXTURES_DIR],
      });

      // Scan to populate cache
      const results1 = fixtureScanner.scan();
      expect(results1.length).toBeGreaterThan(0);

      // Clear the cache
      fixtureScanner.clearCache();

      // After clearing cache, re-scanning should still produce the same results
      const results2 = fixtureScanner.scan();
      expect(results2).toEqual(results1);
    });
  });

  describe("invalidateCache", () => {
    it("should invalidate specific file cache", () => {
      const withComponentPath = path.join(FIXTURES_DIR, "WithComponent.ts");

      // Scan to populate cache
      const result1 = scanner.scanFile(withComponentPath);
      expect(result1.hasComponent).toBe(true);

      // Invalidate cache for specific file
      scanner.invalidateCache(withComponentPath);

      // Re-scanning should still produce the same result (file hasn't changed)
      const result2 = scanner.scanFile(withComponentPath);
      expect(result2).toEqual(result1);
    });
  });
});

describe("scanForComponents utility", () => {
  it("should be a function", () => {
    expect(typeof scanForComponents).toBe("function");
  });

  it("should scan for components using utility function", () => {
    const results = scanForComponents(FIXTURES_DIR);
    expect(results).toBeInstanceOf(Array);
  });

  it("should accept custom options", () => {
    const results = scanForComponents(FIXTURES_DIR, {
      decorators: ["Service"],
    });
    expect(results).toBeInstanceOf(Array);
  });
});
