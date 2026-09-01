import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { apiDocPackages } from "../api-docs.config.mjs";

const DOCS_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PACKAGES_ROOT = dirname(DOCS_ROOT);

function symbolKey(symbol) {
  if (
    !symbol ||
    typeof symbol !== "object" ||
    typeof symbol.packageName !== "string" ||
    typeof symbol.packagePath !== "string" ||
    typeof symbol.qualifiedName !== "string"
  ) {
    return undefined;
  }
  if (symbol.packagePath === "" && symbol.qualifiedName === "unknown") return "unknown";
  return JSON.stringify([symbol.packageName, symbol.packagePath, symbol.qualifiedName]);
}

function collectReflectionIds(reflection, ids) {
  if (!reflection || typeof reflection !== "object") return;
  if (typeof reflection.id === "number") ids.add(reflection.id);
  for (const value of Object.values(reflection)) {
    if (!value || typeof value !== "object") continue;
    if (Array.isArray(value)) {
      for (const child of value) collectReflectionIds(child, ids);
    } else {
      collectReflectionIds(value, ids);
    }
  }
}

function withoutRemovedGroupChildren(groups, removedIds) {
  if (!Array.isArray(groups)) return groups;
  return groups
    .map((group) => {
      if (!group || typeof group !== "object" || !Array.isArray(group.children)) return group;
      return { ...group, children: group.children.filter((id) => !removedIds.has(id)) };
    })
    .filter((group) => !group || typeof group !== "object" || group.children?.length !== 0);
}

function rewriteRemovedReferenceTargets(value, removedIds, removedSymbols, packageName) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value)
      rewriteRemovedReferenceTargets(item, removedIds, removedSymbols, packageName);
    return;
  }

  if (
    value.type === "reference" &&
    typeof value.target === "number" &&
    removedIds.has(value.target)
  ) {
    const symbol = removedSymbols.get(value.target);
    if (!symbol) {
      throw new Error(
        `TypeDoc model for ${packageName} cannot remap removed reflection ${value.target}`,
      );
    }
    value.target = symbol;
  }

  for (const child of Object.values(value)) {
    rewriteRemovedReferenceTargets(child, removedIds, removedSymbols, packageName);
  }
}

export function prunePreviouslyDocumentedExports(model, seenSymbols, packageName) {
  if (!model || typeof model !== "object" || !Array.isArray(model.children)) {
    throw new Error(`TypeDoc model for ${packageName} is missing project children`);
  }
  if (!model.symbolIdMap || typeof model.symbolIdMap !== "object") {
    throw new Error(`TypeDoc model for ${packageName} is missing symbolIdMap`);
  }

  const removedIds = new Set();
  model.children = model.children.filter((reflection) => {
    const key = symbolKey(model.symbolIdMap[reflection.id]);
    if (!key) return true;
    if (!seenSymbols.has(key)) {
      seenSymbols.add(key);
      return true;
    }
    collectReflectionIds(reflection, removedIds);
    return false;
  });

  const removedSymbols = new Map();
  for (const id of removedIds) {
    const symbol = model.symbolIdMap[id];
    if (symbol && typeof symbol === "object") removedSymbols.set(id, symbol);
  }
  rewriteRemovedReferenceTargets(model, removedIds, removedSymbols, packageName);
  for (const id of removedIds) delete model.symbolIdMap[id];
  model.groups = withoutRemovedGroupChildren(model.groups, removedIds);
  model.categories = withoutRemovedGroupChildren(model.categories, removedIds);
  return model;
}

export async function prepareApiModelEntryPoints(destinationRoot) {
  await rm(destinationRoot, { force: true, recursive: true });
  const seenSymbols = new Set();
  const entryPoints = [];

  for (const entry of apiDocPackages) {
    const source = join(PACKAGES_ROOT, entry.directory, ".turbo", "docs-api", "model.json");
    const destination = join(destinationRoot, entry.directory, "model.json");
    const model = JSON.parse(await readFile(source, "utf8"));
    prunePreviouslyDocumentedExports(model, seenSymbols, entry.packageName);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, `${JSON.stringify(model)}\n`);
    entryPoints.push(destination);
  }

  return entryPoints;
}
