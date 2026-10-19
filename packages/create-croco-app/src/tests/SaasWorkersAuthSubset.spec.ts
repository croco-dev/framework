import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { expect, it, vi } from "vitest";
import {
  getSaasProviderProfileDefinition,
  createSaasProviderProfileManifest,
  renderGeneratedSaasProviderProfileSource,
} from "../saas-provider-profiles";

it("loads optional Worker auth lazily without promoting bootstrap capability states", async () => {
  const manifest = createSaasProviderProfileManifest(
    getSaasProviderProfileDefinition("saas-cloudflare"),
  );
  const source = renderGeneratedSaasProviderProfileSource({
    manifest,
    providerProfileDocs: "",
    providerEnvExample: "",
    providerSecretsChecklist: "",
  });
  const directory = mkdtempSync(join(tmpdir(), "croco-worker-subset-"));
  try {
    const file = join(directory, "profile.mjs");
    writeFileSync(
      file,
      transpileModule(source, {
        compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 },
      }).outputText,
    );
    const generated = await import(pathToFileURL(file).href);
    expect(generated.generatedSaasProviderProfileManifest.composition).toMatchObject({
      executable: true,
      scope: "bootstrap-only",
    });
    expect(generated.generatedSaasProviderProfileManifest.packages).toEqual([
      "@croco/preset-cloudflare",
    ]);
    expect(() => generated.createGeneratedSaasApplicationDefinition()).toThrow(
      "CROCO_SAAS_PROFILE_RUNTIME_UNAVAILABLE",
    );
    // Only the optional SDK/package boundary is stubbed: execute the real generated loader and its options forwarding.
    const packageDir = join(directory, "node_modules", "@croco", "auth-clerk");
    mkdirSync(packageDir, { recursive: true });
    writeFileSync(
      join(packageDir, "package.json"),
      JSON.stringify({ type: "module", exports: { "./workers": "./workers.mjs" } }),
    );
    writeFileSync(
      join(packageDir, "workers.mjs"),
      'export function clerkWorkersAuth(options) { return { name: "selected-worker-auth", options }; }',
    );
    const loaderFile = join(directory, "loader.mjs");
    writeFileSync(loaderFile, 'export const load = () => import("@croco/auth-clerk/workers");');
    const { load } = await import(pathToFileURL(loaderFile).href);
    const loadFactory = vi.fn(load);
    expect(loadFactory).not.toHaveBeenCalled();
    const options = {
      secretKey: "synthetic-secret-binding",
      audience: "croco-api",
      authorizedParties: ["https://console.example.com"],
    };
    expect(await generated.createGeneratedWorkersAuthPlugin(options, loadFactory)).toEqual({
      name: "selected-worker-auth",
      options,
    });
    expect(loadFactory).toHaveBeenCalledOnce();
    expect(
      generated.generatedSaasProviderProfileManifest.capabilities.find(
        (item: { capability: string }) => item.capability === "auth",
      ),
    ).toMatchObject({
      productionState: "unavailable",
      verifiedSubset: {
        entrypoint: "@croco/auth-clerk/workers",
        factoryExport: "clerkWorkersAuth",
      },
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
