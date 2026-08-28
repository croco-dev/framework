export type CrocoPresetConfig = {
  readonly name: string;
  readonly entry: string;
  readonly output: {
    readonly dir: string;
    readonly format: "esm" | "cjs" | "dual";
  };
  readonly hooks?: HookMap;
};

export type CrocoPresetOverride = {
  readonly name?: CrocoPresetConfig["name"];
  readonly entry?: CrocoPresetConfig["entry"];
  readonly output?: {
    readonly dir?: CrocoPresetConfig["output"]["dir"];
    readonly format?: CrocoPresetConfig["output"]["format"];
  };
  readonly hooks?: HookMap;
};

export type HookMap = {
  readonly "build:before"?: (
    config: CrocoPresetConfig,
  ) => Promise<CrocoPresetConfig> | CrocoPresetConfig;
  readonly "build:after"?: (result: {
    readonly success: boolean;
    readonly outputDir: string;
  }) => Promise<void> | void;
  readonly "dev:start"?: () => Promise<void> | void;
};

export type CrocoPreset = {
  readonly config: Readonly<CrocoPresetConfig>;
  readonly name: string;
  readonly hooks: Readonly<HookMap>;
  readonly extend: (override: CrocoPresetOverride) => CrocoPreset;
};
