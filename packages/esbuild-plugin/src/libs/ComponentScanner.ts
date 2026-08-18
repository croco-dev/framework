import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";

export interface ScanResult {
  filePath: string;
  hasComponent: boolean;
  decorators: string[];
  /** Exported declaration names carrying a matched decorator, in source order. */
  symbols: string[];
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
  decorators: string[];
  symbols: string[];
}

const DEFAULT_SCAN_DIRS = ["src"];
const DEFAULT_EXCLUDE = ["**/*.test.ts", "**/*.spec.ts", "**/node_modules/**"];
const DEFAULT_DECORATORS = ["Component", "Controller", "GraphQLResolver"];

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type DiagnosticPosition = {
  line?: number;
  column?: number;
};

export class ComponentScannerError extends Error {
  readonly filePath: string;
  readonly cause: unknown;

  constructor(message: string, filePath: string, cause?: unknown) {
    super(message);
    this.name = new.target.name;
    this.filePath = path.resolve(filePath);
    this.cause = cause;
  }
}

export class ComponentScannerDiagnosticError extends ComponentScannerError {
  readonly diagnostic: ts.Diagnostic;
  readonly diagnosticText: string;
  readonly line?: number;
  readonly column?: number;

  constructor(filePath: string, diagnostic: ts.Diagnostic) {
    const diagnosticText = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
    const position = getDiagnosticPosition(diagnostic);
    super(
      `Failed to parse TypeScript file '${path.resolve(filePath)}': ${diagnosticText}`,
      filePath,
      diagnostic,
    );
    this.diagnostic = diagnostic;
    this.diagnosticText = diagnosticText;
    this.line = position.line;
    this.column = position.column;
  }
}

export class ComponentScannerFileMetadataError extends ComponentScannerError {
  constructor(filePath: string, cause: unknown) {
    super(
      `Failed to read file metadata for '${path.resolve(filePath)}': ${toErrorMessage(cause)}`,
      filePath,
      cause,
    );
  }
}

export class ComponentScannerDecoratorScanError extends ComponentScannerError {
  constructor(filePath: string, cause: unknown) {
    super(
      `Failed to scan decorators in '${path.resolve(filePath)}': ${toErrorMessage(cause)}`,
      filePath,
      cause,
    );
  }
}

