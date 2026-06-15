import { readFile } from "node:fs/promises";
import { Node, Project, SyntaxKind } from "ts-morph";

const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

type DependencyField = (typeof DEPENDENCY_FIELDS)[number];
type PackageManifest = Partial<Record<DependencyField, Record<string, string>>>;

export type GeneratedImportSource = {
  readonly path: string;
  readonly content: string;
};

export type GeneratedImportContractOptions = {
  readonly manifestPath: string;
  readonly manifestLabel: string;
  readonly sources: readonly GeneratedImportSource[];
};

export async function assertGeneratedImportDependencies(
  options: GeneratedImportContractOptions,
): Promise<void> {
  const manifest = await readPackageManifest(options.manifestPath);
  const declaredDependencies = collectDeclaredDependencies(manifest);
  const importedPackages = collectGeneratedImportPackages(options.sources);
  const missingPackages = importedPackages.filter(
    (packageName) => !declaredDependencies.has(packageName),
  );

  if (missingPackages.length === 0) {
    return;
  }

  throw new Error(
    [
      `Missing dependencies in ${options.manifestLabel} for generated imports: ${missingPackages.join(", ")}.`,
      `Add ${formatPackageList(missingPackages)} to ${options.manifestLabel} before running this generator.`,
    ].join(" "),
  );
}

export async function readPackageManifest(manifestPath: string): Promise<PackageManifest> {
  return JSON.parse(await readFile(manifestPath, "utf-8")) as PackageManifest;
}

export function hasManifestDependency(manifest: PackageManifest, packageName: string): boolean {
  return DEPENDENCY_FIELDS.some((field) =>
    Object.prototype.hasOwnProperty.call(manifest[field] ?? {}, packageName),
  );
}

function collectDeclaredDependencies(manifest: PackageManifest): Set<string> {
  return new Set(DEPENDENCY_FIELDS.flatMap((field) => Object.keys(manifest[field] ?? {})));
}

function collectGeneratedImportPackages(sources: readonly GeneratedImportSource[]): string[] {
  const project = new Project({ useInMemoryFileSystem: true });
  const packageNames = new Set<string>();

  for (const source of sources) {
    const sourceFile = project.createSourceFile(source.path, source.content, { overwrite: true });
    const moduleSpecifiers = [
      ...sourceFile
        .getImportDeclarations()
        .map((declaration) => declaration.getModuleSpecifierValue()),
      ...sourceFile
        .getExportDeclarations()
        .map((declaration) => declaration.getModuleSpecifierValue())
        .filter((value): value is string => typeof value === "string"),
      ...sourceFile
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .map((call) => {
          const expression = call.getExpression();
          const [argument] = call.getArguments();

          if (
            expression.getKind() !== SyntaxKind.ImportKeyword ||
            !Node.isStringLiteral(argument)
          ) {
            return null;
          }

          return argument.getLiteralValue();
        })
        .filter((value): value is string => typeof value === "string"),
    ];

    for (const moduleSpecifier of moduleSpecifiers) {
      if (isBareModuleSpecifier(moduleSpecifier)) {
        packageNames.add(toPackageName(moduleSpecifier));
      }
    }
  }

  return [...packageNames];
}

function isBareModuleSpecifier(moduleSpecifier: string): boolean {
  return (
    !moduleSpecifier.startsWith(".") &&
    !moduleSpecifier.startsWith("/") &&
    !moduleSpecifier.startsWith("node:")
  );
}

function toPackageName(moduleSpecifier: string): string {
  if (!moduleSpecifier.startsWith("@")) {
    return moduleSpecifier.split("/")[0] ?? moduleSpecifier;
  }

  const [scope, name] = moduleSpecifier.split("/");

  return `${scope}/${name}`;
}

function formatPackageList(packageNames: readonly string[]): string {
  if (packageNames.length === 1) {
    return packageNames[0] ?? "the missing package";
  }

  return packageNames.join(", ");
}
