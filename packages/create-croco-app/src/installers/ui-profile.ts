import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mergeInto } from "../helpers/fs.js";
import { TEMPLATES_DIR } from "../template-path.js";
import type { GeneratorOptions } from "../types.js";

type GeneratedUiProfileMetadata = {
  readonly name: "none" | "astryx";
  readonly styleEngine: "none" | "stylex";
  readonly requiresStylexCompile: boolean;
  readonly maturity: "alpha" | "beta";
  readonly generatedAppSmokeCase: string;
};

type GeneratedPresentationProfile = {
  readonly webApp: string;
  readonly runtimeProfile: "browser-vite-spa" | "browser-vite-spa-astryx";
  readonly ui: GeneratedUiProfileMetadata;
};

type GeneratedPresentationProfileManifest = {
  readonly schemaVersion: "croco.generated-presentation-profile/v1";
  readonly profiles: readonly GeneratedPresentationProfile[];
};

const UI_METADATA = {
  none: {
    name: "none",
    styleEngine: "none",
    requiresStylexCompile: false,
    maturity: "alpha",
    generatedAppSmokeCase: "graphql-vite-spa-docker",
  },
  astryx: {
    name: "astryx",
    styleEngine: "stylex",
    requiresStylexCompile: false,
    maturity: "beta",
    generatedAppSmokeCase: "graphql-vite-spa-astryx",
  },
} as const satisfies Record<NonNullable<GeneratorOptions["ui"]>, GeneratedUiProfileMetadata>;

export function installUiProfile(
  targetDir: string,
  webAppName: string,
  options: Pick<GeneratorOptions, "projectName" | "scope" | "frontendDeploy" | "ui">,
): void {
  if (!options.ui) return;
  if (options.frontendDeploy !== "vite-spa") return;

  const appTargetDir = join(targetDir, "apps", webAppName);
  const metadata = UI_METADATA[options.ui];
  const profile: GeneratedPresentationProfile = {
    webApp: webAppName,
    runtimeProfile: options.ui === "astryx" ? "browser-vite-spa-astryx" : "browser-vite-spa",
    ui: metadata,
  };

  writePresentationProfileManifest(targetDir, profile);
  writeFileSync(
    join(appTargetDir, "croco.presentation-profile.json"),
    `${JSON.stringify(profile, null, 2)}\n`,
  );

  if (options.ui === "none") return;

  mergeInto(join(TEMPLATES_DIR, "addons", "ui-astryx-vite-spa"), appTargetDir, {
    projectName: options.projectName,
    scope: options.scope,
  });
  addAstryxDependencies(appTargetDir);
}

function writePresentationProfileManifest(
  targetDir: string,
  profile: GeneratedPresentationProfile,
): void {
  const manifestPath = join(targetDir, "croco-presentation-profile.manifest.json");
  const existing = existsSync(manifestPath)
    ? (JSON.parse(readFileSync(manifestPath, "utf8")) as GeneratedPresentationProfileManifest)
    : undefined;
  const profiles = [
    ...(existing?.profiles ?? []).filter(({ webApp }) => webApp !== profile.webApp),
    profile,
  ];
  const manifest: GeneratedPresentationProfileManifest = {
    schemaVersion: "croco.generated-presentation-profile/v1",
    profiles,
  };

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function addAstryxDependencies(appTargetDir: string): void {
  const packageJsonPath = join(appTargetDir, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  packageJson.scripts = {
    ...packageJson.scripts,
    "presentation:smoke": "tsx src/presentation-smoke.tsx",
  };
  packageJson.dependencies = {
    ...packageJson.dependencies,
    "@astryxdesign/core": "0.1.4",
    "@astryxdesign/theme-neutral": "0.1.4",
    "@croco/ui-astryx": "workspace:*",
    "@stylexjs/stylex": "^0.18.3",
  };
  packageJson.devDependencies = {
    ...packageJson.devDependencies,
    tsx: "^4.20.0",
  };

  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}
