import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { expect, it } from "vitest";
import {
  getSaasProviderProfileDefinition,
  createSaasProviderProfileManifest,
  renderGeneratedSaasProviderProfileSource,
} from "../saas-provider-profiles";

it("loads the selected Worker factory lazily without declaring the full SaaS profile executable", async () => {
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
    expect(generated.generatedSaasProviderProfileManifest.composition.executable).toBe(false);
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
    const options = {
      secretKey: "synthetic-secret-binding",
      audience: "croco-api",
      authorizedParties: ["https://console.example.com"],
    };
    expect(await generated.createGeneratedWorkersAuthPlugin(options)).toEqual({
      name: "selected-worker-auth",
      options,
    });
    expect(
      generated.generatedSaasProviderProfileManifest.capabilities.find(
        (item: { capability: string }) => item.capability === "auth",
      ),
    ).toMatchObject({
      productionState: "documentation-only",
      verifiedSubset: {
        entrypoint: "@croco/auth-clerk/workers",
        factoryExport: "clerkWorkersAuth",
      },
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
