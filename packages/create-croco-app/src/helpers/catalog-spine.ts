const CROCO_PACKAGE_SCOPE_PREFIX = "@croco/";

export function normalizeCatalogSpinePackageName(packageName: string): string {
  if (packageName === "create-croco-app" || packageName.startsWith("@")) {
    return packageName;
  }

  return `${CROCO_PACKAGE_SCOPE_PREFIX}${packageName}`;
}
