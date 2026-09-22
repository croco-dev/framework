#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";

const projectRoot = resolve(process.argv[2] ?? process.cwd());
const packageJsonPath = resolve(projectRoot, "package.json");

try {
  inspectProject();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

function inspectProject() {
  if (!existsSync(packageJsonPath)) {
    throw new Error(`Croco project inspection requires ${packageJsonPath}`);
  }

  const packageJson = readJsonObject(packageJsonPath, "package.json");
  const result = {
    schemaVersion: "croco.skill-inspection/v1",
    projectRoot,
    packageName: stringValue(packageJson.name),
    crocoDependencies: collectCrocoDependencies(packageJson),
    verificationScripts: collectVerificationScripts(packageJson),
    manifests: {
      architecture: inspectArchitectureManifest(),
      runtimeCapability: inspectRuntimeCapabilityManifest(),
      saasProfile: inspectSaasProfileManifest(),
    },
    compositionRoots: findCompositionRoots(projectRoot),
  };

  console.log(`${JSON.stringify(result, null, 2)}\n`);
}

function inspectArchitectureManifest() {
  const path = "croco.arch.json";
  const manifest = readOptionalJson(path);
  if (!manifest) return { path, found: false };

  const packageGroups = requiredRecordValue(manifest.packageGroups, `${path}.packageGroups`);
  return {
    path,
    found: true,
    schemaVersion: requiredStringValue(manifest.schemaVersion, `${path}.schemaVersion`),
    policyName: requiredStringValue(manifest.policyName, `${path}.policyName`),
    packageGroups: Object.fromEntries(
      Object.entries(packageGroups).map(([name, value]) => {
        const group = requiredRecordValue(value, `${path}.packageGroups.${name}`);
        return [
          name,
          {
            packages: optionalStringArrayField(group, "packages", `${path}.packageGroups.${name}`),
            paths: optionalStringArrayField(group, "paths", `${path}.packageGroups.${name}`),
          },
        ];
      }),
    ),
  };
}

function inspectRuntimeCapabilityManifest() {
  const path = "croco-runtime-capability.manifest.json";
  const manifest = readOptionalJson(path);
  if (!manifest) return { path, found: false };

  return {
    path,
    found: true,
    version: requiredStringValue(manifest.version, `${path}.version`),
    platform: requiredStringValue(manifest.platform, `${path}.platform`),
    capabilities: requiredRecordValue(manifest.capabilities, `${path}.capabilities`),
    ...(manifest.composition === undefined
      ? {}
      : { composition: requiredRecordValue(manifest.composition, `${path}.composition`) }),
    diagnostics: requiredArrayValue(manifest.diagnostics, `${path}.diagnostics`),
  };
}

function inspectSaasProfileManifest() {
  const path = "croco-saas-profile.manifest.json";
  const manifest = readOptionalJson(path);
  if (!manifest) return { path, found: false };

  const profile = requiredRecordValue(manifest.profile, `${path}.profile`);
  const capabilities = requiredArrayValue(manifest.capabilities, `${path}.capabilities`);
  return {
    path,
    found: true,
    schemaVersion: requiredStringValue(manifest.schemaVersion, `${path}.schemaVersion`),
    profile: {
      name: requiredStringValue(profile.name, `${path}.profile.name`),
      runtimeTarget: requiredStringValue(profile.runtimeTarget, `${path}.profile.runtimeTarget`),
    },
    capabilities: capabilities.map((entry, index) => {
      const field = `${path}.capabilities[${index}]`;
      const capability = requiredRecordValue(entry, field);
      return {
        capability: requiredStringValue(capability.capability, `${field}.capability`),
        packageName: requiredStringValue(capability.packageName, `${field}.packageName`),
        provider: requiredStringValue(capability.provider, `${field}.provider`),
        status: requiredStringValue(capability.status, `${field}.status`),
        zeroCredentialState: requiredStringValue(
          capability.zeroCredentialState,
          `${field}.zeroCredentialState`,
        ),
        productionState: requiredStringValue(
          capability.productionState,
          `${field}.productionState`,
        ),
      };
    }),
    smoke: Object.keys(requiredRecordValue(manifest.smoke, `${path}.smoke`)).sort(),
  };
}

function collectCrocoDependencies(packageJson) {
  const dependencyFields = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ];
  const dependencies = {};

  for (const field of dependencyFields) {
    for (const [name, range] of Object.entries(optionalRecordField(packageJson, field))) {
      if (name.startsWith("@croco/") && typeof range === "string") dependencies[name] = range;
    }
  }

  return Object.fromEntries(
    Object.entries(dependencies).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function collectVerificationScripts(packageJson) {
  const scripts = optionalRecordField(packageJson, "scripts");
  const selected = Object.entries(scripts).filter(
    ([name, command]) =>
      typeof command === "string" &&
      /(?:architecture|contract|di|doctor|profile|project-map|runtime|smoke|test|typecheck|verify)/.test(
        name,
      ),
  );
  return selected.map(([name]) => name).sort((left, right) => left.localeCompare(right));
}

function findCompositionRoots(root) {
  const ignoredDirectories = new Set([
    ".git",
    ".next",
    ".turbo",
    "coverage",
    "dist",
    "node_modules",
  ]);
  const roots = [];
  const directories = [root];

  while (directories.length > 0) {
    const current = directories.pop();
    if (!current) break;

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) directories.push(resolve(current, entry.name));
        continue;
      }

      if (/^(?:compositionRoot|app)\.(?:[cm]?[jt]sx?)$/.test(entry.name)) {
        const path = resolve(current, entry.name);
        const source = readFileSync(path, "utf8");
        if (/defineCrocoApplication|createGenerated.*ApplicationDefinition/.test(source)) {
          roots.push(relative(root, path));
        }
      }
    }
  }

  return roots.sort();
}

function readOptionalJson(path) {
  const absolutePath = resolve(projectRoot, path);
  return existsSync(absolutePath) ? readJsonObject(absolutePath, path) : undefined;
}

function readJsonObject(path, label) {
  const value = JSON.parse(readFileSync(path, "utf8"));
  return requiredRecordValue(value, label);
}

function optionalRecordField(record, field) {
  const value = record[field];
  return value === undefined ? {} : requiredRecordValue(value, `package.json.${field}`);
}

function requiredRecordValue(value, field) {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return value;
  throw new Error(`${field} must contain a JSON object.`);
}

function requiredArrayValue(value, field) {
  if (Array.isArray(value)) return value;
  throw new Error(`${field} must contain a JSON array.`);
}

function optionalStringArrayField(record, field, parent) {
  const value = record[field];
  if (value === undefined) return [];
  if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) return value;
  throw new Error(`${parent}.${field} must contain a JSON string array.`);
}

function requiredStringValue(value, field) {
  if (typeof value === "string") return value;
  throw new Error(`${field} must contain a string.`);
}

function stringValue(value) {
  return typeof value === "string" ? value : undefined;
}
