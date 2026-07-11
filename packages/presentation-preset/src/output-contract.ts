/**
 * Output format type for build artifacts
 * - 'esm': ECMAScript Module (.mjs or .js with "type": "module")
 * - 'cjs': CommonJS (.cjs or .js with "type": "commonjs")
 * - 'dual': Both ESM and CJS formats
 * - 'neutral': Runtime-independent config, type, or static asset
 */
export type ArtifactFormat = "esm" | "cjs" | "dual" | "neutral";

/**
 * Type of build artifact
 * - 'code': JavaScript/TypeScript source output
 * - 'types': TypeScript declaration (.d.ts)
 * - 'config': Configuration file
 * - 'asset': Static asset (CSS, HTML, images)
 */
export type ArtifactType = "code" | "types" | "config" | "asset";

/**
 * Represents a single build output artifact
 */
export type BuildArtifact = {
  /** Relative path from output directory (e.g. "index.js", "dist/worker.js") */
  readonly path: string;
  /** Format of this artifact */
  readonly format: ArtifactFormat;
  /** Type of artifact */
  readonly type: ArtifactType;
  /** Optional file size in bytes (filled after build) */
  readonly size?: number;
};

/**
 * Entry point descriptor — maps export subpath to the entry file
 * Maps CrocoPresetConfig.output entries to actual file paths
 */
export type EntryDescriptor = {
  /** Export subpath (e.g. ".", "./entry", "./handler", "./fetch") */
  readonly exportName: string;
  /** The main entry file path */
  readonly main: string;
  /** The CJS entry file path (only for dual format) */
  readonly cjs?: string;
  /** The type declaration file path */
  readonly types: string;
};

/**
 * Core output contract that ALL presets must conform to.
 * Describes the complete build output of a preset.
 */
export type OutputContract = {
  /** Preset name (e.g. "node", "lambda", "cloudflare") */
  readonly presetName: string;
  /** When the build was performed (ISO 8601) */
  readonly buildTime: string;
  /** List of all build artifacts */
  readonly artifacts: readonly BuildArtifact[];
  /** Entry point descriptors */
  readonly entries: readonly EntryDescriptor[];
  /** Output format of the build */
  readonly format: ArtifactFormat;
  /** Optional checksum for integrity verification */
  readonly checksum?: string;
};

/**
 * Deployment target metadata — describes where and how the output is deployed
 */
export type DeployTarget = {
  /** Target platform (e.g. "node", "lambda", "cloudflare-workers", "static") */
  readonly target: string;
  /** Required environment variables */
  readonly requiredEnvVars?: readonly string[];
  /** Runtime constraints */
  readonly runtime?: {
    readonly nodeVersion?: string;
    readonly memory?: number;
    readonly timeout?: number;
  };
  /** Output contract this target uses */
  readonly output: OutputContract;
};

export type PresentationRuntime = "node" | "lambda" | "cloudflare-workers" | "browser";

export type GeneratedUiProfileName = "none" | "astryx";

export type GeneratedUiStyleEngine = "none" | "stylex";

export type GeneratedUiProfileMaturity = "alpha" | "beta";

export type GeneratedUiProfileMetadata = {
  /** UI profile selected by the generator */
  readonly name: GeneratedUiProfileName;
  /** Styling engine used by the generated profile */
  readonly styleEngine: GeneratedUiStyleEngine;
  /** Whether the generated application must compile StyleX source */
  readonly requiresStylexCompile: boolean;
  /** Current support maturity of the generated UI profile */
  readonly maturity: GeneratedUiProfileMaturity;
  /** Generated app smoke case that proves this UI profile */
  readonly generatedAppSmokeCase: string;
};

export type GeneratedRuntimeProfile = {
  /** Stable generated profile name used in tests and docs */
  readonly name: string;
  /** Runtime claim this generated profile proves for the package catalog */
  readonly runtime: PresentationRuntime;
  /** Named package test that validates this profile contract */
  readonly packageTestName: string;
  /** create-croco-app generated smoke case that exercises this profile */
  readonly generatedAppSmokeCase: string;
  /** Focused command for re-running the generated smoke evidence */
  readonly generatedAppSmokeCommand: string;
  /** Optional generated UI profile evidence for presentation-aware applications */
  readonly ui?: GeneratedUiProfileMetadata;
  /** Runtime target metadata and expected output contract for the profile */
  readonly target: DeployTarget;
};

export type GeneratedRuntimeProfileCatalog = {
  readonly schemaVersion: 1;
  readonly validationCommand: string;
  readonly profiles: readonly GeneratedRuntimeProfile[];
};