function getDiagnosticPosition(diagnostic: ts.Diagnostic): DiagnosticPosition {
  if (!diagnostic.file || diagnostic.start === undefined) {
    return {};
  }

  const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
  return {
    line: line + 1,
    column: character + 1,
  };
}

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
    const scanRoot = path.resolve(baseDir);
    const absoluteDirs = this.options.scanDirs.map((dir) =>
      path.isAbsolute(dir) ? dir : path.resolve(scanRoot, dir),
    );

    for (const dir of absoluteDirs) {
      const files = this.findTypeScriptFiles(dir, scanRoot);
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
        return {
          filePath: absolutePath,
          hasComponent: cached.hasComponent,
          decorators: cached.decorators,
          symbols: cached.symbols,
        };
      }
    }

    const { decorators, symbols } = this.getDecorators(absolutePath);
    const hasComponent = decorators.length > 0;

    if (this.options.cache) {
      this.cache.set(absolutePath, {
        filePath: absolutePath,
        mtime,
        hasComponent,
        decorators,
        symbols,
      });
    }

    return { filePath: absolutePath, hasComponent, decorators, symbols };
  }

  clearCache(): void {
    this.cache.clear();
  }

  invalidateCache(filePath: string): void {
    const absolutePath = path.resolve(filePath);
    this.cache.delete(absolutePath);
  }

  rescanFile(filePath: string): ScanResult {
    this.invalidateCache(filePath);
    return this.scanFile(filePath);
  }

  incrementalScan(changedFiles: string[], baseDir: string): ScanResult[] {
    const results: ScanResult[] = [];
    const scanRoot = path.resolve(baseDir);

    for (const file of changedFiles) {
      this.invalidateCache(file);
    }

    const absoluteDirs = this.options.scanDirs.map((dir) =>
      path.isAbsolute(dir) ? dir : path.resolve(scanRoot, dir),
    );

    for (const dir of absoluteDirs) {
      const files = this.findTypeScriptFiles(dir, scanRoot);
      for (const filePath of files) {
        const result = this.scanFile(filePath);
        if (result.hasComponent) {
          results.push(result);
        }
      }
    }

    return results;
  }

  private findTypeScriptFiles(dir: string, scanRoot: string): string[] {
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
        if (!this.isExcluded(fullPath, scanRoot)) {
          files.push(...this.findTypeScriptFiles(fullPath, scanRoot));
        }
      } else if (entry.isFile() && this.isTypeScriptFile(fullPath)) {
        if (!this.isExcluded(fullPath, scanRoot)) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }

  private isTypeScriptFile(filePath: string): boolean {
    return /\.(ts|tsx)$/.test(filePath) && !filePath.endsWith(".d.ts");
  }

  private isExcluded(filePath: string, scanRoot: string): boolean {
    const relativePath = path.relative(scanRoot, filePath).replace(/\\/g, "/");
    return this.options.exclude.some((pattern) => this.matchPattern(pattern, relativePath));
  }

  private matchPattern(pattern: string, filePath: string): boolean {
    const regexPattern = this.globToRegex(pattern);
    return regexPattern.test(filePath);
  }

  private globToRegex(pattern: string): RegExp {
    let regexStr = pattern
      .replace(/\*\*/g, "SPLIT_STAR_STAR")
      .replace(/\*/g, "STAR")
      .replace(/SPLIT_STAR_STAR/g, ".*")
      .replace(/STAR/g, "[^/]*")
      .replace(/\?/g, "[^/]");

    if (!regexStr.startsWith("^")) {
      regexStr = `^${regexStr}`;
    }
    if (!regexStr.endsWith("$")) {
      regexStr = `${regexStr}$`;
    }

    return new RegExp(regexStr);
  }

  private getDecorators(filePath: string): { decorators: string[]; symbols: string[] } {
    try {
      if (filePath.endsWith(".d.ts")) {
        return { decorators: [], symbols: [] };
      }

      const sourceCode = fs.readFileSync(filePath, "utf-8");
      const parseResult = ts.transpileModule(sourceCode, {
        compilerOptions: {
          target: ts.ScriptTarget.Latest,
        },
        fileName: filePath,
        reportDiagnostics: true,
      });
      const [firstDiagnostic] = parseResult.diagnostics ?? [];

      if (firstDiagnostic) {
        throw new ComponentScannerDiagnosticError(filePath, firstDiagnostic);
      }

      const sourceFile = ts.createSourceFile(filePath, sourceCode, ts.ScriptTarget.Latest, true);

      const decorators: string[] = [];
      const symbols: string[] = [];

      const visitNode = (node: ts.Node) => {
        if (ts.isDecorator(node)) {
          const decoratorName = this.getDecoratorName(node);
          if (this.options.decorators.includes(decoratorName)) {
            decorators.push(decoratorName);
            const symbol = this.getDecoratedSymbol(node);
            if (symbol) {
              symbols.push(symbol);
            }
          }
        }
        ts.forEachChild(node, visitNode);
      };

      ts.forEachChild(sourceFile, visitNode);
      return { decorators, symbols };
    } catch (error) {
      if (error instanceof ComponentScannerError) {
        throw error;
      }

      throw new ComponentScannerDecoratorScanError(filePath, error);
    }
  }

  private getDecoratedSymbol(decorator: ts.Decorator): string | undefined {
    const declaration = decorator.parent;
    const name = this.getDeclarationName(declaration);
    if (!name) {
      return undefined;
    }

    // Only decorators directly on module-level declarations yield importable symbols.
    const isModuleLevel =
      ts.isClassDeclaration(declaration) ||
      ts.isFunctionDeclaration(declaration) ||
      ts.isVariableStatement(declaration);
    if (!isModuleLevel || !ts.isSourceFile(declaration.parent)) {
      return undefined;
    }

    if (!ts.canHaveModifiers(declaration)) {
      return undefined;
    }
    const modifiers = ts.getModifiers(declaration);
    const hasExport = modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
    const hasDefault = modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) ?? false;
    return hasExport && !hasDefault ? name : undefined;
  }

  private getDeclarationName(node: ts.Node): string | undefined {
    if (ts.isClassDeclaration(node) || ts.isFunctionDeclaration(node)) {
      return node.name?.text;
    }

    if (ts.isVariableStatement(node)) {
      const firstDeclaration = node.declarationList.declarations[0];
      return firstDeclaration && ts.isIdentifier(firstDeclaration.name)
        ? firstDeclaration.name.text
        : undefined;
    }

    return undefined;
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
    return "";
  }

  private getFileMtime(filePath: string): number {
    try {
      return fs.statSync(filePath).mtimeMs;
    } catch (error) {
      throw new ComponentScannerFileMetadataError(filePath, error);
    }
  }
}

export function scanForComponents(baseDir: string, options: CrocoPluginOptions = {}): ScanResult[] {
  const scanner = new ComponentScanner(options);
  return scanner.scan(baseDir);
}
