import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

export interface ScanResult {
  filePath: string;
  hasComponent: boolean;
}

export interface CrocoPluginOptions {
  scanDirs?: string[];
  exclude?: string[];
  decorators?: string[];
  cache?: boolean;
}

interface ScanCache {
  filePath: string;
  mtime: number;
  hasComponent: boolean;
}

const DEFAULT_SCAN_DIRS = ['src'];
const DEFAULT_EXCLUDE = ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**'];
const DEFAULT_DECORATORS = ['Component'];

export class ComponentScanner {
  private cache: Map<string, ScanCache> = new Map();
  private options: Required<CrocoPluginOptions>;

  constructor(options: CrocoPluginOptions = {}) {
    this.options = {
      scanDirs: options.scanDirs ?? DEFAULT_SCAN_DIRS,
      exclude: options.exclude ?? DEFAULT_EXCLUDE,
      decorators: options.decorators ?? DEFAULT_DECORATORS,
      cache: options.cache ?? true,
    };
  }

  scan(baseDir: string = process.cwd()): ScanResult[] {
    const results: ScanResult[] = [];
    const absoluteDirs = this.options.scanDirs.map(dir => (path.isAbsolute(dir) ? dir : path.resolve(baseDir, dir)));

    for (const dir of absoluteDirs) {
      const files = this.findTypeScriptFiles(dir);
      for (const filePath of files) {
        const result = this.scanFile(filePath);
        if (result.hasComponent) {
          results.push(result);
        }
      }
    }

    return results;
  }

  scanFile(filePath: string): ScanResult {
    const absolutePath = path.resolve(filePath);
    const mtime = this.getFileMtime(absolutePath);

    if (this.options.cache) {
      const cached = this.cache.get(absolutePath);
      if (cached && cached.mtime === mtime) {
        return { filePath: absolutePath, hasComponent: cached.hasComponent };
      }
    }

    const hasComponent = this.hasComponentDecorator(absolutePath);

    if (this.options.cache) {
      this.cache.set(absolutePath, { filePath: absolutePath, mtime, hasComponent });
    }

    return { filePath: absolutePath, hasComponent };
  }

  clearCache(): void {
    this.cache.clear();
  }

  invalidateCache(filePath: string): void {
    const absolutePath = path.resolve(filePath);
    this.cache.delete(absolutePath);
  }

  private findTypeScriptFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) {
      return [];
    }

    const stat = fs.statSync(dir);
    if (stat.isFile() && this.isTypeScriptFile(dir)) {
      return [dir];
    }

    if (!stat.isDirectory()) {
      return [];
    }

    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!this.isExcluded(fullPath)) {
          files.push(...this.findTypeScriptFiles(fullPath));
        }
      } else if (entry.isFile() && this.isTypeScriptFile(fullPath)) {
        if (!this.isExcluded(fullPath)) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }

  private isTypeScriptFile(filePath: string): boolean {
    return /\.(ts|tsx)$/.test(filePath) && !/\.d\.ts$/.test(filePath);
  }

  private isExcluded(filePath: string): boolean {
    const relativePath = path.relative(process.cwd(), filePath);
    return this.options.exclude.some(pattern => this.matchPattern(pattern, relativePath));
  }

  private matchPattern(pattern: string, filePath: string): boolean {
    const regexPattern = this.globToRegex(pattern);
    return regexPattern.test(filePath);
  }

  private globToRegex(pattern: string): RegExp {
    let regexStr = pattern
      .replace(/\*\*/g, 'SPLIT_STAR_STAR')
      .replace(/\*/g, 'STAR')
      .replace(/SPLIT_STAR_STAR/g, '.*')
      .replace(/STAR/g, '[^/]*')
      .replace(/\?/g, '[^/]');

    if (!regexStr.startsWith('^')) {
      regexStr = '^' + regexStr;
    }
    if (!regexStr.endsWith('$')) {
      regexStr = regexStr + '$';
    }

    return new RegExp(regexStr);
  }

  private hasComponentDecorator(filePath: string): boolean {
    try {
      const sourceCode = fs.readFileSync(filePath, 'utf-8');
      const sourceFile = ts.createSourceFile(filePath, sourceCode, ts.ScriptTarget.Latest, true);

      let hasComponent = false;

      const visitNode = (node: ts.Node) => {
        if (ts.isDecorator(node)) {
          const decoratorName = this.getDecoratorName(node);
          if (this.options.decorators.includes(decoratorName)) {
            hasComponent = true;
          }
        }
        ts.forEachChild(node, visitNode);
      };

      ts.forEachChild(sourceFile, visitNode);
      return hasComponent;
    } catch {
      return false;
    }
  }

  private getDecoratorName(decorator: ts.Decorator): string {
    const expression = decorator.expression;
    if (ts.isIdentifier(expression)) {
      return expression.text;
    }
    if (ts.isCallExpression(expression)) {
      if (ts.isIdentifier(expression.expression)) {
        return expression.expression.text;
      }
    }
    return '';
  }

  private getFileMtime(filePath: string): number {
    try {
      return fs.statSync(filePath).mtimeMs;
    } catch {
      return 0;
    }
  }
}

export function scanForComponents(baseDir: string, options: CrocoPluginOptions = {}): ScanResult[] {
  const scanner = new ComponentScanner(options);
  return scanner.scan(baseDir);
}
