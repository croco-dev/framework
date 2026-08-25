# @croco/protocol-codegen

Shared TypeScript project loading for Croco protocol generators.

The package gives RPC and OpenAPI generation one deterministic contract for application tsconfig discovery, compiler diagnostics, temporary JavaScript emission, runtime path-alias rewriting, and module loading. An explicit `tsconfigPath` takes precedence; otherwise the nearest `tsconfig.json` above the matched controller sources is used. Projects without a config retain the legacy CommonJS/ES2020 analysis defaults.

```ts
import { createControllerProject } from "@croco/protocol-codegen";

const controllerProject = createControllerProject({
  controllers: "src/controllers/**/*.ts",
  tsconfigPath: "tsconfig.json",
});

try {
  controllerProject.emit();
  const modules = await controllerProject.importControllerModules();
  console.log(modules.length);
} finally {
  controllerProject.dispose();
}
```

Missing, unreadable, or invalid selected configs fail with `CROCO_BUILD_004` and include the resolved absolute path, reason, and recovery action. The loader parses TypeScript configuration only; it does not execute application build scripts or TypeScript language-service plugins.
